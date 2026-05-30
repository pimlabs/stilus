import { readFileSync } from "node:fs";
import { DEFAULT_PROFILE, Profile, getProfile, profileToDict } from "./config";

export type AnalysisReport = {
  severity: "ok" | "warning" | "error";
  metrics: Metrics;
  warnings: string[];
  errors: string[];
  table_blocks: Array<{ start: number; end: number }>;
  broken_tables: Array<{ start: number; end: number; row_lines: number[] }>;
  broken_lines: BrokenLinesResult;
  ghost_chapters: Array<{ line: number; text: string }>;
  citations: CitationResult;
  structural_elements: StructuralElements;
  missing_required_sections: string[];
  profile: ReturnType<typeof profileToDict>;
};

export type CompareReport = {
  severity: "ok" | "warning" | "error";
  source_metrics: Metrics;
  clean_metrics: Metrics;
  word_delta: number;
  character_delta: number;
  heading_delta: number;
  reference_delta: number;
  citation_delta: number;
  broken_line_delta: number;
  table_block_delta: number;
  broken_table_delta: number;
  warnings: string[];
  errors: string[];
  profile: ReturnType<typeof profileToDict>;
};

type Metrics = {
  characters: number;
  words: number;
  lines: number;
  empty_lines: number;
  empty_line_ratio: number;
  form_feeds: number;
};

type BrokenLinesResult = {
  total: number;
  items: Array<{ line: number; section: string; text: string }>;
  by_section: Record<string, number>;
};

type CitationResult = {
  citations: number[];
  references: number[];
  citation_count: number;
  reference_count: number;
  missing_references: number[];
  unused_references: number[];
  status: "ok" | "error";
};

type StructuralElements = {
  figures: number;
  table_captions: number;
  footnotes: number;
};

export type Chunk = {
  heading: string;
  start_line: number;
  end_line: number;
  text: string;
  word_count: number;
};

function countWords(text: string): number {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

function collectMetrics(text: string): Metrics {
  const lines = text.split("\n");
  const emptyLines = lines.filter(l => !l.trim()).length;
  const formFeeds = (text.match(/\f|\x0c/g) ?? []).length;
  return {
    characters: text.length,
    words: countWords(text),
    lines: lines.length,
    empty_lines: emptyLines,
    empty_line_ratio: lines.length > 0 ? (emptyLines / lines.length) * 100 : 0,
    form_feeds: formFeeds,
  };
}

function isHeading(line: string, profile: Profile): boolean {
  const s = line.trim();
  return s.startsWith("#") || new RegExp(profile.chapter_pattern, "i").test(s);
}

function isSectionHeading(line: string, profile: Profile): boolean {
  const s = line.trim();
  if (new RegExp(profile.section_pattern).test(s)) return true;
  if (profile.subsection_pattern && new RegExp(profile.subsection_pattern).test(s)) return true;
  return false;
}

function isTableRow(line: string): boolean {
  const s = line.trim();
  const pipeCount = (s.match(/\|/g) ?? []).length;
  if (pipeCount >= 2) return true;
  const numCount = (s.match(/\d+[.,]?\d*/g) ?? []).length;
  return numCount >= 3 && s.length < 60;
}

function isStructuralLine(stripped: string, profile: Profile): boolean {
  if (isTableRow(stripped)) return true;
  if (isSectionHeading(stripped, profile)) return true;
  if (profile.figure_pattern && new RegExp(profile.figure_pattern, "i").test(stripped)) return true;
  if (profile.table_caption_pattern && new RegExp(profile.table_caption_pattern, "i").test(stripped)) return true;
  if (profile.footnote_pattern && new RegExp(profile.footnote_pattern, "i").test(stripped)) return true;
  return false;
}

export function detectTableBlocks(lines: string[]): Array<{ start: number; end: number }> {
  const blocks: Array<{ start: number; end: number }> = [];
  let inTable = false;
  let tableStart = 0;
  lines.forEach((line, i) => {
    const idx = i + 1;
    if (!line.trim()) {
      if (inTable) { blocks.push({ start: tableStart, end: idx - 1 }); inTable = false; }
      return;
    }
    if (isTableRow(line)) {
      if (!inTable) { tableStart = idx; inTable = true; }
    } else if (inTable) {
      blocks.push({ start: tableStart, end: idx - 1 });
      inTable = false;
    }
  });
  if (inTable) blocks.push({ start: tableStart, end: lines.length });
  return blocks;
}

export function detectBrokenTables(lines: string[]): Array<{ start: number; end: number; row_lines: number[] }> {
  const broken: Array<{ start: number; end: number; row_lines: number[] }> = [];
  let inBlock = false;
  let blockStart = 0;
  let blockLines: number[] = [];

  lines.forEach((line, i) => {
    const idx = i + 1;
    const s = line.trim();
    if (!s) {
      if (inBlock) {
        broken.push({ start: blockStart, end: idx - 1, row_lines: [...blockLines] });
        inBlock = false;
        blockLines = [];
      }
      return;
    }
    const numCount = (s.match(/\d+[.,]?\d*/g) ?? []).length;
    const hasPipes = s.includes("|");
    const isListItem = /^[-*]|\d+\.\s/.test(s);
    if (numCount >= 3 && !hasPipes && s.length < 80 && !isListItem) {
      if (!inBlock) { blockStart = idx; inBlock = true; }
      blockLines.push(idx);
    } else if (inBlock) {
      broken.push({ start: blockStart, end: idx - 1, row_lines: [...blockLines] });
      inBlock = false;
      blockLines = [];
    }
  });
  if (inBlock) broken.push({ start: blockStart, end: lines.length, row_lines: [...blockLines] });
  return broken;
}

export function detectBrokenLines(lines: string[], profile: Profile): BrokenLinesResult {
  let currentSection = "FRONT MATTER / PROLOG";
  const items: BrokenLinesResult["items"] = [];
  const bySection: Record<string, number> = { [currentSection]: 0 };

  lines.forEach((line, i) => {
    const idx = i + 1;
    const s = line.trim();
    if (!s) return;
    if (isHeading(s, profile)) {
      currentSection = s.replace(/^[#\s]+/, "").trim();
      if (!(currentSection in bySection)) bySection[currentSection] = 0;
      return;
    }
    const endings = profile.broken_line_endings as string[];
    const endsOk = endings.some(e => s.endsWith(e));
    if (!endsOk && s.length > profile.broken_line_min_length && !isStructuralLine(s, profile)) {
      items.push({ line: idx, section: currentSection, text: s });
      bySection[currentSection] = (bySection[currentSection] ?? 0) + 1;
    }
  });

  return { total: items.length, items, by_section: bySection };
}

export function detectGhostChapters(
  lines: string[],
  profile: Profile
): Array<{ line: number; text: string }> {
  if (!profile.stub_chapter_pattern) return [];
  const re = new RegExp(profile.stub_chapter_pattern, "i");
  return lines.flatMap((line, i) => {
    const s = line.trim();
    if (re.test(s)) {
      const clean = s.replace(/^#+\s*/, "").trim();
      if (clean.length < 15) return [{ line: i + 1, text: s }];
    }
    return [];
  });
}

export function countStructuralElements(lines: string[], profile: Profile): StructuralElements {
  let figures = 0, table_captions = 0, footnotes = 0;
  const figRe = profile.figure_pattern ? new RegExp(profile.figure_pattern, "i") : null;
  const tblRe = profile.table_caption_pattern ? new RegExp(profile.table_caption_pattern, "i") : null;
  const fnRe = profile.footnote_pattern ? new RegExp(profile.footnote_pattern, "i") : null;
  for (const line of lines) {
    const s = line.trim();
    if (figRe?.test(s)) figures++;
    if (tblRe?.test(s)) table_captions++;
    if (fnRe?.test(s)) footnotes++;
  }
  return { figures, table_captions, footnotes };
}

export function validateRequiredSections(lines: string[], profile: Profile): string[] {
  if (!profile.required_sections.length) return [];
  const found = new Set<string>();
  for (const line of lines) {
    if (isHeading(line, profile) || isSectionHeading(line, profile)) {
      found.add(line.trim().replace(/^#+\s*/, "").toUpperCase().trim());
    }
  }
  return profile.required_sections.filter(s => !found.has(s.toUpperCase())) as string[];
}

function analyzeCitations(text: string, profile: Profile): CitationResult {
  const citations = [...new Set((text.match(/\[(\d+)\]/g) ?? []).map(m => parseInt(m.slice(1, -1))))].sort((a, b) => a - b);
  const refMatches = [...text.matchAll(new RegExp(profile.reference_pattern, "gm"))].map(m => parseInt(m[1]));
  const refs = [...new Set(refMatches)].sort((a, b) => a - b);
  const missing = citations.filter(c => !refs.includes(c));
  const unused = refs.filter(r => !citations.includes(r));
  return {
    citations, references: refs,
    citation_count: citations.length, reference_count: refs.length,
    missing_references: missing, unused_references: unused,
    status: missing.length > 0 ? "error" : "ok",
  };
}

function buildWarnings(
  metrics: Metrics,
  broken: BrokenLinesResult,
  brokenTables: ReturnType<typeof detectBrokenTables>,
  citations: CitationResult,
  missingSections: string[],
  strict = false
): { warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];
  const push = (msg: string) => (strict ? errors : warnings).push(msg);
  if (metrics.form_feeds > 0) push(`Found ${metrics.form_feeds} form feed/page break characters.`);
  if (broken.total > 0) push(`Found ${broken.total} likely broken lines.`);
  if (brokenTables.length > 0) push(`Found ${brokenTables.length} possible broken table(s) (numeric rows without pipe separators).`);
  if (citations.missing_references.length) errors.push(`Missing references for citations: ${JSON.stringify(citations.missing_references)}.`);
  if (missingSections.length) errors.push(`Required sections not found: ${JSON.stringify(missingSections)}.`);
  return { warnings, errors };
}

export function analyzeText(text: string, profile?: Profile, strict = false): AnalysisReport {
  const p = profile ?? getProfile(DEFAULT_PROFILE);
  const lines = text.split("\n");
  const metrics = collectMetrics(text);
  const tableBlocks = detectTableBlocks(lines);
  const brokenTables = detectBrokenTables(lines);
  const broken = detectBrokenLines(lines, p);
  const ghosts = detectGhostChapters(lines, p);
  const citations = analyzeCitations(text, p);
  const structural = countStructuralElements(lines, p);
  const missingSections = validateRequiredSections(lines, p);
  const { warnings, errors } = buildWarnings(metrics, broken, brokenTables, citations, missingSections, strict);
  const severity = errors.length > 0 ? "error" : warnings.length > 0 ? "warning" : "ok";
  return {
    severity, metrics, warnings, errors,
    table_blocks: tableBlocks, broken_tables: brokenTables,
    broken_lines: broken, ghost_chapters: ghosts,
    citations, structural_elements: structural,
    missing_required_sections: missingSections,
    profile: profileToDict(p),
  };
}

export function analyzeFile(path: string, profile?: Profile, strict = false): AnalysisReport {
  return analyzeText(readFileSync(path, "utf-8"), profile, strict);
}

export function compareReports(
  sourceReport: AnalysisReport,
  cleanReport: AnalysisReport,
  profile?: Profile,
  strict = false
): CompareReport {
  const p = profile ?? getProfile(DEFAULT_PROFILE);
  const sm = sourceReport.metrics;
  const cm = cleanReport.metrics;
  const wordDelta = cm.words - sm.words;
  const warnings: string[] = [];
  const errors: string[] = [];
  if (Math.abs(wordDelta) > p.word_delta_threshold)
    (strict ? errors : warnings).push(`Word delta ${wordDelta > 0 ? "+" : ""}${wordDelta} exceeds threshold ${p.word_delta_threshold}.`);
  if (cleanReport.broken_lines.total > 0 && strict) errors.push("Clean file still has broken lines.");
  if (cleanReport.citations.missing_references.length) errors.push("Clean file has citation/reference mismatches.");
  const severity = errors.length > 0 ? "error" : warnings.length > 0 ? "warning" : "ok";
  return {
    severity, source_metrics: sm, clean_metrics: cm,
    word_delta: wordDelta, character_delta: cm.characters - sm.characters,
    heading_delta: cleanReport.ghost_chapters.length - sourceReport.ghost_chapters.length,
    reference_delta: cleanReport.citations.reference_count - sourceReport.citations.reference_count,
    citation_delta: cleanReport.citations.citation_count - sourceReport.citations.citation_count,
    broken_line_delta: cleanReport.broken_lines.total - sourceReport.broken_lines.total,
    table_block_delta: cleanReport.table_blocks.length - sourceReport.table_blocks.length,
    broken_table_delta: cleanReport.broken_tables.length - sourceReport.broken_tables.length,
    warnings, errors, profile: profileToDict(p),
  };
}

export function compareFiles(
  sourcePath: string, cleanPath: string, profile?: Profile, strict = false
): CompareReport {
  const p = profile ?? getProfile(DEFAULT_PROFILE);
  const src = analyzeFile(sourcePath, p, false);
  const cln = analyzeFile(cleanPath, p, strict);
  return compareReports(src, cln, p, strict);
}

export function chunkByHeadings(text: string, profile?: Profile): Chunk[] {
  const p = profile ?? getProfile(DEFAULT_PROFILE);
  const lines = text.split("\n");
  const chunks: Chunk[] = [];
  let currentHeading = "FRONT MATTER";
  let currentLines: string[] = [];
  let startLine = 1;

  lines.forEach((line, i) => {
    const idx = i + 1;
    if (isHeading(line.trim(), p) && line.trim()) {
      if (currentLines.length) {
        const t = currentLines.join("\n").trim();
        chunks.push({ heading: currentHeading, start_line: startLine, end_line: idx - 1, text: t, word_count: countWords(currentLines.join("\n")) });
      }
      currentHeading = line.trim().replace(/^#+\s*/, "").trim();
      currentLines = [line];
      startLine = idx;
    } else {
      currentLines.push(line);
    }
  });

  if (currentLines.length) {
    const t = currentLines.join("\n").trim();
    chunks.push({ heading: currentHeading, start_line: startLine, end_line: lines.length, text: t, word_count: countWords(currentLines.join("\n")) });
  }

  return chunks;
}

export function chunkFile(path: string, profile?: Profile): Chunk[] {
  return chunkByHeadings(readFileSync(path, "utf-8"), profile);
}

import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import {
  AnalysisReport,
  analyzeText,
  compareReports,
} from "./analyzer";
import { DEFAULT_PROFILE, Profile, getProfile, profileToDict } from "./config";

const LIST_PATTERN = /^(\s*[-*]|\s*\d+\.\s+)/;
const URL_PATTERN = /^https?:\/\/[^\s]+/;

export function normalizeText(text: string, profile?: Profile): string {
  const emDash = profile?.normalize_em_dash ?? true;
  const spacePunct = profile?.normalize_space_before_punctuation ?? true;
  let t = text.replace(/\x0c|\f/g, "\n");
  if (spacePunct) {
    t = t.replace(/[ \t]+,[ \t]*/g, ", ");
    t = t.replace(/[ \t]+\.[ \t]*/g, ". ");
  }
  if (emDash) {
    t = t.replace(/[ \t]*—[ \t]*|[ \t]*--[ \t]*/g, " — ");
  }
  return t;
}

function isList(line: string): boolean {
  return LIST_PATTERN.test(line);
}

function isUrl(line: string): boolean {
  return URL_PATTERN.test(line);
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
  if ((s.match(/\|/g) ?? []).length >= 2) return true;
  return (s.match(/\d+[.,]?\d*/g) ?? []).length >= 3 && s.length < 60;
}

function shouldJoinUrl(previous: string, current: string, profile: Profile): boolean {
  if (!previous) return false;
  if (previous.startsWith("http") && previous.endsWith("-"))
    return !!current && !isHeading(current, profile);
  if (previous.startsWith("http"))
    return current.includes("/") || current.includes(".") || /^(en|id)\//.test(current);
  return false;
}

function standardizeHeading(line: string, profile: Profile): string {
  if (isHeading(line, profile) && !line.startsWith("#")) return `# ${line}`;
  if (isSectionHeading(line, profile) && !line.startsWith("#")) return `## ${line}`;
  return line;
}

export function mergeAndStructure(text: string, profile?: Profile): string {
  const p = profile ?? getProfile(DEFAULT_PROFILE);
  const rawLines = normalizeText(text, p).split("\n");
  const processed: string[] = [];
  const paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      processed.push(paragraph.join(" "));
      paragraph.length = 0;
    }
  };

  const endings = p.sentence_endings as string[];

  for (const rawLine of rawLines) {
    const line = rawLine.trim().replace(/\s+/g, " ");

    if (!line) {
      if (paragraph.length && endings.some(e => paragraph[paragraph.length - 1].endsWith(e))) {
        flushParagraph();
        processed.push("");
      }
      continue;
    }

    if (paragraph.length && shouldJoinUrl(paragraph[paragraph.length - 1], line, p)) {
      let prev = paragraph.pop()!;
      if (prev.endsWith("-")) prev = prev.slice(0, -1);
      paragraph.push(prev + line);
      continue;
    }

    const structural =
      isHeading(line, p) || isSectionHeading(line, p) || isList(line) || isUrl(line) || isTableRow(line);

    if (!structural && processed.length && shouldJoinUrl(processed[processed.length - 1], line, p)) {
      let prev = processed.pop()!;
      if (prev.endsWith("-")) prev = prev.slice(0, -1);
      processed.push(prev + line);
      continue;
    }

    if (structural) {
      flushParagraph();
      const out = standardizeHeading(line, p);
      if (isTableRow(out)) {
        processed.push(out);
      } else {
        const prevIsList = processed.length > 0 && isList(processed[processed.length - 1]);
        if (processed.length && processed[processed.length - 1] !== "" && !(isList(out) && prevIsList)) {
          processed.push("");
        }
        processed.push(out);
        if (!isList(out) && !isUrl(out)) processed.push("");
      }
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  return processed.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

export type Manifest = {
  input_path: string;
  output_path: string;
  dry_run: boolean;
  timestamp: string;
  profile: ReturnType<typeof profileToDict>;
  before: AnalysisReport;
  after: AnalysisReport;
  comparison: ReturnType<typeof compareReports>;
  warnings: string[];
  errors: string[];
  severity: "ok" | "warning" | "error";
};

export function cleanManuscript(
  inputPath: string,
  outputPath: string,
  profile?: Profile,
  strict = false,
  dryRun = false
): { cleanText: string; manifest: Manifest; manifestPath: string } {
  const p = profile ?? getProfile(DEFAULT_PROFILE);
  const rawText = readFileSync(inputPath, "utf-8");
  const before = analyzeText(rawText, p, false);
  const cleanText = mergeAndStructure(rawText, p);
  const after = analyzeText(cleanText, p, strict);
  const comparison = compareReports(before, after, p, strict);

  if (!dryRun) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, cleanText, "utf-8");
  }

  const allWarnings = [...after.warnings, ...comparison.warnings];
  const allErrors = [...after.errors, ...comparison.errors];
  const severity: "ok" | "warning" | "error" =
    after.severity === "error" || comparison.severity === "error"
      ? "error"
      : after.severity === "warning" || comparison.severity === "warning"
      ? "warning"
      : "ok";

  const manifest: Manifest = {
    input_path: inputPath,
    output_path: outputPath,
    dry_run: dryRun,
    timestamp: new Date().toISOString(),
    profile: profileToDict(p),
    before,
    after,
    comparison,
    warnings: allWarnings,
    errors: allErrors,
    severity,
  };

  const manifestPath = join(dirname(outputPath), "manifest.json");
  return { cleanText, manifest, manifestPath };
}

import { mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";
import { AnalysisReport, Chunk, CompareReport } from "./analyzer";

export function writeJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

export function formatInspection(report: AnalysisReport, title = "MANUSCRIPT INSPECTION"): string {
  const m = report.metrics;
  const lines: string[] = [];
  const bar = "=".repeat(70);
  lines.push(bar, title, bar);
  lines.push(`Severity              : ${report.severity}`, "");
  lines.push(`Characters            : ${m.characters.toLocaleString()}`);
  lines.push(`Words                 : ${m.words.toLocaleString()}`);
  lines.push(`Lines                 : ${m.lines.toLocaleString()}`);
  lines.push(`Empty line ratio      : ${m.empty_line_ratio.toFixed(1)}%`, "");
  lines.push(`Page breaks           : ${m.form_feeds}`);
  lines.push(`Table blocks          : ${report.table_blocks.length}`);
  lines.push(`Broken tables (likely): ${report.broken_tables.length}`);
  lines.push(`Broken lines (likely) : ${report.broken_lines.total}`);
  lines.push(`Ghost headings        : ${report.ghost_chapters.length}`);
  const se = report.structural_elements;
  if (se.figures > 0 || se.table_captions > 0 || se.footnotes > 0) {
    lines.push("");
    lines.push(`Figures               : ${se.figures}`);
    lines.push(`Table captions        : ${se.table_captions}`);
    if (se.footnotes > 0) lines.push(`Footnotes             : ${se.footnotes}`);
  }
  lines.push("");
  lines.push(`Citations             : ${report.citations.citation_count}`);
  lines.push(`References found      : ${report.citations.reference_count}`);
  if (report.citations.missing_references.length)
    lines.push(`Missing references    : ${JSON.stringify(report.citations.missing_references)}`);
  if (report.missing_required_sections.length)
    lines.push(`Missing sections      : ${JSON.stringify(report.missing_required_sections)}`);
  const bySection = Object.entries(report.broken_lines.by_section).filter(([, c]) => c > 0);
  if (bySection.length) {
    lines.push("\nBroken lines by section:");
    for (const [section, count] of bySection)
      lines.push(`  ${String(count).padStart(3)}  ${section}`);
  }
  if (report.warnings.length) {
    lines.push("\nWarnings:");
    for (const w of report.warnings) lines.push(`  - ${w}`);
  }
  if (report.errors.length) {
    lines.push("\nErrors:");
    for (const e of report.errors) lines.push(`  - ${e}`);
  }
  lines.push(bar);
  return lines.join("\n");
}

export function formatChunkSummary(chunks: Array<Chunk & { slug?: string }>, outputDir: string): string {
  const bar = "=".repeat(70);
  const lines: string[] = [bar, `MANUSCRIPT CHUNKS: ${outputDir}`, bar];
  lines.push(`Total chunks          : ${chunks.length}`);
  lines.push(`Total words           : ${chunks.reduce((s, c) => s + c.word_count, 0).toLocaleString()}`, "");
  for (const [idx, chunk] of chunks.entries()) {
    const slug = (chunk.slug ?? chunk.heading).padEnd(40);
    lines.push(`  ${String(idx).padStart(2, "0")}  ${slug}  ${String(chunk.word_count).padStart(6)} words  (lines ${chunk.start_line}–${chunk.end_line})`);
  }
  lines.push(bar);
  return lines.join("\n");
}

export function formatCompare(report: CompareReport): string {
  const bar = "=".repeat(70);
  const lines: string[] = [bar, "MANUSCRIPT COMPARISON", bar];
  lines.push(`Severity              : ${report.severity}`, "");
  lines.push(`Character delta       : ${report.character_delta >= 0 ? "+" : ""}${report.character_delta}`);
  lines.push(`Word delta            : ${report.word_delta >= 0 ? "+" : ""}${report.word_delta}`, "");
  lines.push(`Table blocks delta    : ${report.table_block_delta >= 0 ? "+" : ""}${report.table_block_delta}`);
  lines.push(`Broken tables delta   : ${report.broken_table_delta >= 0 ? "+" : ""}${report.broken_table_delta}`);
  lines.push(`Broken lines delta    : ${report.broken_line_delta >= 0 ? "+" : ""}${report.broken_line_delta}`, "");
  lines.push(`Citations delta       : ${report.citation_delta >= 0 ? "+" : ""}${report.citation_delta}`);
  lines.push(`References delta      : ${report.reference_delta >= 0 ? "+" : ""}${report.reference_delta}`);
  if (report.warnings.length) {
    lines.push("\nWarnings:");
    for (const w of report.warnings) lines.push(`  - ${w}`);
  }
  if (report.errors.length) {
    lines.push("\nErrors:");
    for (const e of report.errors) lines.push(`  - ${e}`);
  }
  lines.push(bar);
  return lines.join("\n");
}

import { describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const EXAMPLE_MD = join(import.meta.dir, "../data/example.md");
import { getProfile, loadProfileFromFile, Profile } from "../src/config";
import {
  analyzeText,
  chunkByHeadings,
  compareReports,
  countStructuralElements,
  detectBrokenTables,
  validateRequiredSections,
} from "../src/analyzer";
import { mergeAndStructure } from "../src/cleaner";

const profile = getProfile();

function tmpProfile(data: object): Profile {
  const dir = mkdtempSync(join(tmpdir(), "stilus-test-"));
  const path = join(dir, "profile.json");
  writeFileSync(path, JSON.stringify(data));
  return loadProfileFromFile(path);
}

describe("analyzer", () => {
  it("detects broken lines in sample", () => {
    const raw = readFileSync(EXAMPLE_MD, "utf-8");
    const report = analyzeText(raw, profile);
    expect(report.metrics.words).toBe(72);
    expect(report.metrics.form_feeds).toBe(0);
    expect(report.broken_lines.total).toBe(2);
    expect(report.citations.reference_count).toBe(1);
  });

  it("cleaned sample has no broken lines", () => {
    const raw = readFileSync(EXAMPLE_MD, "utf-8");
    const cleaned = mergeAndStructure(raw, profile);
    const report = analyzeText(cleaned, profile, true);
    expect(report.severity).toBe("ok");
    expect(report.broken_lines.total).toBe(0);
  });

  it("compare tracks word delta", () => {
    const raw = readFileSync(EXAMPLE_MD, "utf-8");
    const src = analyzeText(raw, profile);
    const cln = analyzeText(mergeAndStructure(raw, profile), profile);
    const cmp = compareReports(src, cln, profile);
    expect(cmp.severity).toBe("ok");
    expect(cmp.word_delta).toBe(-2);
    expect(cmp.broken_line_delta).toBeLessThan(0);
  });

  it("strict form feed becomes error", () => {
    const report = analyzeText("BAB 1 - Contoh\n\nIsi halaman.\f\n", profile, true);
    expect(report.severity).toBe("error");
    expect(report.errors[0]).toContain("form feed");
  });

  it("missing reference is always error", () => {
    const report = analyzeText("BAB 1 - Contoh\n\nAda sitasi [2].\n\n1. Referensi Ada\n", profile);
    expect(report.severity).toBe("error");
    expect(report.citations.missing_references).toEqual([2]);
  });

  it("detects table blocks", () => {
    const text = "BAB 1 - Contoh\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\nSelesai.\n";
    const report = analyzeText(text, profile);
    expect(report.table_blocks.length).toBe(1);
    expect(report.table_blocks[0]).toEqual({ start: 3, end: 5 });
  });

  it("strict compare word delta becomes error", () => {
    const src = analyzeText("BAB 1 - Contoh\n\n" + "kata ".repeat(60), profile);
    const cln = analyzeText("BAB 1 - Contoh\n\nkata\n", profile);
    const cmp = compareReports(src, cln, profile, true);
    expect(cmp.severity).toBe("error");
    expect(cmp.errors[0]).toContain("Word delta");
  });

  it("detects ghost chapter", () => {
    const report = analyzeText("BAB 1\n\nIsi singkat.\n", profile);
    expect(report.ghost_chapters.length).toBe(1);
    expect(report.ghost_chapters[0].line).toBe(1);
  });

  it("section heading not flagged as broken line", () => {
    const text = "BAB 1 - Contoh\n\n1.1 Subbab Ini\n\nIni isi paragraf yang cukup panjang.\n";
    const report = analyzeText(text, profile);
    expect(report.broken_lines.items.map(b => b.text)).not.toContain("1.1 Subbab Ini");
  });

  it("table rows not flagged as broken lines", () => {
    const text = "BAB 1 - Contoh\n\n| Kolom A | Kolom B | Kolom C |\n| Data 1 | Data 2 | Data 3 |\n";
    expect(analyzeText(text, profile).broken_lines.total).toBe(0);
  });

  it("short line not flagged as broken", () => {
    expect(analyzeText("BAB 1 - Contoh\n\nPendek.\n", profile).broken_lines.total).toBe(0);
  });

  it("detects unused reference", () => {
    const text = "BAB 1 - Contoh\n\nTidak ada sitasi di sini.\n\n1. Referensi Tidak Terpakai\n";
    expect(analyzeText(text, profile).citations.unused_references).toEqual([1]);
  });

  it("chunk splits by heading", () => {
    const text = "# BAB 1 - Pendahuluan\n\nIsi bab satu.\n\n# BAB 2 - Pembahasan\n\nIsi bab dua.\n";
    const chunks = chunkByHeadings(text, profile);
    expect(chunks.length).toBe(2);
    expect(chunks[0].heading).toBe("BAB 1 - Pendahuluan");
    expect(chunks[1].heading).toBe("BAB 2 - Pembahasan");
  });

  it("chunk front matter before first heading", () => {
    const text = "Teks awal tanpa heading.\n\n# BAB 1 - Mulai\n\nIsi bab.\n";
    const chunks = chunkByHeadings(text, profile);
    expect(chunks.length).toBe(2);
    expect(chunks[0].heading).toBe("FRONT MATTER");
  });

  it("chunk word count includes heading", () => {
    const chunks = chunkByHeadings("# BAB 1 - Contoh\n\nSatu dua tiga empat lima.\n", profile);
    expect(chunks[0].word_count).toBe(10);
  });

  it("chunk sample file", () => {
    const raw = readFileSync(EXAMPLE_MD, "utf-8");
    const chunks = chunkByHeadings(raw, profile);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks.some(c => c.heading.includes("BAB"))).toBe(true);
  });

  it("detectBrokenTables flags numeric rows", () => {
    const result = detectBrokenTables(["BAB 1 - Contoh", "", "10 20 30 40", "5 15 25 35", ""]);
    expect(result.length).toBe(1);
    expect(result[0].start).toBe(3);
  });

  it("detectBrokenTables ignores pipe tables", () => {
    expect(detectBrokenTables(["| A | B | C |", "| 1 | 2 | 3 |", "| 4 | 5 | 6 |", ""]).length).toBe(0);
  });

  it("detectBrokenTables ignores list items", () => {
    expect(detectBrokenTables(["1. Item satu dua tiga empat", "2. Item lima enam tujuh delapan", ""]).length).toBe(0);
  });

  it("analyzeText includes broken_tables", () => {
    const report = analyzeText("BAB 1 - Contoh\n\n10 20 30 40\n5 15 25 35\n\nParagraf normal.\n", profile);
    expect(report.broken_tables.length).toBe(1);
  });

  it("broken table warning in report", () => {
    const report = analyzeText("BAB 1 - Contoh\n\n10 20 30 40\n5 15 25 35\n\nParagraf normal.\n", profile);
    expect([...report.warnings, ...report.errors].some(m => m.includes("broken table"))).toBe(true);
  });

  it("strict broken table becomes error", () => {
    const report = analyzeText("BAB 1 - Contoh\n\n10 20 30 40\n5 15 25 35\n\nParagraf normal.\n", profile, true);
    expect(report.severity).toBe("error");
    expect(report.errors.some(e => e.includes("broken table"))).toBe(true);
  });

  it("compare includes new deltas", () => {
    const src = analyzeText("BAB 1 - Contoh\n\n10 20 30 40\n\nTeks [1].\n\n1. Ref\n", profile);
    const cln = analyzeText("BAB 1 - Contoh\n\n| 10 | 20 | 30 | 40 |\n\nTeks [1].\n\n1. Ref\n", profile);
    const cmp = compareReports(src, cln, profile);
    expect(cmp.broken_table_delta).toBe(-1);
    expect(cmp.table_block_delta).toBe(0);
    expect("citation_delta" in cmp).toBe(true);
  });

  it("subsection not flagged as broken line", () => {
    const text = "BAB 1 - Contoh\n\n1.1 Seksi\n\n1.1.1 Subseksi Ini Cukup Panjang\n\nParagraf.\n";
    const report = analyzeText(text, profile);
    expect(report.broken_lines.items.map(b => b.text)).not.toContain("1.1.1 Subseksi Ini Cukup Panjang");
  });

  it("figure caption not flagged as broken line", () => {
    const text = "BAB 1 - Contoh\n\nGambar 1. Grafik hasil percobaan yang cukup panjang\n\nParagraf.\n";
    expect(analyzeText(text, profile).broken_lines.items.some(b => b.text.includes("Gambar 1"))).toBe(false);
  });

  it("countStructuralElements counts figures and tables", () => {
    const lines = ["Gambar 1. Contoh", "Tabel 1. Data", "Gambar 2. Lainnya", "Paragraf biasa."];
    const result = countStructuralElements(lines, profile);
    expect(result.figures).toBe(2);
    expect(result.table_captions).toBe(1);
    expect(result.footnotes).toBe(0);
  });

  it("countStructuralElements empty patterns return zero", () => {
    const p = tmpProfile({
      name: "minimal",
      chapter_pattern: "^CH \\d+",
      section_pattern: "^\\d+\\.\\d+",
      reference_pattern: "^\\[(\\d+)\\]",
    });
    const result = countStructuralElements(["Gambar 1. Contoh", "Tabel 1. Data"], p);
    expect(result.figures).toBe(0);
    expect(result.table_captions).toBe(0);
  });

  it("validateRequiredSections all present", () => {
    const p = tmpProfile({
      name: "test",
      chapter_pattern: "^(BAB \\d+|DAFTAR ISI|LAMPIRAN)",
      section_pattern: "^\\d+\\.\\d+",
      reference_pattern: "^(\\d+)\\.",
      required_sections: ["DAFTAR ISI", "LAMPIRAN"],
    });
    expect(validateRequiredSections(["DAFTAR ISI", "", "BAB 1 - Isi", "", "LAMPIRAN"], p)).toEqual([]);
  });

  it("validateRequiredSections missing returns them", () => {
    const p = tmpProfile({
      name: "test",
      chapter_pattern: "^(BAB \\d+|DAFTAR ISI|LAMPIRAN)",
      section_pattern: "^\\d+\\.\\d+",
      reference_pattern: "^(\\d+)\\.",
      required_sections: ["DAFTAR ISI", "LAMPIRAN"],
    });
    const missing = validateRequiredSections(["BAB 1 - Isi", ""], p);
    expect(missing).toContain("DAFTAR ISI");
    expect(missing).toContain("LAMPIRAN");
  });

  it("missing required section is error", () => {
    const p = tmpProfile({
      name: "test",
      chapter_pattern: "^BAB \\d+",
      section_pattern: "^\\d+\\.\\d+",
      reference_pattern: "^(\\d+)\\.",
      required_sections: ["LAMPIRAN"],
    });
    const report = analyzeText("BAB 1 - Contoh\n\nIsi.\n", p);
    expect(report.severity).toBe("error");
    expect(report.errors.some(e => e.includes("Required sections"))).toBe(true);
  });

  it("analyzeText includes structural_elements", () => {
    const text = "BAB 1 - Contoh\n\nGambar 1. Contoh gambar.\n\nTabel 1. Data.\n\nIsi.\n";
    const report = analyzeText(text, profile);
    expect(report.structural_elements.figures).toBe(1);
    expect(report.structural_elements.table_captions).toBe(1);
  });

  it("table caption not merged into paragraph", () => {
    const text = "BAB 1 - Contoh\n\nTabel 1 Data Penting\n\n100 200 300\n\nParagraf berikutnya.\n";
    const out = mergeAndStructure(text, profile);
    expect(out).toContain("Tabel 1 Data Penting\n\n");
    expect(out).not.toContain("Tabel 1 Data Penting 100");
  });

  it("figure caption not merged into paragraph", () => {
    const text = "BAB 1 - Contoh\n\nGambar 1 Alur Penelitian\n\nParagraf setelah gambar.\n";
    const out = mergeAndStructure(text, profile);
    expect(out).toContain("Gambar 1 Alur Penelitian\n\n");
    expect(out).not.toContain("Gambar 1 Alur Penelitian Paragraf");
  });
});

import unittest
from pathlib import Path

from manuscript.analyzer import analyze_text, chunk_by_headings, compare_reports, count_structural_elements, detect_broken_tables, validate_required_sections
from manuscript.cleaner import merge_and_structure
from manuscript.config import get_profile


class AnalyzerTests(unittest.TestCase):
    def test_analyze_sample_detects_broken_lines(self):
        raw = Path("data/example.md").read_text(encoding="utf-8")
        report = analyze_text(raw, profile=get_profile())
        self.assertEqual(report["metrics"]["words"], 72)
        self.assertEqual(report["metrics"]["form_feeds"], 0)
        self.assertEqual(report["broken_lines"]["total"], 2)
        self.assertEqual(report["citations"]["reference_count"], 1)

    def test_cleaned_sample_has_no_broken_lines(self):
        raw = Path("data/example.md").read_text(encoding="utf-8")
        cleaned = merge_and_structure(raw, profile=get_profile())
        report = analyze_text(cleaned, profile=get_profile(), strict=True)
        self.assertEqual(report["severity"], "ok")
        self.assertEqual(report["broken_lines"]["total"], 0)

    def test_compare_reports_tracks_word_delta(self):
        raw = Path("data/example.md").read_text(encoding="utf-8")
        source = analyze_text(raw, profile=get_profile())
        clean = analyze_text(merge_and_structure(raw, profile=get_profile()), profile=get_profile())
        comparison = compare_reports(source, clean, profile=get_profile())
        self.assertEqual(comparison["severity"], "ok")
        self.assertEqual(comparison["word_delta"], -2)
        self.assertLess(comparison["broken_line_delta"], 0)

    def test_strict_form_feed_becomes_error(self):
        report = analyze_text("BAB 1 - Contoh\n\nIsi halaman.\f\n", profile=get_profile(), strict=True)
        self.assertEqual(report["severity"], "error")
        self.assertIn("form feed", report["errors"][0])

    def test_missing_reference_is_always_error(self):
        report = analyze_text("BAB 1 - Contoh\n\nAda sitasi [2].\n\n1. Referensi Ada\n", profile=get_profile())
        self.assertEqual(report["severity"], "error")
        self.assertEqual(report["citations"]["missing_references"], [2])

    def test_table_block_detection(self):
        text = "BAB 1 - Contoh\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\nSelesai.\n"
        report = analyze_text(text, profile=get_profile())
        self.assertEqual(len(report["table_blocks"]), 1)
        self.assertEqual(report["table_blocks"][0], {"start": 3, "end": 5})

    def test_strict_compare_word_delta_becomes_error(self):
        source = analyze_text("BAB 1 - Contoh\n\n" + "kata " * 60, profile=get_profile())
        clean = analyze_text("BAB 1 - Contoh\n\nkata\n", profile=get_profile())
        comparison = compare_reports(source, clean, profile=get_profile(), strict=True)
        self.assertEqual(comparison["severity"], "error")
        self.assertIn("Word delta", comparison["errors"][0])

    def test_ghost_chapter_detected(self):
        text = "BAB 1\n\nIsi singkat.\n"
        report = analyze_text(text, profile=get_profile())
        self.assertEqual(len(report["ghost_chapters"]), 1)
        self.assertEqual(report["ghost_chapters"][0]["line"], 1)

    def test_section_heading_not_flagged_as_broken_line(self):
        text = "BAB 1 - Contoh\n\n1.1 Subbab Ini\n\nIni isi paragraf yang cukup panjang.\n"
        report = analyze_text(text, profile=get_profile())
        broken_texts = [b["text"] for b in report["broken_lines"]["items"]]
        self.assertNotIn("1.1 Subbab Ini", broken_texts)

    def test_table_rows_not_flagged_as_broken_lines(self):
        text = "BAB 1 - Contoh\n\n| Kolom A | Kolom B | Kolom C |\n| Data 1 | Data 2 | Data 3 |\n"
        report = analyze_text(text, profile=get_profile())
        self.assertEqual(report["broken_lines"]["total"], 0)

    def test_short_line_not_flagged_as_broken(self):
        text = "BAB 1 - Contoh\n\nPendek.\n"
        report = analyze_text(text, profile=get_profile())
        self.assertEqual(report["broken_lines"]["total"], 0)

    def test_unused_reference_detected(self):
        text = "BAB 1 - Contoh\n\nTidak ada sitasi di sini.\n\n1. Referensi Tidak Terpakai\n"
        report = analyze_text(text, profile=get_profile())
        self.assertEqual(report["citations"]["unused_references"], [1])

    def test_chunk_splits_by_heading(self):
        text = "# BAB 1 - Pendahuluan\n\nIsi bab satu.\n\n# BAB 2 - Pembahasan\n\nIsi bab dua.\n"
        chunks = chunk_by_headings(text, profile=get_profile())
        self.assertEqual(len(chunks), 2)
        self.assertEqual(chunks[0]["heading"], "BAB 1 - Pendahuluan")
        self.assertEqual(chunks[1]["heading"], "BAB 2 - Pembahasan")

    def test_chunk_front_matter_before_first_heading(self):
        text = "Teks awal tanpa heading.\n\n# BAB 1 - Mulai\n\nIsi bab.\n"
        chunks = chunk_by_headings(text, profile=get_profile())
        self.assertEqual(len(chunks), 2)
        self.assertEqual(chunks[0]["heading"], "FRONT MATTER")

    def test_chunk_word_count_includes_heading(self):
        text = "# BAB 1 - Contoh\n\nSatu dua tiga empat lima.\n"
        chunks = chunk_by_headings(text, profile=get_profile())
        self.assertEqual(len(chunks), 1)
        self.assertEqual(chunks[0]["word_count"], 10)

    def test_chunk_sample_file(self):
        from pathlib import Path
        raw = Path("data/example.md").read_text(encoding="utf-8")
        chunks = chunk_by_headings(raw, profile=get_profile())
        self.assertGreaterEqual(len(chunks), 1)
        headings = [c["heading"] for c in chunks]
        self.assertTrue(any("BAB" in h for h in headings))

    def test_detect_broken_tables_flags_numeric_rows(self):
        lines = ["BAB 1 - Contoh", "", "10 20 30 40", "5 15 25 35", ""]
        result = detect_broken_tables(lines)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["start"], 3)

    def test_detect_broken_tables_ignores_pipe_tables(self):
        lines = ["| A | B | C |", "| 1 | 2 | 3 |", "| 4 | 5 | 6 |", ""]
        result = detect_broken_tables(lines)
        self.assertEqual(len(result), 0)

    def test_detect_broken_tables_ignores_list_items(self):
        lines = ["1. Item satu dua tiga empat", "2. Item lima enam tujuh delapan", ""]
        result = detect_broken_tables(lines)
        self.assertEqual(len(result), 0)

    def test_analyze_text_includes_broken_tables(self):
        text = "BAB 1 - Contoh\n\n10 20 30 40\n5 15 25 35\n\nParagraf normal.\n"
        report = analyze_text(text, profile=get_profile())
        self.assertIn("broken_tables", report)
        self.assertEqual(len(report["broken_tables"]), 1)

    def test_broken_table_warning_in_report(self):
        text = "BAB 1 - Contoh\n\n10 20 30 40\n5 15 25 35\n\nParagraf normal.\n"
        report = analyze_text(text, profile=get_profile())
        all_messages = report["warnings"] + report["errors"]
        self.assertTrue(any("broken table" in m for m in all_messages))

    def test_strict_broken_table_becomes_error(self):
        text = "BAB 1 - Contoh\n\n10 20 30 40\n5 15 25 35\n\nParagraf normal.\n"
        report = analyze_text(text, profile=get_profile(), strict=True)
        self.assertEqual(report["severity"], "error")
        self.assertTrue(any("broken table" in e for e in report["errors"]))

    def test_compare_includes_new_deltas(self):
        source = analyze_text("BAB 1 - Contoh\n\n10 20 30 40\n\nTeks [1].\n\n1. Ref\n", profile=get_profile())
        clean = analyze_text("BAB 1 - Contoh\n\n| 10 | 20 | 30 | 40 |\n\nTeks [1].\n\n1. Ref\n", profile=get_profile())
        comparison = compare_reports(source, clean, profile=get_profile())
        self.assertIn("broken_table_delta", comparison)
        self.assertIn("table_block_delta", comparison)
        self.assertIn("citation_delta", comparison)
        # source: numeric table (broken) → 1 broken_table; clean: pipe table → 0 broken_tables
        self.assertEqual(comparison["broken_table_delta"], -1)
        # both files have 1 table_block (numeric heuristic catches source too)
        self.assertEqual(comparison["table_block_delta"], 0)

    def test_subsection_not_flagged_as_broken_line(self):
        text = "BAB 1 - Contoh\n\n1.1 Seksi\n\n1.1.1 Subseksi Ini Cukup Panjang\n\nParagraf.\n"
        report = analyze_text(text, profile=get_profile())
        broken_texts = [b["text"] for b in report["broken_lines"]["items"]]
        self.assertNotIn("1.1.1 Subseksi Ini Cukup Panjang", broken_texts)

    def test_figure_caption_not_flagged_as_broken_line(self):
        text = "BAB 1 - Contoh\n\nGambar 1. Grafik hasil percobaan yang cukup panjang\n\nParagraf.\n"
        report = analyze_text(text, profile=get_profile())
        broken_texts = [b["text"] for b in report["broken_lines"]["items"]]
        self.assertFalse(any("Gambar 1" in t for t in broken_texts))

    def test_count_structural_elements_figures(self):
        lines = ["Gambar 1. Contoh", "Tabel 1. Data", "Gambar 2. Lainnya", "Paragraf biasa."]
        profile = get_profile()
        result = count_structural_elements(lines, profile)
        self.assertEqual(result["figures"], 2)
        self.assertEqual(result["table_captions"], 1)
        self.assertEqual(result["footnotes"], 0)

    def test_count_structural_elements_empty_patterns(self):
        from manuscript.config import Profile
        profile = Profile(
            name="minimal",
            chapter_pattern=r"^CH \d+",
            section_pattern=r"^\d+\.\d+",
            reference_pattern=r"^\[(\d+)\]",
        )
        lines = ["Gambar 1. Contoh", "Tabel 1. Data"]
        result = count_structural_elements(lines, profile)
        self.assertEqual(result["figures"], 0)
        self.assertEqual(result["table_captions"], 0)

    def test_validate_required_sections_all_present(self):
        from manuscript.config import Profile
        profile = Profile(
            name="test",
            chapter_pattern=r"^(BAB \d+|DAFTAR ISI|LAMPIRAN)",
            section_pattern=r"^\d+\.\d+",
            reference_pattern=r"^(\d+)\.",
            required_sections=("DAFTAR ISI", "LAMPIRAN"),
        )
        lines = ["DAFTAR ISI", "", "BAB 1 - Isi", "", "LAMPIRAN"]
        missing = validate_required_sections(lines, profile)
        self.assertEqual(missing, [])

    def test_validate_required_sections_missing(self):
        from manuscript.config import Profile
        profile = Profile(
            name="test",
            chapter_pattern=r"^(BAB \d+|DAFTAR ISI|LAMPIRAN)",
            section_pattern=r"^\d+\.\d+",
            reference_pattern=r"^(\d+)\.",
            required_sections=("DAFTAR ISI", "LAMPIRAN"),
        )
        lines = ["BAB 1 - Isi", ""]
        missing = validate_required_sections(lines, profile)
        self.assertIn("DAFTAR ISI", missing)
        self.assertIn("LAMPIRAN", missing)

    def test_missing_required_section_is_error(self):
        from manuscript.config import Profile
        profile = Profile(
            name="test",
            chapter_pattern=r"^BAB \d+",
            section_pattern=r"^\d+\.\d+",
            reference_pattern=r"^(\d+)\.",
            required_sections=("LAMPIRAN",),
        )
        report = analyze_text("BAB 1 - Contoh\n\nIsi.\n", profile=profile)
        self.assertEqual(report["severity"], "error")
        self.assertTrue(any("Required sections" in e for e in report["errors"]))

    def test_analyze_text_includes_structural_elements(self):
        text = "BAB 1 - Contoh\n\nGambar 1. Contoh gambar.\n\nTabel 1. Data.\n\nIsi.\n"
        report = analyze_text(text, profile=get_profile())
        self.assertIn("structural_elements", report)
        self.assertEqual(report["structural_elements"]["figures"], 1)
        self.assertEqual(report["structural_elements"]["table_captions"], 1)


if __name__ == "__main__":
    unittest.main()

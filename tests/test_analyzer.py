import unittest
from pathlib import Path

from manuscript.analyzer import analyze_text, compare_reports
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


if __name__ == "__main__":
    unittest.main()

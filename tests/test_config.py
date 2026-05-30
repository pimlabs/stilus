import json
import tempfile
import unittest
from pathlib import Path

from manuscript.config import get_profile, list_profiles, load_profile_from_file


class ConfigTests(unittest.TestCase):
    def _write_profile(self, tmpdir, data):
        path = Path(tmpdir) / "profile.json"
        path.write_text(json.dumps(data), encoding="utf-8")
        return str(path)

    def test_get_profile_builtin(self):
        profile = get_profile("indonesian-book")
        self.assertEqual(profile.name, "indonesian-book")

    def test_get_profile_unknown_raises(self):
        with self.assertRaises(ValueError) as ctx:
            get_profile("unknown-profile")
        self.assertIn("Available profiles", str(ctx.exception))

    def test_get_profile_loads_json_by_extension(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = self._write_profile(tmpdir, {
                "name": "custom",
                "chapter_pattern": r"^CHAPTER \d+",
                "section_pattern": r"^\d+\.\d+",
                "reference_pattern": r"^\[(\d+)\]",
            })
            profile = get_profile(path)
            self.assertEqual(profile.name, "custom")
            self.assertEqual(profile.chapter_pattern, r"^CHAPTER \d+")

    def test_profile_optional_fields_use_defaults(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = self._write_profile(tmpdir, {
                "name": "minimal",
                "chapter_pattern": r"^CH \d+",
                "section_pattern": r"^\d+\.\d+",
                "reference_pattern": r"^\[(\d+)\]",
            })
            profile = load_profile_from_file(path)
            self.assertEqual(profile.word_delta_threshold, 50)
            self.assertEqual(profile.broken_line_min_length, 50)

    def test_profile_optional_fields_overridable(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = self._write_profile(tmpdir, {
                "name": "custom",
                "chapter_pattern": r"^CH \d+",
                "section_pattern": r"^\d+\.\d+",
                "reference_pattern": r"^\[(\d+)\]",
                "word_delta_threshold": 100,
                "broken_line_min_length": 40,
            })
            profile = load_profile_from_file(path)
            self.assertEqual(profile.word_delta_threshold, 100)
            self.assertEqual(profile.broken_line_min_length, 40)

    def test_missing_required_field_raises(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = self._write_profile(tmpdir, {
                "name": "incomplete",
                "chapter_pattern": r"^CH \d+",
            })
            with self.assertRaises(ValueError) as ctx:
                load_profile_from_file(path)
            self.assertIn("missing required fields", str(ctx.exception))

    def test_unknown_field_raises(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = self._write_profile(tmpdir, {
                "name": "bad",
                "chapter_pattern": r"^CH \d+",
                "section_pattern": r"^\d+\.\d+",
                "reference_pattern": r"^\[(\d+)\]",
                "typo_field": "oops",
            })
            with self.assertRaises(ValueError) as ctx:
                load_profile_from_file(path)
            self.assertIn("unknown fields", str(ctx.exception))

    def test_custom_profile_used_in_analysis(self):
        from manuscript.analyzer import analyze_text
        with tempfile.TemporaryDirectory() as tmpdir:
            path = self._write_profile(tmpdir, {
                "name": "english-book",
                "chapter_pattern": r"^CHAPTER \d+",
                "section_pattern": r"^\d+\.\d+\s+[A-Z]",
                "reference_pattern": r"^\[(\d+)\]",
            })
            profile = get_profile(path)
            text = "CHAPTER 1 - Introduction\n\nSome content here.\n"
            report = analyze_text(text, profile=profile)
            self.assertEqual(report["severity"], "ok")

    def test_builtin_profile_loads_from_profiles_dir(self):
        profile = get_profile("indonesian-book")
        self.assertIsNotNone(profile.chapter_pattern)
        self.assertIsNotNone(profile.stub_chapter_pattern)
        self.assertIsInstance(profile.sentence_endings, tuple)
        self.assertIsInstance(profile.broken_line_endings, tuple)

    def test_stub_chapter_pattern_in_profile(self):
        profile = get_profile("indonesian-book")
        self.assertIn("BAB", profile.stub_chapter_pattern)

    def test_sentence_endings_overridable(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = self._write_profile(tmpdir, {
                "name": "custom",
                "chapter_pattern": r"^CH \d+",
                "section_pattern": r"^\d+\.\d+",
                "reference_pattern": r"^\[(\d+)\]",
                "sentence_endings": ["。", "？", "！"],
            })
            profile = load_profile_from_file(path)
            self.assertIn("。", profile.sentence_endings)
            self.assertNotIn(".", profile.sentence_endings)

    def test_ghost_chapter_uses_stub_pattern_not_bab(self):
        from manuscript.analyzer import analyze_text
        with tempfile.TemporaryDirectory() as tmpdir:
            path = self._write_profile(tmpdir, {
                "name": "english-book",
                "chapter_pattern": r"^CHAPTER \d+",
                "stub_chapter_pattern": r"^CHAPTER \d+$",
                "section_pattern": r"^\d+\.\d+\s+[A-Z]",
                "reference_pattern": r"^\[(\d+)\]",
            })
            profile = get_profile(path)
            text = "CHAPTER 1\n\nContent here.\n"
            report = analyze_text(text, profile=profile)
            self.assertEqual(len(report["ghost_chapters"]), 1)

    def test_no_stub_pattern_skips_ghost_detection(self):
        from manuscript.analyzer import analyze_text
        with tempfile.TemporaryDirectory() as tmpdir:
            path = self._write_profile(tmpdir, {
                "name": "minimal",
                "chapter_pattern": r"^CH \d+",
                "section_pattern": r"^\d+\.\d+",
                "reference_pattern": r"^\[(\d+)\]",
            })
            profile = get_profile(path)
            text = "CH 1\n\nContent.\n"
            report = analyze_text(text, profile=profile)
            self.assertEqual(len(report["ghost_chapters"]), 0)

    def test_profile_inheritance_extends_builtin(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = self._write_profile(tmpdir, {
                "extends": "indonesian-book",
                "name": "penulis-a",
                "word_delta_threshold": 200,
            })
            profile = load_profile_from_file(path)
            self.assertEqual(profile.name, "penulis-a")
            self.assertEqual(profile.word_delta_threshold, 200)
            # inherited fields from indonesian-book
            self.assertIn("BAB", profile.chapter_pattern)
            self.assertIn("BAB", profile.stub_chapter_pattern)

    def test_profile_inheritance_overrides_field(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = self._write_profile(tmpdir, {
                "extends": "indonesian-book",
                "name": "penulis-b",
                "sentence_endings": [".", "?", "!", "。"],
            })
            profile = load_profile_from_file(path)
            self.assertIn("。", profile.sentence_endings)

    def test_profile_inheritance_typo_still_caught(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = self._write_profile(tmpdir, {
                "extends": "indonesian-book",
                "name": "penulis-c",
                "word_delta_thresold": 100,
            })
            with self.assertRaises(ValueError) as ctx:
                load_profile_from_file(path)
            self.assertIn("unknown fields", str(ctx.exception))

    def test_builtin_profile_has_new_fields(self):
        profile = get_profile("indonesian-book")
        self.assertIsNotNone(profile.figure_pattern)
        self.assertIsNotNone(profile.table_caption_pattern)
        self.assertIsInstance(profile.normalize_em_dash, bool)
        self.assertIsInstance(profile.normalize_space_before_punctuation, bool)
        self.assertIsInstance(profile.required_sections, tuple)

    def test_required_sections_loaded_from_file(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = self._write_profile(tmpdir, {
                "name": "strict-book",
                "chapter_pattern": r"^BAB \d+",
                "section_pattern": r"^\d+\.\d+",
                "reference_pattern": r"^(\d+)\.",
                "required_sections": ["DAFTAR ISI", "LAMPIRAN"],
            })
            profile = load_profile_from_file(path)
            self.assertIn("DAFTAR ISI", profile.required_sections)
            self.assertIn("LAMPIRAN", profile.required_sections)

    def test_list_profiles_returns_all_builtins(self):
        profiles = list_profiles()
        names = [p["name"] for p in profiles]
        self.assertIn("default", names)
        self.assertIn("english-book", names)
        self.assertIn("indonesian-book", names)

    def test_list_profiles_includes_extends(self):
        profiles = list_profiles()
        by_name = {p["name"]: p for p in profiles}
        self.assertIsNone(by_name["default"]["extends"])
        self.assertEqual(by_name["english-book"]["extends"], "default")
        self.assertEqual(by_name["indonesian-book"]["extends"], "default")


if __name__ == "__main__":
    unittest.main()

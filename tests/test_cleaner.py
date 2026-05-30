import unittest
from pathlib import Path

from manuscript.cleaner import merge_and_structure, normalize_text
from manuscript.config import get_profile


class CleanerTests(unittest.TestCase):
    def test_normalize_text_removes_pdf_artifacts(self):
        text = "Halo \f dunia , ini test .\nA -- B"
        self.assertEqual(normalize_text(text), "Halo \n dunia, ini test. \nA — B")

    def test_sample_golden_output(self):
        raw = Path("data/example.md").read_text(encoding="utf-8")
        cleaned = merge_and_structure(raw, profile=get_profile())
        expected = """# BAB 1 - Contoh Naskah

Ini adalah contoh paragraf dari naskah hasil ekstraksi PDF yang sengaja terpotong ke beberapa baris agar bisa dipakai untuk mencoba proses penggabungan paragraf.

## 1.1 Bagian Contoh

Baris ini memiliki spasi yang kurang rapi, dan titik yang terpisah. Script build akan mencoba menormalkan tanda baca dan menyusun ulang paragraf.

- Contoh item daftar pertama
- Contoh item daftar kedua

https://example.com/referensicontoh

1. Sumber Referensi Contoh
"""
        self.assertEqual(cleaned, expected)

    def test_crlf_line_endings_normalized(self):
        text = "BAB 1 - Contoh\r\n\r\nIni paragraf.\r\n"
        cleaned = merge_and_structure(text, profile=get_profile())
        self.assertNotIn("\r", cleaned)
        self.assertIn("Ini paragraf.", cleaned)

    def test_multiple_blank_lines_collapsed(self):
        text = "BAB 1 - Contoh\n\n\n\nIni paragraf.\n"
        cleaned = merge_and_structure(text, profile=get_profile())
        self.assertNotIn("\n\n\n", cleaned)

    def test_form_feed_mid_paragraph_removed(self):
        text = "BAB 1 - Contoh\n\nAwal paragraf.\x0cLanjutan paragraf.\n"
        cleaned = merge_and_structure(text, profile=get_profile())
        self.assertNotIn("\x0c", cleaned)
        self.assertNotIn("\f", cleaned)

    def test_em_dash_normalized_from_double_hyphen(self):
        text = "BAB 1 - Contoh\n\nIni -- itu.\n"
        cleaned = merge_and_structure(text, profile=get_profile())
        self.assertIn(" — ", cleaned)
        self.assertNotIn("--", cleaned)

    def test_space_before_punctuation_removed(self):
        text = "BAB 1 - Contoh\n\nKata-kata yang benar , tidak salah .\n"
        cleaned = merge_and_structure(text, profile=get_profile())
        self.assertIn("benar,", cleaned)
        self.assertIn("salah.", cleaned)

    def test_table_rows_not_merged_into_paragraph(self):
        text = "BAB 1 - Contoh\n\n| Nama | Nilai |\n| Andi | 90 |\n| Budi | 85 |\n"
        cleaned = merge_and_structure(text, profile=get_profile())
        lines = cleaned.splitlines()
        table_lines = [l for l in lines if "|" in l]
        self.assertEqual(len(table_lines), 3)


    def test_normalize_em_dash_disabled(self):
        from manuscript.config import Profile
        profile = Profile(
            name="no-emdash",
            chapter_pattern=r"^CH \d+",
            section_pattern=r"^\d+\.\d+",
            reference_pattern=r"^(\d+)\.",
            normalize_em_dash=False,
        )
        text = "CH 1\n\nA -- B.\n"
        cleaned = merge_and_structure(text, profile=profile)
        self.assertIn("--", cleaned)
        self.assertNotIn(" — ", cleaned)

    def test_normalize_space_before_punctuation_disabled(self):
        from manuscript.config import Profile
        profile = Profile(
            name="no-spacing",
            chapter_pattern=r"^CH \d+",
            section_pattern=r"^\d+\.\d+",
            reference_pattern=r"^(\d+)\.",
            normalize_space_before_punctuation=False,
        )
        text = "CH 1\n\nKata , tanda .\n"
        cleaned = merge_and_structure(text, profile=profile)
        self.assertIn(" ,", cleaned)


if __name__ == "__main__":
    unittest.main()

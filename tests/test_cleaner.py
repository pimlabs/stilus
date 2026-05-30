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


if __name__ == "__main__":
    unittest.main()

import tempfile
import unittest
from pathlib import Path

from manuscript.cli import main


class CliTests(unittest.TestCase):
    def test_inspect_accepts_positional_input(self):
        self.assertEqual(main(["inspect", "data/example.md"]), 0)

    def test_clean_accepts_positional_input_and_short_output(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            output = Path(tmpdir) / "example-clean.md"
            self.assertEqual(main(["clean", "data/example.md", "-o", str(output)]), 0)
            self.assertTrue(output.exists())
            self.assertTrue((Path(tmpdir) / "manifest.json").exists())

    def test_compare_accepts_positional_paths(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            output = Path(tmpdir) / "example-clean.md"
            self.assertEqual(main(["clean", "data/example.md", "-o", str(output)]), 0)
            self.assertEqual(main(["compare", "data/example.md", str(output)]), 0)

    def test_strict_inspect_fails_on_raw_sample(self):
        self.assertEqual(main(["inspect", "data/example.md", "--strict"]), 1)


if __name__ == "__main__":
    unittest.main()

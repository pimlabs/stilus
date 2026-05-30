import contextlib
import io
import tempfile
import unittest
from pathlib import Path

from manuscript.cli import main


def run_cli(args):
    stdout = io.StringIO()
    stderr = io.StringIO()
    with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
        code = main(args)
    return code, stdout.getvalue(), stderr.getvalue()


class CliTests(unittest.TestCase):
    def test_inspect_accepts_positional_input(self):
        code, output, _error = run_cli(["inspect", "data/example.md"])
        self.assertEqual(code, 0)
        self.assertIn("MANUSCRIPT INSPECTION", output)

    def test_clean_accepts_positional_input_and_short_output(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            output = Path(tmpdir) / "example-clean.md"
            code, cli_output, _error = run_cli(["clean", "data/example.md", "-o", str(output)])
            self.assertEqual(code, 0)
            self.assertIn("Severity", cli_output)
            self.assertTrue(output.exists())
            self.assertTrue((Path(tmpdir) / "manifest.json").exists())

    def test_compare_accepts_positional_paths(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            output = Path(tmpdir) / "example-clean.md"
            clean_code, _clean_output, _clean_error = run_cli(
                ["clean", "data/example.md", "-o", str(output)]
            )
            compare_code, compare_output, _compare_error = run_cli(
                ["compare", "data/example.md", str(output)]
            )
            self.assertEqual(clean_code, 0)
            self.assertEqual(compare_code, 0)
            self.assertIn("MANUSCRIPT COMPARISON", compare_output)

    def test_strict_inspect_fails_on_raw_sample(self):
        code, output, _error = run_cli(["inspect", "data/example.md", "--strict"])
        self.assertEqual(code, 1)
        self.assertIn("Errors:", output)

    def test_chunk_writes_files_to_output_dir(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            code, output, _error = run_cli(["chunk", "data/example.md", "-o", tmpdir])
            self.assertEqual(code, 0)
            self.assertIn("MANUSCRIPT CHUNKS", output)
            chunks = list(Path(tmpdir).glob("*.md"))
            self.assertGreaterEqual(len(chunks), 1)

    def test_chunk_json_report_written(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            json_path = Path(tmpdir) / "chunks.json"
            code, _output, _error = run_cli(
                ["chunk", "data/example.md", "-o", tmpdir, "--json", str(json_path)]
            )
            self.assertEqual(code, 0)
            self.assertTrue(json_path.exists())

    def test_clean_dry_run_writes_no_files(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            output = Path(tmpdir) / "out.md"
            code, cli_output, _error = run_cli(
                ["clean", "data/example.md", "-o", str(output), "--dry-run"]
            )
            self.assertEqual(code, 0)
            self.assertFalse(output.exists())
            self.assertIn("Dry run", cli_output)

    def test_clean_dry_run_without_output_flag(self):
        code, cli_output, _error = run_cli(["clean", "data/example.md", "--dry-run"])
        self.assertEqual(code, 0)
        self.assertIn("Dry run", cli_output)

    def test_clean_json_writes_manifest_to_custom_path(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            output = Path(tmpdir) / "out.md"
            json_path = Path(tmpdir) / "result.json"
            code, _output, _error = run_cli(
                ["clean", "data/example.md", "-o", str(output), "--json", str(json_path)]
            )
            self.assertEqual(code, 0)
            self.assertTrue(json_path.exists())
            import json
            data = json.loads(json_path.read_text())
            self.assertIn("severity", data)
            self.assertIn("before", data)

    def test_clean_manifest_flag_overrides_path(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            output = Path(tmpdir) / "out.md"
            manifest = Path(tmpdir) / "custom-manifest.json"
            code, _output, _error = run_cli(
                ["clean", "data/example.md", "-o", str(output), "--manifest", str(manifest)]
            )
            self.assertEqual(code, 0)
            self.assertTrue(manifest.exists())
            self.assertFalse((Path(tmpdir) / "manifest.json").exists())

    def test_error_goes_to_stderr(self):
        code, stdout, stderr = run_cli(["inspect", "nonexistent-file.md"])
        self.assertEqual(code, 1)
        self.assertIn("Error", stderr)
        self.assertEqual(stdout, "")

    def test_profiles_command_lists_profiles(self):
        code, output, _error = run_cli(["profiles"])
        self.assertEqual(code, 0)
        self.assertIn("default", output)
        self.assertIn("english-book", output)
        self.assertIn("indonesian-book", output)

    def test_profiles_command_json(self):
        import json
        code, output, _error = run_cli(["profiles", "--json"])
        self.assertEqual(code, 0)
        data = json.loads(output)
        names = [p["name"] for p in data]
        self.assertIn("default", names)
        self.assertIn("english-book", names)
        self.assertIn("indonesian-book", names)


if __name__ == "__main__":
    unittest.main()

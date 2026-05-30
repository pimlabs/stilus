# Manuscript QA & Cleanup CLI

A small CLI for cleaning, validating, comparing, and reporting on Markdown manuscripts extracted from PDF.

Source manuscript files are stored as local data, e.g. `data/naskah.md` or `data/naskah.pdf`. The `data/` directory is ignored by Git, except for `data/example.md` which ships as a small sample.

## Commands

Inspect a manuscript:

```bash
python3 -m manuscript inspect data/naskah.md
```

Clean a manuscript:

```bash
python3 -m manuscript clean data/naskah.md -o dist/naskah-clean.md
```

Compare source against the cleaned output:

```bash
python3 -m manuscript compare data/naskah.md dist/naskah-clean.md
```

Export a JSON report from inspect:

```bash
python3 -m manuscript inspect dist/naskah-clean.md --json dist/report.json
```

Split a manuscript into per-chapter files:

```bash
python3 -m manuscript chunk data/naskah.md -o dist/chunks/
```

Try the built-in sample:

```bash
python3 -m manuscript inspect --sample
python3 -m manuscript clean --sample
python3 -m manuscript compare data/example.md dist/example-clean.md
```

## Compatibility Wrappers

`build.py` and `analyze.py` remain available as temporary wrappers:

```bash
python3 build.py data/naskah.md -o dist/naskah-clean.md
python3 analyze.py data/naskah.md
```

With sample:

```bash
python3 build.py --sample
python3 analyze.py --sample
```

## Quality Modes

Pass `--strict` to fail with exit code `1` when serious issues are found.

```bash
python3 -m manuscript inspect data/naskah.md --strict
python3 -m manuscript compare data/naskah.md dist/naskah-clean.md --strict
```

Severity levels:

- `ok` — no warnings or errors.
- `warning` — potential issues found, but the command still succeeds.
- `error` — serious issues found; command exits with code `1`.

Exit codes:

- `0` — command succeeded, including when only warnings are present.
- `1` — invalid input, unreadable file, unknown profile, or severity reached `error`.

Without `--strict`, findings like broken lines are reported as `warning`. With `--strict`, key QA findings are elevated to `error`, making it suitable as a final gate before a manuscript is considered clean.

## Profiles

The default profile is `indonesian-book`, which recognizes `BAB`, `PROLOG`, `EPILOG`, `DAFTAR ISI`, and `LAMPIRAN`. It extends the `default` profile — a generic base using standard Markdown heading patterns (`#`, `##`, `###`).

Override the profile with `--profile`:

```bash
python3 -m manuscript inspect data/naskah.md --profile indonesian-book
python3 -m manuscript inspect data/naskah.md --profile profiles/my-profile.json
```

### Custom Profiles

Create a JSON file with at minimum `name`, `chapter_pattern`, `section_pattern`, and `reference_pattern`. Extend an existing built-in to inherit its defaults:

```json
{
  "extends": "indonesian-book",
  "name": "penulis-a",
  "word_delta_threshold": 150,
  "required_sections": ["DAFTAR ISI", "LAMPIRAN"]
}
```

Point `--profile` at a file path for any JSON profile:

```bash
python3 -m manuscript inspect data/naskah.md --profile profiles/penulis-a.json
```

See `PROFILES.md` for the full field reference and profile inheritance documentation.

## Output

The `clean` command writes two files:

- The cleaned Markdown file at the path given by `--output`
- `dist/manifest.json` containing input/output paths, timestamp, before/after metrics, warnings, errors, comparison result, and the profile used

The `chunk` command writes one `.md` file per chapter into the specified output directory.

The `dist/` folder is treated as regeneratable output and is not tracked by Git.

## Large Manuscript Workflow

For large manuscripts, use the explicit workflow below and avoid editing files in `data/` directly:

```bash
python3 -m manuscript inspect data/naskah.md
python3 -m manuscript clean data/naskah.md -o dist/naskah-clean.md
python3 -m manuscript compare data/naskah.md dist/naskah-clean.md
python3 -m manuscript inspect dist/naskah-clean.md --strict
```

If `compare` shows a large word delta or `inspect --strict` fails, review `dist/manifest.json` before proceeding with manual cleanup.

For very long manuscripts, split by chapter first and audit each part:

```bash
python3 -m manuscript chunk data/naskah.md -o dist/chunks/
python3 -m manuscript inspect dist/chunks/01-bab-1.md --strict
```

## Tests

Run all tests:

```bash
python3 -m unittest
```

Acceptance smoke test:

```bash
python3 -m manuscript inspect data/example.md
python3 -m manuscript clean data/example.md -o dist/example-clean.md
python3 -m manuscript compare data/example.md dist/example-clean.md
python3 -m manuscript inspect dist/example-clean.md --json dist/example-report.json
```

## Roadmap

See `ROADMAP.md` for the V1, V2, and V3 direction.

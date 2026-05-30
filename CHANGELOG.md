# Changelog

## Python Prototype (internal development log)

## 0.3.2

- Added `manuscript profiles` subcommand — lists all built-in profiles with their inheritance chain. `--json` flag outputs a structured array for scripting.
- Added `english-book` built-in profile extending `default` — recognizes `CHAPTER`, `INTRODUCTION`, `CONCLUSION`, `PREFACE`, and `APPENDIX` headings with bracketed references `[1]`.
- `list_profiles()` added to `config.py` — reads name and extends from raw JSON without full profile load.
- Added 4 new tests covering `profiles` command output, JSON mode, and `list_profiles()`.

## 0.3.1

**Extended profile system:**

- Profile inheritance via `extends` — child profile overrides individual fields from a named or path-based parent.
- `Profile` gains 7 new optional fields: `subsection_pattern`, `figure_pattern`, `table_caption_pattern`, `footnote_pattern`, `normalize_em_dash`, `normalize_space_before_punctuation`, `required_sections`.
- `is_section_heading` now checks `subsection_pattern` — subsections not flagged as broken lines.
- Figure captions, table captions, and footnotes (if patterns set) are skipped during broken line detection.
- `count_structural_elements` counts figures, table captions, and footnotes per manuscript.
- `validate_required_sections` flags missing required sections as errors.
- Inspection report shows structural element counts and missing required sections when relevant.
- `normalize_text` respects `normalize_em_dash` and `normalize_space_before_punctuation` profile flags.
- `indonesian-book.json` updated with `subsection_pattern`, `figure_pattern` (`Gambar/Figure \d+`), `table_caption_pattern` (`Tabel/Table \d+`), and normalization flags.
- Added 15 new tests covering inheritance, normalization flags, structural elements, required sections, subsection detection.

## 0.3.0

**Profile refactor — engine is now language-agnostic:**

- Built-in profiles moved from hardcoded Python dict to `manuscript/profiles/*.json` — profiles are pure data.
- `Profile` dataclass gains `sentence_endings`, `broken_line_endings`, and `stub_chapter_pattern` fields — all language-specific detection rules now live in the profile.
- `detect_ghost_chapters` uses `stub_chapter_pattern` instead of hardcoded `"BAB"` check — works correctly with any language profile.
- Removed module-level `SENTENCE_ENDINGS` and `BROKEN_LINE_ENDINGS` constants from `analyzer.py`.
- `DEFAULT_PROFILE` constant exported from `config.py` — no more magic strings in CLI.

**Skill-friendly CLI improvements:**

- Errors now written to `stderr` instead of `stdout`.
- `clean` gains `--dry-run` — analyze without writing any files.
- `clean` gains `--json` — write full manifest JSON to a specified path for structured output.
- `clean` gains `--manifest` — override the default `manifest.json` output path.
- `--dry-run` works without `-o/--output`.
- Added 10 new tests: profile from `profiles/` dir, `stub_chapter_pattern`, `sentence_endings` override, ghost chapter with non-Indonesian profile, dry-run behavior, `--json` and `--manifest` on clean, stderr error routing.

## 0.2.2

- Profiles can now be loaded from an external JSON file via `--profile path/to/profile.json`.
- Added `load_profile_from_file()` in config — validates required fields and rejects unknown ones.
- Optional fields (`word_delta_threshold`, `broken_line_min_length`, `paragraph_merge_threshold`) fall back to defaults when omitted.
- Updated `--profile` help text to reflect file path support.
- Added 8 new tests in `test_config.py`: built-in load, file load, optional defaults, optional overrides, missing required field error, unknown field error, integration with analysis.

## 0.2.1

- Added `detect_broken_tables()` — detects numeric-dense rows without pipe separators, a common PDF extraction artifact.
- Inspection report shows a "Broken tables (likely)" count in the Structure section.
- `compare_reports` now returns `broken_table_delta`, `table_block_delta`, and `citation_delta`.
- Compare report output grouped into Word / Table / Reference sections with blank line separators.
- Strict mode raises an error for broken tables.
- Added 8 new tests: broken table detection, warnings, strict mode, and compare deltas.

## 0.2.0

- Added `chunk` command: splits a manuscript by chapter/heading into separate files under an output directory.
- Added `chunk_by_headings()` and `chunk_file()` in analyzer — returns a list of chunks with heading, line range, word count, and text.
- Inspection report now shows broken lines grouped by section when any are found.
- Added chunk tests: split by heading, front matter detection, word count, sample file, CLI output and JSON report.

## 0.1.1

- Improved report labels: "Form feeds" → "Page breaks", "Broken lines" → "Broken lines (likely)", "Ghost chapters" → "Ghost headings", "References" → "References found".
- Inspection report grouped into Metrics / Structure / References sections with blank line separators.
- Missing references now shown inline in the inspection report.
- Warning and error list items indented for readability.
- Added edge-case fixtures: CRLF normalization, multiple blank lines, form feed mid-paragraph, em dash from `--`, space before punctuation, table row isolation, ghost heading detection, section heading false-positive guard, short line guard, unused reference detection.

## 0.1.0

- Baseline `manuscript` CLI package.
- Added `inspect`, `clean`, and `compare` commands.
- Added JSON report support via `inspect --json`.
- Added auto-manifest output on `clean` at `dist/manifest.json`.
- Added compatibility wrappers via `build.py` and `analyze.py`.
- Added `data/example.md` as a tracked sample input.
- Added unit tests for cleaner, analyzer, and CLI behavior.
- Polished CLI tests to capture command output cleanly.
- Added QA edge-case tests for strict mode, citations, table blocks, and word delta.
- Documented strict mode, exit codes, and large manuscript workflow.
- Local manuscript data excluded from Git via `.gitignore`.

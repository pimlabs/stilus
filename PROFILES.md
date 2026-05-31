# Profile Guide

A profile tells the engine how a specific manuscript is structured. Because every author, publisher, and language has different conventions, the profile is the single place where all those rules live. The engine itself has no language assumptions.

## Quick Reference

| Field | Required | What it controls |
|-------|----------|-----------------|
| `name` | ✓ | Profile identifier |
| `chapter_pattern` | ✓ | Chapter heading detection |
| `section_pattern` | ✓ | Section heading detection |
| `reference_pattern` | ✓ | Reference list entry format |
| `extends` | — | Inherit from another profile |
| `subsection_pattern` | — | Sub-section detection (level 3) |
| `stub_chapter_pattern` | — | Ghost heading detection |
| `figure_pattern` | — | Figure caption lines |
| `table_caption_pattern` | — | Table caption lines |
| `footnote_pattern` | — | Footnote lines |
| `sentence_endings` | — | Paragraph completion markers |
| `broken_line_endings` | — | Valid line endings (non-broken) |
| `word_delta_threshold` | — | Max allowed word count change after clean |
| `broken_line_min_length` | — | Min line length to flag as broken |
| `normalize_em_dash` | — | Convert `--` and `—` to ` — ` |
| `normalize_space_before_punctuation` | — | Remove spaces before `,` and `.` |
| `required_sections` | — | Sections that must be present |
| `paragraph_merge_threshold` | — | Reserved for future use |

## Built-in Profiles

Three profiles ship with stilus and are available by name:

| Name | Description |
|------|-------------|
| `default` | Generic base profile. Uses standard Markdown heading patterns (`#`, `##`, `###`). Intended as a base to extend for any language or format. |
| `english-book` | Standard English non-fiction book. Extends `default`. Recognizes `CHAPTER`, `INTRODUCTION`, `CONCLUSION`, `PREFACE`, `APPENDIX`, and bracketed references `[1]`. |
| `indonesian-book` | Standard Indonesian non-fiction book. Extends `default`. Recognizes `BAB`, `PROLOG`, `EPILOG`, `LAMPIRAN`, and numbered sections (`1.1`, `1.1.1`). |

Reference a built-in profile by name in any tool call:

```
inspect(file: "data/naskah.md", profile: "indonesian-book")
```

## Per-Author Profiles

Each author tends to have their own conventions. Scaffold a new profile with the `init` tool:

```
init(name: "penulis-a", extends: "indonesian-book")
```

This writes a starter JSON file. Edit the fields that differ from the base profile, then validate before use:

```
validate_profile(path: "profiles/penulis-a.json")
```

It is practical to keep author profiles alongside the project:

```
data/
  naskah-penulis-a.md
  naskah-penulis-b.md
profiles/
  penulis-a.json
  penulis-b.json
```

## Field Reference

### Required Fields

#### `name`
A unique identifier for the profile. Used in manifest output and logs.

```json
"name": "penulis-a"
```

---

#### `chapter_pattern`
Regex matched against each line to decide if it is a chapter-level heading. The engine uses this to track which section a broken line or citation belongs to.

```json
"chapter_pattern": "^(BAGIAN \\d+|PROLOG|EPILOG|PENUTUP)"
```

Common patterns:

| Convention | Pattern |
|-----------|---------|
| Indonesian numbered (BAB 1, BAB 2) | `^(BAB \\d+\|PROLOG\|EPILOG\|LAMPIRAN)` |
| English numbered (CHAPTER 1) | `^(CHAPTER \\d+\|INTRODUCTION\|CONCLUSION)` |
| Roman numerals (BAB I, BAB II) | `^BAB [IVXLC]+` |
| Author uses all-caps title (PENDAHULUAN) | `^[A-Z ]{5,}$` |

---

#### `section_pattern`
Regex matched against lines to detect sub-section headings (below chapter level). These are not flagged as broken lines.

```json
"section_pattern": "^(\\d+\\.\\d+\\s+[A-Z])"
```

Examples:

| Convention | Pattern |
|-----------|---------|
| Numbered (1.1 Judul) | `^(\\d+\\.\\d+\\s+[A-Z])` |
| Lettered (A. Judul) | `^[A-Z]\\.\\s+[A-Z]` |
| None | `^$` (never matches) |

---

#### `reference_pattern`
Regex used to find reference list entries and extract their numbers. The engine checks that every in-text citation `[N]` has a matching entry.

```json
"reference_pattern": "^(\\d+)\\.\\s+"
```

Examples:

| Convention | Pattern | Example line |
|-----------|---------|--------------|
| Numbered list (1. Author...) | `^(\\d+)\\.\\s+` | `1. Sumber Referensi` |
| Bracketed (\[1\] Author...) | `^\\[(\\d+)\\]` | `[1] Sumber Referensi` |
| No reference list | `^$` (never matches) | — |

---

### Optional Fields

#### `stub_chapter_pattern`
Regex matched against lines to detect chapter headings that look like stubs — a chapter number with no real title. If a line matches this pattern and its title is shorter than 15 characters, it is flagged as a ghost heading.

```json
"stub_chapter_pattern": "^BAB \\d+"
```

Set to `""` (empty string) or omit entirely to disable ghost heading detection.

**When to change:** if the author uses a chapter format like `Bab 1:` or `BAGIAN 1 —` instead of `BAB 1`.

---

#### `sentence_endings`
List of characters that mark the end of a sentence. Used to decide when a paragraph is complete during the merge pass.

```json
"sentence_endings": [".", "?", "!", "\"", "”"]
```

Default: `[".", "?", "!", "\"", "”", "」"]`

**When to change:** for manuscripts using non-standard endings, e.g. Japanese `。` or Arabic `؟`.

---

#### `broken_line_endings`
List of characters that are acceptable at the end of a line. A long line **not** ending with one of these characters is flagged as a likely broken line (a PDF extraction artifact where a paragraph was split mid-sentence).

```json
"broken_line_endings": [".", "?", "!", "\"", "”", ":", "-", "*"]
```

Default: same as `sentence_endings` plus `":"`, `"-"`, `"*"`.

**When to change:** if the author frequently ends lines with `)` or `»` or other punctuation that is valid in their style.

---

#### `word_delta_threshold`
Maximum allowed word count change between source and cleaned output. Exceeding this threshold raises a warning (or error in strict mode). Useful to catch accidental content loss during cleaning.

```json
"word_delta_threshold": 100
```

Default: `50`. Set higher for long manuscripts with many list items (which get merged) or lower for manuscripts where any word loss is suspicious.

---

#### `broken_line_min_length`
Minimum character length a line must have before it can be flagged as a broken line. Short lines (headers, single words, numbers) are never flagged regardless of their ending.

```json
"broken_line_min_length": 40
```

Default: `50`. Decrease if the author writes shorter sentences that still get broken by PDF extraction.

---

#### `subsection_pattern`
Regex for sub-sections below the section level (level 3). Lines matching this are not flagged as broken lines.

```json
"subsection_pattern": "^(\\d+\\.\\d+\\.\\d+\\s+[A-Z])"
```

Default: `""` (disabled).

---

#### `figure_pattern`
Regex matching figure caption lines (e.g. `Gambar 1.`, `Figure 2:`). Matching lines are excluded from broken line detection and counted in the inspection report.

```json
"figure_pattern": "^(Gambar|Figure)\\s+\\d+"
```

Default: `""` (disabled).

---

#### `table_caption_pattern`
Regex matching table caption lines. Matching lines are excluded from broken line detection and counted in the inspection report.

```json
"table_caption_pattern": "^(Tabel|Table)\\s+\\d+"
```

Default: `""` (disabled).

---

#### `footnote_pattern`
Regex matching footnote lines. Matching lines are excluded from broken line detection and counted in the inspection report.

```json
"footnote_pattern": "^\\d+\\s+[A-Z]"
```

Default: `""` (disabled).

---

#### `normalize_em_dash`
If `true`, the cleaner converts `--` and spaced `—` into a consistent ` — ` form.

Default: `true`. Set `false` to preserve the author's original dash style.

---

#### `normalize_space_before_punctuation`
If `true`, the cleaner removes spaces before `,` and `.` (common PDF extraction artifact).

Default: `true`. Set `false` if the source uses intentional spacing before punctuation.

---

#### `required_sections`
List of section names that must be present in the manuscript. Missing entries are reported as errors.

```json
"required_sections": ["DAFTAR ISI", "LAMPIRAN"]
```

Default: `[]` (no required sections).

---

#### `paragraph_merge_threshold`
Reserved for future use. Minimum character threshold for paragraph merge decisions.

Default: `75`.

---

## Profile Inheritance

A profile can extend another profile and override only the fields that differ. This is ideal for per-author profiles that share most settings with a base profile.

```json
{
  "extends": "indonesian-book",
  "name": "penulis-a",
  "word_delta_threshold": 150,
  "broken_line_endings": [".", "?", "!", ":", "-", ")"],
  "required_sections": ["DAFTAR ISI", "LAMPIRAN"]
}
```

`extends` accepts a built-in profile name or a path to another JSON file. All fields not listed in the child profile are inherited from the parent. Unknown fields are still caught as errors.

---

## Creating a Profile for a New Author

Start by inspecting a raw manuscript to observe the patterns:

```
inspect(file: "data/naskah-penulis-baru.md")
```

Look at the output — ghost headings, broken lines, citation mismatches? Scaffold a starter profile:

```
init(name: "penulis-baru", extends: "indonesian-book", output: "profiles/penulis-baru.json")
```

Edit the generated JSON, then validate:

```
validate_profile(path: "profiles/penulis-baru.json")
```

Run clean and compare to verify the result:

```
clean(file: "data/naskah-penulis-baru.md", output: "dist/penulis-baru-clean.md", profile: "profiles/penulis-baru.json")
compare(source: "data/naskah-penulis-baru.md", clean: "dist/penulis-baru-clean.md", profile: "profiles/penulis-baru.json")
```

Iterate until `inspect(strict: true)` passes cleanly.

## Profile Validation

The engine validates every profile on load. A profile file with missing required fields or unrecognized keys raises an error immediately — before any processing starts.

```
validate_profile(path: "profiles/my-profile.json")
# → Error: missing required fields: ["chapter_pattern"]
# → Error: unknown fields: ["chapter_pattrn"]
```

# @pimlabs/stilus

CLI for manuscript QA — inspect, clean, compare, and chunk Markdown manuscripts.

## Installation

```bash
# Run without installing
bunx @pimlabs/stilus <command>

# Install globally
bun install -g @pimlabs/stilus
# or
npm install -g @pimlabs/stilus
```

**Requires:** [Bun](https://bun.sh) ≥ 1.0

## Commands

### `inspect` — analyze a manuscript

```bash
stilus inspect <file> [--profile <name|path>] [--strict] [--json]
```

Runs QA analysis and prints a full report: word/line counts, broken lines, ghost headings, citations, missing sections.

```
stilus inspect manuscript.md
```

```
======================================================================
MANUSCRIPT INSPECTION
======================================================================
Severity              : ok

Characters            : 142,340
Words                 : 24,516
Lines                 : 3,201
Empty line ratio      : 18.3%

Page breaks           : 0
Table blocks          : 4
Broken tables (likely): 0
Broken lines (likely) : 7
Ghost headings        : 0

Citations             : 42
References found      : 38
Missing references    : ["Smith2019","Jones2021"]
======================================================================
```

Exit code `1` if severity is `error`.

---

### `clean` — fix broken lines and normalize formatting

```bash
stilus clean <file> <output> [--profile <name|path>] [--strict] [--dry-run] [--json]
```

Merges broken lines, normalizes punctuation spacing, em-dashes. Writes cleaned file and a `<output>.manifest.json` alongside it.

```
stilus clean draft.md clean.md
stilus clean draft.md clean.md --dry-run   # preview only, no files written
```

```
Cleaned: draft.md → clean.md
  Words        : 24,516 → 24,514 (Δ-2)
  Broken lines : 7 → 0
  Severity     : ok
```

---

### `compare` — diff two manuscript versions

```bash
stilus compare <source> <clean> [--profile <name|path>] [--strict] [--json]
```

Shows word, character, heading, citation, and broken-line deltas between two files.

```
stilus compare draft.md clean.md
```

```
======================================================================
MANUSCRIPT COMPARISON
======================================================================
Severity              : ok

Character delta       : -12
Word delta            : -2

Table blocks delta    : +0
Broken tables delta   : +0
Broken lines delta    : -7

Citations delta       : +0
References delta      : +0
======================================================================
```

---

### `chunk` — split manuscript into per-chapter files

```bash
stilus chunk <file> <output-dir> [--profile <name|path>]
```

Splits by chapter headings, writes one `.md` file per chapter into `output-dir`.

```
stilus chunk manuscript.md ./chapters/
```

```
======================================================================
MANUSCRIPT CHUNKS: ./chapters/
======================================================================
Total chunks          : 12
Total words           : 24,514

  00  00-introduction.md                      1,204 words  (lines 1–87)
  01  01-background.md                        2,018 words  (lines 89–201)
  ...
======================================================================
```

---

### `profiles` — list available profiles

```bash
stilus profiles [--json]
```

```
Available profiles:
  default
  english-book  (extends: default)
  indonesian-book  (extends: default)
```

---

### `init` — scaffold a custom profile

```bash
stilus init <name> <output.json> [--extends <profile>]
```

Creates a JSON profile scaffold you can customize.

```
stilus init my-novel profile.json --extends default
```

Then use it with any command:

```
stilus inspect manuscript.md --profile ./profile.json
```

---

### `validate` — check a profile file

```bash
stilus validate <profile.json>
```

Validates a profile file for correctness. Exits `1` if invalid.

---

## Profiles

Built-in profiles: `default`, `english-book`, `indonesian-book`.

The `--profile` flag accepts either a built-in name or a path to a `.json` file:

```bash
stilus inspect manuscript.md --profile english-book
stilus inspect manuscript.md --profile ./my-profile.json
```

---

## Flags

| Flag | Commands | Description |
|------|----------|-------------|
| `--profile <name\|path>` | all except `profiles`, `init`, `validate` | Profile to use |
| `--strict` | `inspect`, `clean`, `compare` | Treat warnings as errors |
| `--dry-run` | `clean` | Analyze without writing any files |
| `--json` | `inspect`, `clean`, `compare`, `profiles` | Output raw JSON |

---

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Error (QA severity = error, or runtime exception) |
| `2` | Bad arguments |

---

## Also available as MCP

For use with Claude, see [`@pimlabs/stilus-mcp`](https://www.npmjs.com/package/@pimlabs/stilus-mcp).

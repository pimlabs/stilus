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

## Typical Workflow

```bash
stilus inspect manuscript.md                      # 1. QA check
stilus clean manuscript.md                        # 2. fix → manuscript-clean.md
stilus compare manuscript.md manuscript-clean.md  # 3. verify changes
stilus chunk manuscript-clean.md                  # 4. split → manuscript-clean-chunks/
```

---

## Commands

### `inspect` — analyze a manuscript

```bash
stilus inspect <file> [--profile <name|path>] [--strict] [--json]
```

Runs QA analysis: word/line counts, broken lines, ghost headings, citations, missing sections.

```
stilus inspect manuscript.md
stilus inspect manuscript.md --profile english-book --json
```

Exit code `1` if severity is `error`.

---

### `clean` — fix broken lines and normalize formatting

```bash
stilus clean <file> [output] [--profile <name|path>] [--strict] [--dry-run] [--json]
```

Merges broken lines, normalizes punctuation and em-dashes. Output defaults to `<file>-clean.md` in the same directory.

```bash
stilus clean draft.md                  # → draft-clean.md
stilus clean draft.md revised.md       # explicit output
stilus clean draft.md --dry-run        # preview only, no files written
```

Also writes `<output>.manifest.json` with full before/after report.

---

### `compare` — diff two manuscript versions

```bash
stilus compare <before> <after> [--profile <name|path>] [--strict] [--json]
```

Shows word, character, heading, citation, and broken-line deltas.

```bash
stilus compare manuscript.md manuscript-clean.md
```

---

### `chunk` — split manuscript into per-chapter files

```bash
stilus chunk <file> [output-dir] [--profile <name|path>]
```

Splits by chapter headings, one `.md` file per chapter. Output dir defaults to `<file>-chunks/` in the same directory.

```bash
stilus chunk manuscript.md            # → manuscript-chunks/
stilus chunk manuscript.md ./chapters/  # explicit dir
```

---

### `profile` — manage profiles

```bash
stilus profile [list]                          List available profiles
stilus profile init <name> [output]            Scaffold new profile JSON
stilus profile validate <path>                 Validate a profile file
```

```bash
stilus profile                                 # list profiles
stilus profile list --json
stilus profile init my-novel                   # → my-novel.json
stilus profile init my-novel profiles/my.json  # explicit path
stilus profile init my-novel --extends default
stilus profile validate ./my-novel.json
stilus profile --help                          # profile-specific help
```

---

## Profiles

Built-in profiles: `default`, `english-book`, `indonesian-book`.

`--profile` accepts a built-in name or a path to a `.json` file:

```bash
stilus inspect manuscript.md --profile english-book
stilus inspect manuscript.md --profile ./my-profile.json
```

Custom profile minimum (extending a built-in):

```json
{
  "extends": "indonesian-book",
  "name": "my-author",
  "word_delta_threshold": 150,
  "required_sections": ["DAFTAR ISI", "LAMPIRAN"]
}
```

See [PROFILES.md](../../PROFILES.md) for the full field reference.

---

## Flags

| Flag | Commands | Description |
|------|----------|-------------|
| `--profile <name\|path>` | inspect, clean, compare, chunk | Profile to use |
| `--strict` | inspect, clean, compare | Treat warnings as errors |
| `--dry-run` | clean | Analyze without writing files |
| `--json` | inspect, clean, compare, profile list | Output raw JSON |
| `--extends <name>` | profile init | Profile to extend |

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

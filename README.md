# stilus

Manuscript QA & cleanup MCP for Claude. Analyzes, cleans, chunks, and compares Markdown manuscripts — built for documents extracted from PDF where paragraphs are broken across lines, form feeds litter the text, and citations need cross-checking.

## Prerequisites

[Bun](https://bun.sh) is required:

```bash
curl -fsSL https://bun.sh/install | bash
```

## Quick Start

### CLI

```bash
bunx @pimlabs/stilus inspect manuscript.md
bunx @pimlabs/stilus clean draft.md clean.md
bunx @pimlabs/stilus chunk manuscript.md ./chapters/
```

See [packages/cli/README.md](packages/cli/README.md) for full CLI docs.

### MCP (Claude integration)

Add to your Claude Desktop or Claude Code MCP config:

```json
{
  "mcpServers": {
    "stilus": {
      "command": "bunx",
      "args": ["-y", "@pimlabs/stilus-mcp"]
    }
  }
}
```

Restart Claude. Verify it's connected:

> "List available stilus profiles."

Claude should respond with the three built-in profiles.

## Usage

Talk to Claude naturally. Use absolute paths or paths relative to Claude's working directory:

```
Inspect /Users/me/manuscripts/naskah.md using the indonesian-book profile.

Clean /Users/me/manuscripts/naskah.md and save to /Users/me/manuscripts/dist/clean.md.

Compare /Users/me/manuscripts/naskah.md with /Users/me/manuscripts/dist/clean.md.

Chunk /Users/me/manuscripts/dist/clean.md into /Users/me/manuscripts/dist/chunks/.
```

## Tools

| Tool | Parameters | Description |
|------|-----------|-------------|
| `inspect` | `file`, `profile?`, `strict?` | Analyze manuscript — word count, broken lines, citations, structural elements |
| `clean` | `file`, `output`, `profile?`, `dry_run?` | Merge broken paragraph lines, normalize em-dash and punctuation, write manifest |
| `compare` | `source`, `clean`, `profile?`, `strict?` | Before/after deltas — words, broken lines, citations, tables |
| `chunk` | `file`, `output_dir`, `profile?` | Split into per-chapter `.md` files |
| `profiles` | — | List built-in profiles with inheritance chain |
| `init` | `name`, `output?`, `extends?` | Scaffold a new profile JSON file |
| `validate_profile` | `path` | Validate a profile file before running it on a manuscript |

### Example: inspect output

```
======================================================================
MANUSCRIPT INSPECTION
======================================================================
Severity              : warning

Characters            : 487,203
Words                 : 82,941
Lines                 : 9,847
Empty line ratio      : 34.2%

Page breaks           : 0
Table blocks          : 12
Broken tables (likely): 3
Broken lines (likely) : 149
Ghost headings        : 0

Figures               : 24
Table captions        : 18

Citations             : 47
References found      : 47

Broken lines by section:
   39  7.5 Implikasi untuk Indonesia
   18  BAB 6 - Strategi Implementasi
    9  BAB 3 - Landasan Teori

Warnings:
  - Found 149 likely broken lines.
  - Found 3 possible broken table(s) (numeric rows without pipe separators).
======================================================================
```

## Profiles

Default: `indonesian-book`. Three built-ins ship with stilus:

| Profile | Description |
|---------|-------------|
| `default` | Generic base. Standard Markdown headings (`#`, `##`, `###`). Extend this for any language. |
| `english-book` | English non-fiction. Recognizes `CHAPTER`, `INTRODUCTION`, `CONCLUSION`, `APPENDIX`, bracketed refs `[1]`. |
| `indonesian-book` | Indonesian non-fiction. Recognizes `BAB`, `PROLOG`, `EPILOG`, `LAMPIRAN`, numbered sections (`1.1`, `1.1.1`). |

### Custom profiles

Scaffold with `init`, then edit the output JSON:

```
init(name: "my-author", extends: "indonesian-book", output: "profiles/my-author.json")
```

Minimum required fields: `name`, `chapter_pattern`, `section_pattern`, `reference_pattern`. Extend a built-in to inherit everything else:

```json
{
  "extends": "indonesian-book",
  "name": "my-author",
  "word_delta_threshold": 150,
  "required_sections": ["DAFTAR ISI", "LAMPIRAN"]
}
```

Validate before use:

```
validate_profile(path: "profiles/my-author.json")
```

See [PROFILES.md](PROFILES.md) for the full field reference.

## Severity

Every tool returns a `severity` field:

- `ok` — no warnings or errors
- `warning` — potential issues found, command still succeeded
- `error` — serious issues; review before proceeding

Pass `strict: true` to elevate warnings to errors (useful as a final quality gate before handing off a manuscript).

## Output Files

`clean` writes two files:
- Cleaned Markdown at the path given by `output`
- `manifest.json` in the same directory — full before/after report, metrics, comparison deltas, warnings, and profile used

`chunk` writes one `.md` file per chapter into `output_dir`.

## Development

```bash
bun test              # run 50 tests
bun run bundle        # build both packages/mcp/dist/stilus-mcp and packages/cli/dist/stilus
```

See [CLAUDE.md](CLAUDE.md) for release flow and project gotchas.

## Links

- npm CLI: [@pimlabs/stilus](https://www.npmjs.com/package/@pimlabs/stilus)
- npm MCP: [@pimlabs/stilus-mcp](https://www.npmjs.com/package/@pimlabs/stilus-mcp)
- GitHub: [pimlabs/stilus](https://github.com/pimlabs/stilus)
- Roadmap: [ROADMAP.md](ROADMAP.md)

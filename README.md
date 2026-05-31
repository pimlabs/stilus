# stilus

Manuscript QA & cleanup MCP for Claude. Analyzes, cleans, chunks, and compares Markdown manuscripts from PDF extraction.

## Quick Start

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

Requires [Bun](https://bun.sh). Then ask Claude to inspect, clean, or chunk your manuscript.

## Tools

| Tool | Description |
|------|-------------|
| `inspect` | Analyze a manuscript — returns word count, broken lines, citations, structural elements |
| `clean` | Merge broken paragraph lines, normalize em-dash and punctuation spacing |
| `compare` | Compare source vs. cleaned manuscript, report word/citation/broken-line deltas |
| `chunk` | Split a manuscript into per-chapter `.md` files |
| `profiles` | List all built-in profiles with their inheritance chain |
| `init` | Scaffold a new profile JSON file |
| `validate_profile` | Validate a profile file without running it on a manuscript |

### Example usage

```
Inspect data/naskah.md using the indonesian-book profile.

Clean data/naskah.md → dist/naskah-clean.md, then compare them.

Chunk data/naskah.md into dist/chunks/.
```

## Profiles

The default profile is `indonesian-book`, which recognizes `BAB`, `PROLOG`, `EPILOG`, `DAFTAR ISI`, and `LAMPIRAN`. It extends `default` — a generic base using standard Markdown heading patterns (`#`, `##`, `###`).

Pass `profile` to any tool to override:

```
inspect file="data/naskah.md" profile="indonesian-book"
inspect file="data/naskah.md" profile="profiles/my-profile.json"
```

### Custom profiles

A profile JSON needs at minimum `name`, `chapter_pattern`, `section_pattern`, and `reference_pattern`. Extend an existing built-in to inherit defaults:

```json
{
  "extends": "indonesian-book",
  "name": "penulis-a",
  "word_delta_threshold": 150,
  "required_sections": ["DAFTAR ISI", "LAMPIRAN"]
}
```

Use `init` to scaffold a new profile, then `validate_profile` to check it before use.

See `PROFILES.md` for the full field reference.

## Severity

Every tool returns a `severity` field:

- `ok` — no warnings or errors
- `warning` — potential issues found, command still succeeded
- `error` — serious issues; review before proceeding

Pass `strict: true` to elevate warnings to errors (useful as a final gate).

## Output

`clean` writes two files:
- The cleaned Markdown at the path given by `output`
- `manifest.json` in the same directory — input/output paths, timestamp, before/after metrics, warnings, comparison result, and profile used

`chunk` writes one `.md` file per chapter into the specified output directory.

## Development

```bash
bun test          # run 50 tests
bun run bundle    # bundle stilus-mcp → packages/mcp/dist/index.js
```

Source is under `packages/core/` (engine) and `packages/mcp/` (MCP server).

Manuscript source files live in `data/` — not tracked by Git except for `packages/core/data/example.md` (test fixture).

## Roadmap

See [ROADMAP.md](ROADMAP.md).

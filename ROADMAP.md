# Roadmap

## Foundation — Python Prototype

Status: complete, not publicly released.

- Core commands: `inspect`, `clean`, `compare`, `chunk`, `profiles`.
- Language-agnostic engine — all detection rules live in profiles.
- Profile system: JSON files, inheritance via `extends`, built-in profiles (`default`, `english-book`, `indonesian-book`).
- MCP-ready CLI: errors to stderr, `--dry-run`, `--json`, `--manifest`, structured JSON output on every command.
- 74 tests, all passing.

## V1 — TypeScript MCP Skill

Status: complete.

Native MCP server. Claude invokes tools directly — no manual CLI commands needed.

**Tools (all implemented):**
- `inspect(file, profile)` — analyze a manuscript, return structured report
- `clean(file, output, profile, dry_run)` — clean and return manifest
- `compare(source, clean, profile)` — compare before/after
- `chunk(file, output_dir, profile)` — split into per-chapter files
- `profiles()` — list available built-in profiles
- `init(name, output, extends)` — scaffold a new profile JSON
- `validate_profile(path)` — validate a profile file without running it on a manuscript

**Engine:**
- Regex-based detection (line-level analysis)
- Markdown AST via `remark`/`unified` deferred to V2

## V1.1 — npm Distribution

Status: complete.

- Bundled as single self-contained JS file via `bun build --bundle`
- Published to npm as `stilus-mcp`
- Users add one line to Claude Desktop / Claude Code MCP config:

```json
{
  "mcpServers": {
    "stilus": {
      "command": "bunx",
      "args": ["-y", "stilus-mcp"]
    }
  }
}
```

## V2 — Ecosystem

Status: deferred.

- Markdown AST engine via `remark`/`unified` — deeper structural analysis
- VS Code extension — live QA while editing a manuscript
- Obsidian plugin — if there is demand

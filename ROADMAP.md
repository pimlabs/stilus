# Roadmap

## Foundation — Python Prototype

Status: complete, not publicly released.

- Core commands: `inspect`, `clean`, `compare`, `chunk`, `profiles`.
- Language-agnostic engine — all detection rules live in profiles.
- Profile system: JSON files, inheritance via `extends`, built-in profiles (`default`, `english-book`, `indonesian-book`).
- MCP-ready CLI: errors to stderr, `--dry-run`, `--json`, `--manifest`, structured JSON output on every command.
- 74 tests, all passing.

## V1 — TypeScript MCP Skill

Status: planned.

Full rewrite as a native MCP server. Claude invokes tools directly — no manual CLI commands needed.

**Tools:**
- `manuscript_inspect(file, profile)` — analyze a manuscript, return structured report
- `manuscript_clean(file, output, profile, dry_run)` — clean and return manifest
- `manuscript_compare(source, clean, profile)` — compare before/after
- `manuscript_chunk(file, output_dir, profile)` — split into per-chapter files
- `manuscript_profiles()` — list available built-in profiles
- `manuscript_init(name, extends)` — scaffold a new profile JSON
- `manuscript_validate_profile(path)` — validate a profile file without running it on a manuscript

**Distribution:**
- Technical users: `npx manuscript-mcp` + one MCP config entry
- Non-technical users: single binary via `bun build --compile`

**Engine:**
- Markdown AST via `remark`/`unified` — more accurate than regex-based detection
- Same command contract as the Python prototype

## V2 — Ecosystem

Status: deferred.

- VS Code extension — live QA while editing a manuscript
- Obsidian plugin — if there is demand

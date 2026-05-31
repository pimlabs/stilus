import { parseArgs } from "./args.ts";
import { run as runChunk } from "./commands/chunk.ts";
import { run as runClean } from "./commands/clean.ts";
import { run as runCompare } from "./commands/compare.ts";
import { run as runInspect } from "./commands/inspect.ts";
import { run as runProfile } from "./commands/profile.ts";

const HELP = `
stilus — manuscript QA toolkit

Usage:
  stilus <command> [args] [flags]

Commands:
  inspect  <file>                Analyze manuscript, show QA report
  clean    <file> [output]       Merge broken lines, normalize formatting
  compare  <before> <after>      Show deltas between two manuscripts
  chunk    <file> [output-dir]   Split manuscript into per-chapter files
  profile  [list|init|validate]  Manage profiles

Flags:
  --profile <name|path>      Built-in profile name or path to .json
  --strict                   Elevate warnings to errors
  --dry-run                  (clean) Analyze without writing files
  --json                     Output raw JSON instead of formatted text

Typical workflow:
  stilus inspect manuscript.md                     # 1. QA check
  stilus clean manuscript.md                       # 2. fix broken lines → manuscript-clean.md
  stilus compare manuscript.md manuscript-clean.md # 3. verify changes
  stilus chunk manuscript-clean.md                 # 4. split → manuscript-clean-chunks/

Examples:
  stilus inspect manuscript.md --profile english-book
  stilus clean draft.md --strict --dry-run
  stilus chunk manuscript.md ./chapters/
  stilus profile list
  stilus profile init my-novel --extends default
  stilus profile --help
`.trim();

const commands: Record<
  string,
  (positional: string[], flags: Record<string, string | boolean>) => Promise<void>
> = {
  inspect: runInspect,
  clean: runClean,
  compare: runCompare,
  chunk: runChunk,
  profile: runProfile,
};

const { command, positional, flags } = parseArgs(process.argv);

if (!command || command === "help") {
  console.log(HELP);
  process.exit(0);
}

// profile handles its own --help (subcommand-specific text)
if (flags.help === true && command !== "profile") {
  console.log(HELP);
  process.exit(0);
}

const handler = commands[command];
if (!handler) {
  console.error(`Unknown command: ${command}`);
  console.error(`Run "stilus --help" for usage.`);
  process.exit(2);
}

try {
  await handler(positional, flags);
} catch (err) {
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

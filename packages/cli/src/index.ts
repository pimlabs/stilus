import { parseArgs } from "./args.ts";
import { run as runChunk } from "./commands/chunk.ts";
import { run as runClean } from "./commands/clean.ts";
import { run as runCompare } from "./commands/compare.ts";
import { run as runInit } from "./commands/init.ts";
import { run as runInspect } from "./commands/inspect.ts";
import { run as runProfiles } from "./commands/profiles.ts";
import { run as runValidate } from "./commands/validate.ts";

const HELP = `
stilus — manuscript QA toolkit

Usage:
  stilus <command> [args] [flags]

Commands:
  inspect  <file>            Analyze manuscript, show QA report
  clean    <file> <output>   Merge broken lines, normalize formatting
  compare  <source> <clean>  Show deltas between two manuscripts
  chunk    <file> <dir>      Split manuscript into per-chapter files
  profiles                   List available profiles
  init     <name> <output>   Scaffold a new profile JSON
  validate <profile.json>    Validate a profile file

Flags:
  --profile <name|path>      Built-in profile name or path to .json
  --strict                   Elevate warnings to errors
  --dry-run                  (clean) Analyze without writing files
  --json                     Output raw JSON instead of formatted text

Examples:
  stilus inspect manuscript.md
  stilus inspect manuscript.md --profile english-book --json
  stilus clean draft.md clean.md --dry-run
  stilus chunk manuscript.md ./chapters/
  stilus init my-profile profile.json --extends default
`.trim();

const commands: Record<
  string,
  (positional: string[], flags: Record<string, string | boolean>) => Promise<void>
> = {
  inspect: runInspect,
  clean: runClean,
  compare: runCompare,
  chunk: runChunk,
  profiles: runProfiles,
  init: runInit,
  validate: runValidate,
};

const { command, positional, flags } = parseArgs(process.argv);

if (!command || flags.help === true || command === "help") {
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

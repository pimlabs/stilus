export interface ParsedArgs {
  command: string | undefined;
  positional: string[];
  flags: Record<string, string | boolean>;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2); // strip node/bun + script path
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  let i = 0;
  let command: string | undefined;

  while (i < args.length) {
    const arg = args[i];

    if (arg.startsWith("--")) {
      const eqIdx = arg.indexOf("=");
      if (eqIdx !== -1) {
        // --flag=value
        const key = arg.slice(2, eqIdx);
        flags[key] = arg.slice(eqIdx + 1);
      } else {
        const key = arg.slice(2);
        const next = args[i + 1];
        if (next !== undefined && !next.startsWith("--")) {
          // --flag value (only if next is not a flag)
          flags[key] = next;
          i++;
        } else {
          // --flag (boolean)
          flags[key] = true;
        }
      }
    } else if (command === undefined) {
      command = arg;
    } else {
      positional.push(arg);
    }

    i++;
  }

  return { command, positional, flags };
}

export function die(msg: string, code = 2): never {
  console.error(`Error: ${msg}`);
  process.exit(code);
}

import { analyzeFile, DEFAULT_PROFILE, formatInspection, getProfile } from "@stilus/core";
import { die } from "../args.ts";

export async function run(positional: string[], flags: Record<string, string | boolean>): Promise<void> {
  const [file] = positional;
  if (!file) die("inspect requires <file>");

  const profile = getProfile((flags.profile as string | undefined) ?? DEFAULT_PROFILE);
  const strict = flags.strict === true;
  const json = flags.json === true;

  const report = analyzeFile(file, profile, strict);

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatInspection(report));
  }

  if (report.severity === "error") process.exit(1);
}

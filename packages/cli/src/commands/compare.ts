import { compareFiles, DEFAULT_PROFILE, formatCompare, getProfile } from "@stilus/core";
import { die } from "../args.ts";

export async function run(positional: string[], flags: Record<string, string | boolean>): Promise<void> {
  const [source, clean] = positional;
  if (!source || !clean) die("compare requires <source> <clean>");

  const profile = getProfile((flags.profile as string | undefined) ?? DEFAULT_PROFILE);
  const strict = flags.strict === true;
  const json = flags.json === true;

  const report = compareFiles(source, clean, profile, strict);

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatCompare(report));
  }

  if (report.severity === "error") process.exit(1);
}

import { cleanManuscript, DEFAULT_PROFILE, getProfile } from "@stilus/core";
import { die } from "../args.ts";

export async function run(positional: string[], flags: Record<string, string | boolean>): Promise<void> {
  const [file, output] = positional;
  if (!file || !output) die("clean requires <file> <output>");

  const profile = getProfile((flags.profile as string | undefined) ?? DEFAULT_PROFILE);
  const strict = flags.strict === true;
  const dryRun = flags["dry-run"] === true;
  const json = flags.json === true;

  const { manifest } = cleanManuscript(file, output, profile, strict, dryRun);

  if (json) {
    console.log(JSON.stringify(manifest, null, 2));
  } else {
    console.log(`Cleaned: ${manifest.input_path} → ${manifest.output_path}`);
    console.log(`  Words        : ${manifest.before.metrics.words} → ${manifest.after.metrics.words} (Δ${manifest.comparison.word_delta})`);
    console.log(`  Broken lines : ${manifest.before.broken_lines.total} → ${manifest.after.broken_lines.total}`);
    console.log(`  Severity     : ${manifest.severity}`);
    if (dryRun) console.log("  (dry run — no files written)");
    if (manifest.warnings.length) {
      console.log("\nWarnings:");
      for (const w of manifest.warnings) console.log(`  - ${w}`);
    }
    if (manifest.errors.length) {
      console.log("\nErrors:");
      for (const e of manifest.errors) console.log(`  - ${e}`);
    }
  }

  if (manifest.severity === "error") process.exit(1);
}

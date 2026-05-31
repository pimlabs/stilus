import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { initProfile } from "@stilus/core";
import { die } from "../args.ts";

export async function run(positional: string[], flags: Record<string, string | boolean>): Promise<void> {
  const [name, output] = positional;
  if (!name || !output) die("init requires <name> <output>");

  const extendsProfile = flags.extends as string | undefined;
  const scaffold = initProfile(name, extendsProfile);

  mkdirSync(dirname(output), { recursive: true });
  const content = `${JSON.stringify(scaffold, null, 2)}\n`;
  writeFileSync(output, content, "utf-8");

  console.log(`Profile scaffolded: ${output}`);
  if (extendsProfile) console.log(`  extends: ${extendsProfile}`);
  console.log("Edit the file to customize, then use --profile with any command.");
}

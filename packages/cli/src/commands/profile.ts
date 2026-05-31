import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { initProfile, listProfiles, loadProfileFromFile } from "@stilus/core";
import { die } from "../args.ts";

const PROFILE_HELP = `
stilus profile — manage profiles

Usage:
  stilus profile [list]                    List available profiles
  stilus profile init <name> [output]      Scaffold new profile JSON
  stilus profile validate <path>           Validate profile file

Flags:
  --extends <profile>   (init) Profile to extend
  --json                (list) Output raw JSON
`.trim();

export async function run(positional: string[], flags: Record<string, string | boolean>): Promise<void> {
  const [sub, ...rest] = positional;

  if (flags.help === true) {
    console.log(PROFILE_HELP);
    return;
  }

  if (!sub || sub === "list") {
    const json = flags.json === true;
    const profiles = listProfiles();
    if (json) {
      console.log(JSON.stringify(profiles, null, 2));
    } else {
      console.log("Available profiles:");
      for (const p of profiles) {
        const ext = p.extends ? ` (extends: ${p.extends})` : "";
        console.log(`  ${p.name}${ext}`);
      }
    }
    return;
  }

  if (sub === "init") {
    const [name, output = `./${name}.json`] = rest;
    if (!name) die("profile init requires <name>");
    const extendsProfile = flags.extends as string | undefined;
    const scaffold = initProfile(name, extendsProfile);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, `${JSON.stringify(scaffold, null, 2)}\n`, "utf-8");
    console.log(`Profile scaffolded: ${output}`);
    if (extendsProfile) console.log(`  extends: ${extendsProfile}`);
    console.log("Edit the file to customize, then use --profile with any command.");
    return;
  }

  if (sub === "validate") {
    const [path] = rest;
    if (!path) die("profile validate requires <path>");
    const profile = loadProfileFromFile(path);
    console.log(`Valid profile: ${profile.name}`);
    return;
  }

  die(`Unknown profile subcommand: ${sub}\nRun "stilus profile --help" for usage.`);
}

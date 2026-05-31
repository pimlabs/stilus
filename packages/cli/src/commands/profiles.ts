import { listProfiles } from "@stilus/core";

export async function run(_positional: string[], flags: Record<string, string | boolean>): Promise<void> {
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
}

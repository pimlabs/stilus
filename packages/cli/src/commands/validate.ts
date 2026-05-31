import { loadProfileFromFile } from "@stilus/core";
import { die } from "../args.ts";

export async function run(positional: string[], _flags: Record<string, string | boolean>): Promise<void> {
  const [path] = positional;
  if (!path) die("validate requires <profile-path>");

  const profile = loadProfileFromFile(path);
  console.log(`Valid profile: ${profile.name}`);
}

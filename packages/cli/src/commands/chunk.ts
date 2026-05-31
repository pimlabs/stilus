import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chunkFile, DEFAULT_PROFILE, formatChunkSummary, getProfile } from "@stilus/core";
import { die } from "../args.ts";

export async function run(positional: string[], flags: Record<string, string | boolean>): Promise<void> {
  const [file, outputDir] = positional;
  if (!file || !outputDir) die("chunk requires <file> <output-dir>");

  const profile = getProfile((flags.profile as string | undefined) ?? DEFAULT_PROFILE);

  mkdirSync(outputDir, { recursive: true });
  const chunks = chunkFile(file, profile);

  const written = chunks.map((chunk, idx) => {
    const slug =
      chunk.heading
        .toLowerCase()
        .replace(/[^\w]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60) || `chunk-${String(idx).padStart(2, "0")}`;
    const filename = `${String(idx).padStart(2, "0")}-${slug}.md`;
    writeFileSync(join(outputDir, filename), `${chunk.text}\n`, "utf-8");
    return { ...chunk, slug: filename };
  });

  console.log(formatChunkSummary(written, outputDir));
}

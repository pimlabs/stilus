import { dirname, join } from "node:path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  analyzeFile,
  chunkFile,
  cleanManuscript,
  compareFiles,
  DEFAULT_PROFILE,
  getProfile,
  initProfile,
  listProfiles,
  loadProfileFromFile,
} from "@stilus/core";

function deriveCleanOutput(file: string): string {
  return `${file.replace(/\.md$/i, "")}-clean.md`;
}

function deriveChunkDir(file: string): string {
  const base = file.replace(/^.*[/\\]/, "").replace(/\.md$/i, "");
  return join(dirname(file), `${base}-chunks`);
}

const server = new Server(
  { name: "stilus", version: "2.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "inspect",
      description: "Analyze a manuscript file and return a structured QA report.",
      inputSchema: {
        type: "object",
        properties: {
          file: { type: "string", description: "Path to the Markdown manuscript file." },
          profile: { type: "string", description: `Profile name or path to JSON. Default: ${DEFAULT_PROFILE}` },
          strict: { type: "boolean", description: "Elevate warnings to errors." },
        },
        required: ["file"],
      },
    },
    {
      name: "clean",
      description: "Clean a manuscript: merge broken lines, normalize formatting.",
      inputSchema: {
        type: "object",
        properties: {
          file: { type: "string", description: "Path to the input Markdown file." },
          output: { type: "string", description: "Path for the cleaned output file. Default: <file>-clean.md in same directory." },
          profile: { type: "string", description: `Profile name or path to JSON. Default: ${DEFAULT_PROFILE}` },
          strict: { type: "boolean", description: "Fail on serious QA issues." },
          dry_run: { type: "boolean", description: "Analyze without writing files." },
        },
        required: ["file"],
      },
    },
    {
      name: "compare",
      description: "Compare two manuscript versions and report deltas.",
      inputSchema: {
        type: "object",
        properties: {
          before: { type: "string", description: "Path to the original manuscript." },
          after: { type: "string", description: "Path to the revised manuscript." },
          profile: { type: "string", description: `Profile name or path to JSON. Default: ${DEFAULT_PROFILE}` },
          strict: { type: "boolean" },
        },
        required: ["before", "after"],
      },
    },
    {
      name: "chunk",
      description: "Split a manuscript into per-chapter files.",
      inputSchema: {
        type: "object",
        properties: {
          file: { type: "string", description: "Path to the Markdown manuscript file." },
          output_dir: { type: "string", description: "Directory where chunk files will be written. Default: <file>-chunks/ in same directory." },
          profile: { type: "string", description: `Profile name or path to JSON. Default: ${DEFAULT_PROFILE}` },
        },
        required: ["file"],
      },
    },
    {
      name: "profile_list",
      description: "List all available built-in profiles with their inheritance chain.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "profile_init",
      description: "Scaffold a new profile JSON file.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name for the new profile." },
          output: { type: "string", description: "Path where the profile JSON will be written. Default: ./<name>.json" },
          extends: { type: "string", description: "Built-in profile to extend (e.g. 'default')." },
        },
        required: ["name"],
      },
    },
    {
      name: "profile_validate",
      description: "Validate a profile JSON file without running it on a manuscript.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path to the profile JSON file." },
        },
        required: ["path"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;

  try {
    switch (name) {
      case "inspect": {
        const profile = getProfile((args.profile as string | undefined) ?? DEFAULT_PROFILE);
        const report = analyzeFile(args.file as string, profile, (args.strict as boolean) ?? false);
        return { content: [{ type: "text", text: JSON.stringify(report, null, 2) }] };
      }

      case "clean": {
        const file = args.file as string;
        const output = (args.output as string | undefined) ?? deriveCleanOutput(file);
        const profile = getProfile((args.profile as string | undefined) ?? DEFAULT_PROFILE);
        const { manifest } = cleanManuscript(
          file,
          output,
          profile,
          (args.strict as boolean) ?? false,
          (args.dry_run as boolean) ?? false
        );
        return { content: [{ type: "text", text: JSON.stringify(manifest, null, 2) }] };
      }

      case "compare": {
        const profile = getProfile((args.profile as string | undefined) ?? DEFAULT_PROFILE);
        const report = compareFiles(
          args.before as string,
          args.after as string,
          profile,
          (args.strict as boolean) ?? false
        );
        return { content: [{ type: "text", text: JSON.stringify(report, null, 2) }] };
      }

      case "chunk": {
        const file = args.file as string;
        const outputDir = (args.output_dir as string | undefined) ?? deriveChunkDir(file);
        const profile = getProfile((args.profile as string | undefined) ?? DEFAULT_PROFILE);
        const { mkdirSync, writeFileSync } = await import("node:fs");
        mkdirSync(outputDir, { recursive: true });
        const chunks = chunkFile(file, profile);
        const written = chunks.map((chunk, idx) => {
          const slug = chunk.heading.toLowerCase().replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || `chunk-${String(idx).padStart(2, "0")}`;
          const filename = `${String(idx).padStart(2, "0")}-${slug}.md`;
          writeFileSync(join(outputDir, filename), `${chunk.text}\n`, "utf-8");
          return { ...chunk, slug: filename };
        });
        return { content: [{ type: "text", text: JSON.stringify({ output_dir: outputDir, chunks: written }, null, 2) }] };
      }

      case "profile_list": {
        return { content: [{ type: "text", text: JSON.stringify(listProfiles(), null, 2) }] };
      }

      case "profile_init": {
        const { writeFileSync, mkdirSync } = await import("node:fs");
        const name = args.name as string;
        const outputPath = (args.output as string | undefined) ?? `./${name}.json`;
        const scaffold = initProfile(name, args.extends as string | undefined);
        mkdirSync(dirname(outputPath), { recursive: true });
        const json = `${JSON.stringify(scaffold, null, 2)}\n`;
        writeFileSync(outputPath, json, "utf-8");
        return { content: [{ type: "text", text: json }] };
      }

      case "profile_validate": {
        const profile = loadProfileFromFile(args.path as string);
        return { content: [{ type: "text", text: JSON.stringify({ valid: true, name: profile.name }, null, 2) }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    return {
      content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);

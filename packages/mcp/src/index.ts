#!/usr/bin/env bun
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  analyzeFile,
  chunkFile,
  compareFiles,
  DEFAULT_PROFILE,
  getProfile,
  listProfiles,
  cleanManuscript,
} from "@stilus/core";

const server = new Server(
  { name: "stilus", version: "1.0.0" },
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
          output: { type: "string", description: "Path for the cleaned output file." },
          profile: { type: "string", description: `Profile name or path to JSON. Default: ${DEFAULT_PROFILE}` },
          strict: { type: "boolean", description: "Fail on serious QA issues." },
          dry_run: { type: "boolean", description: "Analyze without writing files." },
        },
        required: ["file", "output"],
      },
    },
    {
      name: "compare",
      description: "Compare source and cleaned manuscript, report deltas.",
      inputSchema: {
        type: "object",
        properties: {
          source: { type: "string", description: "Path to the original manuscript." },
          clean: { type: "string", description: "Path to the cleaned manuscript." },
          profile: { type: "string", description: `Profile name or path to JSON. Default: ${DEFAULT_PROFILE}` },
          strict: { type: "boolean" },
        },
        required: ["source", "clean"],
      },
    },
    {
      name: "chunk",
      description: "Split a manuscript into per-chapter files.",
      inputSchema: {
        type: "object",
        properties: {
          file: { type: "string", description: "Path to the Markdown manuscript file." },
          output_dir: { type: "string", description: "Directory where chunk files will be written." },
          profile: { type: "string", description: `Profile name or path to JSON. Default: ${DEFAULT_PROFILE}` },
        },
        required: ["file", "output_dir"],
      },
    },
    {
      name: "profiles",
      description: "List all available built-in profiles with their inheritance chain.",
      inputSchema: { type: "object", properties: {} },
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
        const profile = getProfile((args.profile as string | undefined) ?? DEFAULT_PROFILE);
        const { manifest } = cleanManuscript(
          args.file as string,
          args.output as string,
          profile,
          (args.strict as boolean) ?? false,
          (args.dry_run as boolean) ?? false
        );
        return { content: [{ type: "text", text: JSON.stringify(manifest, null, 2) }] };
      }

      case "compare": {
        const profile = getProfile((args.profile as string | undefined) ?? DEFAULT_PROFILE);
        const report = compareFiles(
          args.source as string,
          args.clean as string,
          profile,
          (args.strict as boolean) ?? false
        );
        return { content: [{ type: "text", text: JSON.stringify(report, null, 2) }] };
      }

      case "chunk": {
        const profile = getProfile((args.profile as string | undefined) ?? DEFAULT_PROFILE);
        const { mkdirSync, writeFileSync } = await import("fs");
        const { join } = await import("path");
        const outputDir = args.output_dir as string;
        mkdirSync(outputDir, { recursive: true });
        const chunks = chunkFile(args.file as string, profile);
        const written = chunks.map((chunk, idx) => {
          const slug = chunk.heading.toLowerCase().replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || `chunk-${String(idx).padStart(2, "0")}`;
          const filename = `${String(idx).padStart(2, "0")}-${slug}.md`;
          writeFileSync(join(outputDir, filename), chunk.text + "\n", "utf-8");
          return { ...chunk, slug: filename };
        });
        return { content: [{ type: "text", text: JSON.stringify(written, null, 2) }] };
      }

      case "profiles": {
        return { content: [{ type: "text", text: JSON.stringify(listProfiles(), null, 2) }] };
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

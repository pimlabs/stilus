import { existsSync, readFileSync, readdirSync } from "fs";
import { join, resolve } from "path";

const PROFILES_DIR = resolve(import.meta.dir, "../../../profiles");

export const DEFAULT_PROFILE = "indonesian-book";

const SENTENCE_ENDINGS_DEFAULT = [".", "?", "!", '"', "”", "」"] as const;
const BROKEN_LINE_ENDINGS_DEFAULT = [".", "?", "!", '"', "”", "」", ":", "-", "*"] as const;

const REQUIRED_FIELDS = new Set(["name", "chapter_pattern", "section_pattern", "reference_pattern"]);
const OPTIONAL_FIELDS = new Set([
  "paragraph_merge_threshold", "broken_line_min_length", "word_delta_threshold",
  "sentence_endings", "broken_line_endings", "stub_chapter_pattern",
  "subsection_pattern", "figure_pattern", "table_caption_pattern",
  "footnote_pattern", "normalize_em_dash", "normalize_space_before_punctuation",
  "required_sections",
]);

export interface Profile {
  readonly name: string;
  readonly chapter_pattern: string;
  readonly section_pattern: string;
  readonly reference_pattern: string;
  readonly paragraph_merge_threshold: number;
  readonly broken_line_min_length: number;
  readonly word_delta_threshold: number;
  readonly sentence_endings: readonly string[];
  readonly broken_line_endings: readonly string[];
  readonly stub_chapter_pattern: string;
  readonly subsection_pattern: string;
  readonly figure_pattern: string;
  readonly table_caption_pattern: string;
  readonly footnote_pattern: string;
  readonly normalize_em_dash: boolean;
  readonly normalize_space_before_punctuation: boolean;
  readonly required_sections: readonly string[];
}

type RawData = Record<string, unknown>;

function buildProfile(data: RawData): Profile {
  return Object.freeze({
    name: data.name as string,
    chapter_pattern: data.chapter_pattern as string,
    section_pattern: data.section_pattern as string,
    reference_pattern: data.reference_pattern as string,
    paragraph_merge_threshold: (data.paragraph_merge_threshold as number | undefined) ?? 75,
    broken_line_min_length: (data.broken_line_min_length as number | undefined) ?? 50,
    word_delta_threshold: (data.word_delta_threshold as number | undefined) ?? 50,
    sentence_endings: Object.freeze(
      Array.isArray(data.sentence_endings) ? [...data.sentence_endings] : [...SENTENCE_ENDINGS_DEFAULT]
    ),
    broken_line_endings: Object.freeze(
      Array.isArray(data.broken_line_endings) ? [...data.broken_line_endings] : [...BROKEN_LINE_ENDINGS_DEFAULT]
    ),
    stub_chapter_pattern: (data.stub_chapter_pattern as string | undefined) ?? "",
    subsection_pattern: (data.subsection_pattern as string | undefined) ?? "",
    figure_pattern: (data.figure_pattern as string | undefined) ?? "",
    table_caption_pattern: (data.table_caption_pattern as string | undefined) ?? "",
    footnote_pattern: (data.footnote_pattern as string | undefined) ?? "",
    normalize_em_dash: (data.normalize_em_dash as boolean | undefined) ?? true,
    normalize_space_before_punctuation: (data.normalize_space_before_punctuation as boolean | undefined) ?? true,
    required_sections: Object.freeze(
      Array.isArray(data.required_sections) ? [...data.required_sections] : []
    ),
  });
}

export function profileToDict(profile: Profile): RawData {
  return {
    name: profile.name,
    chapter_pattern: profile.chapter_pattern,
    section_pattern: profile.section_pattern,
    reference_pattern: profile.reference_pattern,
    paragraph_merge_threshold: profile.paragraph_merge_threshold,
    broken_line_min_length: profile.broken_line_min_length,
    word_delta_threshold: profile.word_delta_threshold,
    sentence_endings: [...profile.sentence_endings],
    broken_line_endings: [...profile.broken_line_endings],
    stub_chapter_pattern: profile.stub_chapter_pattern,
    subsection_pattern: profile.subsection_pattern,
    figure_pattern: profile.figure_pattern,
    table_caption_pattern: profile.table_caption_pattern,
    footnote_pattern: profile.footnote_pattern,
    normalize_em_dash: profile.normalize_em_dash,
    normalize_space_before_punctuation: profile.normalize_space_before_punctuation,
    required_sections: [...profile.required_sections],
  };
}

function validateAndBuild(data: RawData, path: string): Profile {
  const missing = [...REQUIRED_FIELDS].filter(f => !(f in data)).sort();
  if (missing.length > 0) {
    throw new Error(`Profile file '${path}' missing required fields: ${JSON.stringify(missing)}.`);
  }
  const allFields = new Set([...REQUIRED_FIELDS, ...OPTIONAL_FIELDS]);
  const unknown = Object.keys(data).filter(k => !allFields.has(k)).sort();
  if (unknown.length > 0) {
    throw new Error(`Profile file '${path}' has unknown fields: ${JSON.stringify(unknown)}.`);
  }
  return buildProfile(data);
}

export function loadProfileFromFile(path: string): Profile {
  const data = JSON.parse(readFileSync(path, "utf-8")) as RawData;
  if ("extends" in data) {
    const base = getProfile(data.extends as string);
    const { extends: _, ...rest } = data;
    return validateAndBuild({ ...profileToDict(base), ...rest }, path);
  }
  return validateAndBuild(data, path);
}

export function getProfile(name: string = DEFAULT_PROFILE): Profile {
  if (name.endsWith(".json")) return loadProfileFromFile(name);
  const profilePath = join(PROFILES_DIR, `${name}.json`);
  if (!existsSync(profilePath)) {
    const available = readdirSync(PROFILES_DIR)
      .filter(f => f.endsWith(".json"))
      .map(f => f.replace(".json", ""))
      .sort()
      .join(", ");
    throw new Error(`Unknown profile '${name}'. Available profiles: ${available}.`);
  }
  return loadProfileFromFile(profilePath);
}

export function listProfiles(): Array<{ name: string; extends: string | null }> {
  return readdirSync(PROFILES_DIR)
    .filter(f => f.endsWith(".json"))
    .sort()
    .map(f => {
      const data = JSON.parse(readFileSync(join(PROFILES_DIR, f), "utf-8")) as RawData;
      return {
        name: (data.name as string | undefined) ?? f.replace(".json", ""),
        extends: (data.extends as string | undefined) ?? null,
      };
    });
}

import { readFileSync } from "node:fs";

import defaultJson from "../../../profiles/default.json";
import englishBookJson from "../../../profiles/english-book.json";
import indonesianBookJson from "../../../profiles/indonesian-book.json";

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

const BUILT_INS: Record<string, RawData> = {
  "default": defaultJson as RawData,
  "english-book": englishBookJson as RawData,
  "indonesian-book": indonesianBookJson as RawData,
};

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
    throw new Error(`Profile '${path}' missing required fields: ${JSON.stringify(missing)}.`);
  }
  const allFields = new Set([...REQUIRED_FIELDS, ...OPTIONAL_FIELDS]);
  const unknown = Object.keys(data).filter(k => !allFields.has(k)).sort();
  if (unknown.length > 0) {
    throw new Error(`Profile '${path}' has unknown fields: ${JSON.stringify(unknown)}.`);
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
  const raw = BUILT_INS[name];
  if (!raw) {
    const available = Object.keys(BUILT_INS).sort().join(", ");
    throw new Error(`Unknown profile '${name}'. Available profiles: ${available}.`);
  }
  if ("extends" in raw) {
    const base = getProfile(raw.extends as string);
    const { extends: _, ...rest } = raw;
    return validateAndBuild({ ...profileToDict(base), ...rest }, `built-in:${name}`);
  }
  return validateAndBuild(raw, `built-in:${name}`);
}

export function listProfiles(): Array<{ name: string; extends: string | null }> {
  return Object.keys(BUILT_INS).sort().map(key => {
    const raw = BUILT_INS[key];
    return {
      name: (raw.name as string | undefined) ?? key,
      extends: (raw.extends as string | undefined) ?? null,
    };
  });
}

export function initProfile(name: string, extendsName?: string): RawData {
  if (extendsName) {
    return { extends: extendsName, name };
  }
  return {
    name,
    chapter_pattern: "^#+ ",
    section_pattern: "^##+ ",
    reference_pattern: "^\\[\\d+\\]",
    stub_chapter_pattern: "",
    subsection_pattern: "",
    figure_pattern: "",
    table_caption_pattern: "",
    footnote_pattern: "",
    sentence_endings: [".", "?", "!", "\"", "”", "」"],
    broken_line_endings: [".", "?", "!", "\"", "”", "」", ":", "-", "*"],
    paragraph_merge_threshold: 75,
    broken_line_min_length: 50,
    word_delta_threshold: 50,
    normalize_em_dash: true,
    normalize_space_before_punctuation: true,
    required_sections: [],
  };
}

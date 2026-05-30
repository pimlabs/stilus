import { describe, expect, it } from "bun:test";
import { mkdtempSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  DEFAULT_PROFILE,
  getProfile,
  listProfiles,
  loadProfileFromFile,
} from "../src/config";

function writeProfile(dir: string, data: object): string {
  const path = join(dir, "profile.json");
  writeFileSync(path, JSON.stringify(data));
  return path;
}

function tmpDir(): string {
  return mkdtempSync(join(tmpdir(), "stilus-test-"));
}

describe("config", () => {
  it("loads built-in indonesian-book profile", () => {
    const profile = getProfile("indonesian-book");
    expect(profile.name).toBe("indonesian-book");
    expect(profile.chapter_pattern).toBeTruthy();
    expect(Array.isArray(profile.sentence_endings)).toBe(true);
  });

  it("loads built-in default profile", () => {
    const profile = getProfile("default");
    expect(profile.name).toBe("default");
    expect(profile.chapter_pattern).toBe("^#+ ");
  });

  it("throws on unknown profile", () => {
    expect(() => getProfile("nonexistent")).toThrow(/Available profiles/);
  });

  it("loads profile from json file path", () => {
    const dir = tmpDir();
    const path = writeProfile(dir, {
      name: "custom",
      chapter_pattern: "^CHAPTER \\d+",
      section_pattern: "^\\d+\\.\\d+",
      reference_pattern: "^\\[(\\d+)\\]",
    });
    const profile = getProfile(path);
    expect(profile.name).toBe("custom");
    expect(profile.chapter_pattern).toBe("^CHAPTER \\d+");
  });

  it("optional fields default correctly", () => {
    const dir = tmpDir();
    const path = writeProfile(dir, {
      name: "minimal",
      chapter_pattern: "^CH \\d+",
      section_pattern: "^\\d+\\.\\d+",
      reference_pattern: "^\\[(\\d+)\\]",
    });
    const profile = loadProfileFromFile(path);
    expect(profile.word_delta_threshold).toBe(50);
    expect(profile.broken_line_min_length).toBe(50);
    expect(profile.paragraph_merge_threshold).toBe(75);
    expect(profile.normalize_em_dash).toBe(true);
    expect(profile.stub_chapter_pattern).toBe("");
    expect(profile.required_sections).toEqual([]);
  });

  it("optional fields overridable", () => {
    const dir = tmpDir();
    const path = writeProfile(dir, {
      name: "custom",
      chapter_pattern: "^CH \\d+",
      section_pattern: "^\\d+\\.\\d+",
      reference_pattern: "^\\[(\\d+)\\]",
      word_delta_threshold: 100,
      broken_line_min_length: 40,
    });
    const profile = loadProfileFromFile(path);
    expect(profile.word_delta_threshold).toBe(100);
    expect(profile.broken_line_min_length).toBe(40);
  });

  it("throws on missing required field", () => {
    const dir = tmpDir();
    const path = writeProfile(dir, {
      name: "incomplete",
      chapter_pattern: "^CH \\d+",
    });
    expect(() => loadProfileFromFile(path)).toThrow(/missing required fields/);
  });

  it("throws on unknown field", () => {
    const dir = tmpDir();
    const path = writeProfile(dir, {
      name: "bad",
      chapter_pattern: "^CH \\d+",
      section_pattern: "^\\d+\\.\\d+",
      reference_pattern: "^\\[(\\d+)\\]",
      typo_field: "oops",
    });
    expect(() => loadProfileFromFile(path)).toThrow(/unknown fields/);
  });

  it("inheritance extends built-in", () => {
    const dir = tmpDir();
    const path = writeProfile(dir, {
      extends: "indonesian-book",
      name: "penulis-a",
      word_delta_threshold: 200,
    });
    const profile = loadProfileFromFile(path);
    expect(profile.name).toBe("penulis-a");
    expect(profile.word_delta_threshold).toBe(200);
    expect(profile.chapter_pattern).toContain("BAB");
  });

  it("inheritance overrides field", () => {
    const dir = tmpDir();
    const path = writeProfile(dir, {
      extends: "indonesian-book",
      name: "penulis-b",
      sentence_endings: [".", "?", "!", "。"],
    });
    const profile = loadProfileFromFile(path);
    expect(profile.sentence_endings).toContain("。");
    expect(profile.sentence_endings).not.toContain("doesn't exist");
  });

  it("inheritance catches typos", () => {
    const dir = tmpDir();
    const path = writeProfile(dir, {
      extends: "indonesian-book",
      name: "penulis-c",
      word_delta_thresold: 100,
    });
    expect(() => loadProfileFromFile(path)).toThrow(/unknown fields/);
  });

  it("profile is frozen (immutable)", () => {
    const profile = getProfile("default");
    expect(() => {
      (profile as Record<string, unknown>).name = "hacked";
    }).toThrow();
  });

  it("sentence_endings overridable", () => {
    const dir = tmpDir();
    const path = writeProfile(dir, {
      name: "custom",
      chapter_pattern: "^CH \\d+",
      section_pattern: "^\\d+\\.\\d+",
      reference_pattern: "^\\[(\\d+)\\]",
      sentence_endings: ["。", "？", "！"],
    });
    const profile = loadProfileFromFile(path);
    expect(profile.sentence_endings).toContain("。");
    expect(profile.sentence_endings).not.toContain(".");
  });

  it("required_sections loaded from file", () => {
    const dir = tmpDir();
    const path = writeProfile(dir, {
      name: "strict",
      chapter_pattern: "^BAB \\d+",
      section_pattern: "^\\d+\\.\\d+",
      reference_pattern: "^(\\d+)\\.",
      required_sections: ["DAFTAR ISI", "LAMPIRAN"],
    });
    const profile = loadProfileFromFile(path);
    expect(profile.required_sections).toContain("DAFTAR ISI");
    expect(profile.required_sections).toContain("LAMPIRAN");
  });

  it("listProfiles returns all built-ins", () => {
    const profiles = listProfiles();
    const names = profiles.map(p => p.name);
    expect(names).toContain("default");
    expect(names).toContain("english-book");
    expect(names).toContain("indonesian-book");
  });

  it("listProfiles includes extends chain", () => {
    const profiles = listProfiles();
    const byName = Object.fromEntries(profiles.map(p => [p.name, p]));
    expect(byName["default"].extends).toBeNull();
    expect(byName["english-book"].extends).toBe("default");
    expect(byName["indonesian-book"].extends).toBe("default");
  });

  it("DEFAULT_PROFILE is indonesian-book", () => {
    expect(DEFAULT_PROFILE).toBe("indonesian-book");
  });
});

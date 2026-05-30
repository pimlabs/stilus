import json
from dataclasses import asdict, dataclass
from pathlib import Path

_PROFILES_DIR = Path(__file__).parent / "profiles"

DEFAULT_PROFILE = "indonesian-book"

_SENTENCE_ENDINGS_DEFAULT = (".", "?", "!", '"', "”", "」")
_BROKEN_LINE_ENDINGS_DEFAULT = (".", "?", "!", '"', "”", "」", ":", "-", "*")

_REQUIRED_FIELDS = {"name", "chapter_pattern", "section_pattern", "reference_pattern"}
_OPTIONAL_FIELDS = {
    "paragraph_merge_threshold",
    "broken_line_min_length",
    "word_delta_threshold",
    "sentence_endings",
    "broken_line_endings",
    "stub_chapter_pattern",
    "subsection_pattern",
    "figure_pattern",
    "table_caption_pattern",
    "footnote_pattern",
    "normalize_em_dash",
    "normalize_space_before_punctuation",
    "required_sections",
}


@dataclass(frozen=True)
class Profile:
    name: str
    chapter_pattern: str
    section_pattern: str
    reference_pattern: str
    paragraph_merge_threshold: int = 75
    broken_line_min_length: int = 50
    word_delta_threshold: int = 50
    sentence_endings: tuple = _SENTENCE_ENDINGS_DEFAULT
    broken_line_endings: tuple = _BROKEN_LINE_ENDINGS_DEFAULT
    stub_chapter_pattern: str = ""
    subsection_pattern: str = ""
    figure_pattern: str = ""
    table_caption_pattern: str = ""
    footnote_pattern: str = ""
    normalize_em_dash: bool = True
    normalize_space_before_punctuation: bool = True
    required_sections: tuple = ()

    def to_dict(self):
        d = asdict(self)
        d["sentence_endings"] = list(d["sentence_endings"])
        d["broken_line_endings"] = list(d["broken_line_endings"])
        d["required_sections"] = list(d["required_sections"])
        return d


def _build_profile(data):
    return Profile(
        name=data["name"],
        chapter_pattern=data["chapter_pattern"],
        section_pattern=data["section_pattern"],
        reference_pattern=data["reference_pattern"],
        paragraph_merge_threshold=data.get("paragraph_merge_threshold", 75),
        broken_line_min_length=data.get("broken_line_min_length", 50),
        word_delta_threshold=data.get("word_delta_threshold", 50),
        sentence_endings=tuple(data.get("sentence_endings", list(_SENTENCE_ENDINGS_DEFAULT))),
        broken_line_endings=tuple(data.get("broken_line_endings", list(_BROKEN_LINE_ENDINGS_DEFAULT))),
        stub_chapter_pattern=data.get("stub_chapter_pattern", ""),
        subsection_pattern=data.get("subsection_pattern", ""),
        figure_pattern=data.get("figure_pattern", ""),
        table_caption_pattern=data.get("table_caption_pattern", ""),
        footnote_pattern=data.get("footnote_pattern", ""),
        normalize_em_dash=data.get("normalize_em_dash", True),
        normalize_space_before_punctuation=data.get("normalize_space_before_punctuation", True),
        required_sections=tuple(data.get("required_sections", [])),
    )


def load_profile_from_file(path):
    data = json.loads(Path(path).read_text(encoding="utf-8"))

    if "extends" in data:
        base = get_profile(data.pop("extends"))
        data = {**base.to_dict(), **data}

    missing = _REQUIRED_FIELDS - data.keys()
    if missing:
        raise ValueError(f"Profile file '{path}' missing required fields: {sorted(missing)}.")
    unknown = data.keys() - (_REQUIRED_FIELDS | _OPTIONAL_FIELDS)
    if unknown:
        raise ValueError(f"Profile file '{path}' has unknown fields: {sorted(unknown)}.")

    return _build_profile(data)


def get_profile(name=DEFAULT_PROFILE):
    if name.endswith(".json"):
        return load_profile_from_file(name)
    profile_path = _PROFILES_DIR / f"{name}.json"
    if not profile_path.exists():
        available = ", ".join(sorted(p.stem for p in _PROFILES_DIR.glob("*.json")))
        raise ValueError(f"Unknown profile '{name}'. Available profiles: {available}.")
    return load_profile_from_file(profile_path)


def list_profiles():
    profiles = []
    for path in sorted(_PROFILES_DIR.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        profiles.append({"name": data.get("name", path.stem), "extends": data.get("extends")})
    return profiles

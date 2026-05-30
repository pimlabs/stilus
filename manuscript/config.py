from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class Profile:
    name: str
    chapter_pattern: str
    section_pattern: str
    reference_pattern: str
    paragraph_merge_threshold: int = 75
    broken_line_min_length: int = 50
    word_delta_threshold: int = 50

    def to_dict(self):
        return asdict(self)


PROFILES = {
    "indonesian-book": Profile(
        name="indonesian-book",
        chapter_pattern=r"^(PROLOG|BAB \d+|EPILOG|LAMPIRAN|WORKBOOK|DAFTAR ISI|CATATAN EDISI|\d+\s+EPILOG)",
        section_pattern=r"^(\d+\.\d+\s+[A-Z])",
        reference_pattern=r"^(\d+)\.\s+",
    )
}


def get_profile(name="indonesian-book"):
    try:
        return PROFILES[name]
    except KeyError as exc:
        available = ", ".join(sorted(PROFILES))
        raise ValueError(f"Unknown profile '{name}'. Available profiles: {available}") from exc

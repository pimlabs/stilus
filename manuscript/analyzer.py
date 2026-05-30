import re
from pathlib import Path

from .config import get_profile


SENTENCE_ENDINGS = (".", "?", "!", '"', "”", "」")
BROKEN_LINE_ENDINGS = (".", "?", "!", '"', "”", "」", ":", "-", "*")


def read_text(path):
    return Path(path).read_text(encoding="utf-8")


def count_words(text):
    return len(text.split())


def collect_metrics(text):
    lines = text.splitlines()
    empty_lines = sum(1 for line in lines if not line.strip())
    return {
        "characters": len(text),
        "words": count_words(text),
        "lines": len(lines),
        "empty_lines": empty_lines,
        "empty_line_ratio": (empty_lines / len(lines) * 100) if lines else 0.0,
        "form_feeds": text.count("\x0c") + text.count("\f"),
    }


def is_heading(line, profile):
    stripped = line.strip()
    return stripped.startswith("#") or bool(re.match(profile.chapter_pattern, stripped, re.IGNORECASE))


def is_section_heading(line, profile):
    return bool(re.match(profile.section_pattern, line.strip()))


def is_table_row(line):
    stripped = line.strip()
    return stripped.count("|") >= 2 or (
        len(re.findall(r"\d+[\.,]?\d*", stripped)) >= 3 and len(stripped) < 60
    )


def detect_table_blocks(lines):
    table_blocks = []
    in_table = False
    table_start = 0
    for idx, line in enumerate(lines, start=1):
        if not line.strip():
            if in_table:
                table_blocks.append({"start": table_start, "end": idx - 1})
                in_table = False
            continue
        if is_table_row(line):
            if not in_table:
                table_start = idx
                in_table = True
        elif in_table:
            table_blocks.append({"start": table_start, "end": idx - 1})
            in_table = False
    if in_table:
        table_blocks.append({"start": table_start, "end": len(lines)})
    return table_blocks


def detect_broken_lines(lines, profile):
    current_section = "FRONT MATTER / PROLOG"
    broken_lines = []
    section_counts = {current_section: 0}

    for idx, line in enumerate(lines, start=1):
        stripped = line.strip()
        if not stripped:
            continue
        if is_heading(stripped, profile):
            current_section = re.sub(r"[#\s]+", " ", stripped).strip()
            section_counts.setdefault(current_section, 0)
            continue
        if (
            not stripped.endswith(BROKEN_LINE_ENDINGS)
            and len(stripped) > profile.broken_line_min_length
            and not is_table_row(stripped)
            and not is_section_heading(stripped, profile)
        ):
            broken_lines.append({"line": idx, "section": current_section, "text": stripped})
            section_counts[current_section] = section_counts.get(current_section, 0) + 1

    return {"total": len(broken_lines), "items": broken_lines, "by_section": section_counts}


def detect_ghost_chapters(lines, profile):
    ghosts = []
    for idx, line in enumerate(lines, start=1):
        stripped = line.strip()
        if re.match(profile.chapter_pattern, stripped, re.IGNORECASE):
            clean = re.sub(r"^#+\s*", "", stripped).strip()
            if len(clean) < 15 and "BAB" in clean.upper():
                ghosts.append({"line": idx, "text": stripped})
    return ghosts


def analyze_citations(text, profile):
    citations = sorted(set(map(int, re.findall(r"\[(\d+)\]", text))))
    refs = sorted(set(map(int, re.findall(profile.reference_pattern, text, re.MULTILINE))))
    missing = sorted(set(citations) - set(refs))
    unused = sorted(set(refs) - set(citations))
    return {
        "citations": citations,
        "references": refs,
        "citation_count": len(citations),
        "reference_count": len(refs),
        "missing_references": missing,
        "unused_references": unused,
        "status": "ok" if not missing else "error",
    }


def build_warnings(metrics, broken, citations, strict=False):
    warnings = []
    errors = []
    if metrics["form_feeds"] > 0:
        target = errors if strict else warnings
        target.append(f"Found {metrics['form_feeds']} form feed/page break characters.")
    if broken["total"] > 0:
        target = errors if strict else warnings
        target.append(f"Found {broken['total']} likely broken lines.")
    if citations["missing_references"]:
        errors.append(f"Missing references for citations: {citations['missing_references']}.")
    return warnings, errors


def analyze_text(text, profile=None, strict=False):
    profile = profile or get_profile()
    lines = text.splitlines()
    metrics = collect_metrics(text)
    table_blocks = detect_table_blocks(lines)
    broken = detect_broken_lines(lines, profile)
    ghosts = detect_ghost_chapters(lines, profile)
    citations = analyze_citations(text, profile)
    warnings, errors = build_warnings(metrics, broken, citations, strict=strict)
    severity = "error" if errors else "warning" if warnings else "ok"
    return {
        "severity": severity,
        "metrics": metrics,
        "warnings": warnings,
        "errors": errors,
        "table_blocks": table_blocks,
        "broken_lines": broken,
        "ghost_chapters": ghosts,
        "citations": citations,
        "profile": profile.to_dict(),
    }


def analyze_file(path, profile=None, strict=False):
    return analyze_text(read_text(path), profile=profile, strict=strict)


def compare_reports(source_report, clean_report, profile=None, strict=False):
    profile = profile or get_profile()
    source_metrics = source_report["metrics"]
    clean_metrics = clean_report["metrics"]
    word_delta = clean_metrics["words"] - source_metrics["words"]
    char_delta = clean_metrics["characters"] - source_metrics["characters"]
    warnings = []
    errors = []
    if abs(word_delta) > profile.word_delta_threshold:
        target = errors if strict else warnings
        target.append(
            f"Word delta {word_delta:+d} exceeds threshold {profile.word_delta_threshold}."
        )
    if clean_report["broken_lines"]["total"] > 0 and strict:
        errors.append("Clean file still has broken lines.")
    if clean_report["citations"]["missing_references"]:
        errors.append("Clean file has citation/reference mismatches.")
    severity = "error" if errors else "warning" if warnings else "ok"
    return {
        "severity": severity,
        "source_metrics": source_metrics,
        "clean_metrics": clean_metrics,
        "word_delta": word_delta,
        "character_delta": char_delta,
        "heading_delta": len(clean_report["ghost_chapters"]) - len(source_report["ghost_chapters"]),
        "reference_delta": clean_report["citations"]["reference_count"]
        - source_report["citations"]["reference_count"],
        "broken_line_delta": clean_report["broken_lines"]["total"]
        - source_report["broken_lines"]["total"],
        "warnings": warnings,
        "errors": errors,
        "profile": profile.to_dict(),
    }


def compare_files(source_path, clean_path, profile=None, strict=False):
    profile = profile or get_profile()
    source_report = analyze_file(source_path, profile=profile, strict=False)
    clean_report = analyze_file(clean_path, profile=profile, strict=strict)
    return compare_reports(source_report, clean_report, profile=profile, strict=strict)

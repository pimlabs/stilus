import re
from datetime import datetime, timezone
from pathlib import Path

from .analyzer import analyze_text, compare_reports, is_heading, is_section_heading, is_table_row
from .config import get_profile


LIST_PATTERN = re.compile(r"^(\s*[-*]|\s*\d+\.\s+)")
URL_PATTERN = re.compile(r"^https?://[^\s]+")


def normalize_text(text, profile=None):
    em_dash = profile.normalize_em_dash if profile is not None else True
    space_punct = profile.normalize_space_before_punctuation if profile is not None else True
    text = text.replace("\x0c", "\n").replace("\f", "\n")
    if space_punct:
        text = re.sub(r"[ \t]+,[ \t]*", ", ", text)
        text = re.sub(r"[ \t]+\.[ \t]*", ". ", text)
    if em_dash:
        text = re.sub(r"[ \t]*—[ \t]*|[ \t]*--[ \t]*", " — ", text)
    return text


def is_list(line):
    return bool(LIST_PATTERN.match(line))


def is_url(line):
    return bool(URL_PATTERN.match(line))


def should_join_url(previous, current):
    if not previous:
        return False
    if previous.startswith("http") and previous.endswith("-"):
        return bool(current) and not is_heading(current, get_profile())
    if previous.startswith("http"):
        return "/" in current or "." in current or current.startswith(("en/", "id/"))
    return False


def standardize_heading(line, profile):
    if is_heading(line, profile) and not line.startswith("#"):
        return f"# {line}"
    if is_section_heading(line, profile) and not line.startswith("#"):
        return f"## {line}"
    return line


def flush_paragraph(processed_lines, current_paragraph):
    if current_paragraph:
        processed_lines.append(" ".join(current_paragraph))
        current_paragraph.clear()


def merge_and_structure(text, profile=None):
    profile = profile or get_profile()
    raw_lines = normalize_text(text, profile=profile).splitlines()
    processed_lines = []
    current_paragraph = []

    for raw_line in raw_lines:
        line = re.sub(r"\s+", " ", raw_line.strip())

        if not line:
            if current_paragraph and current_paragraph[-1].endswith(profile.sentence_endings):
                flush_paragraph(processed_lines, current_paragraph)
                processed_lines.append("")
            continue

        if current_paragraph and should_join_url(current_paragraph[-1], line):
            previous = current_paragraph.pop()
            if previous.endswith("-"):
                previous = previous[:-1]
            current_paragraph.append(previous + line)
            continue

        structural = (
            is_heading(line, profile)
            or is_section_heading(line, profile)
            or is_list(line)
            or is_url(line)
            or is_table_row(line)
        )

        if not structural and processed_lines and should_join_url(processed_lines[-1], line):
            previous = processed_lines.pop()
            if previous.endswith("-"):
                previous = previous[:-1]
            processed_lines.append(previous + line)
            continue

        if structural:
            flush_paragraph(processed_lines, current_paragraph)
            line = standardize_heading(line, profile)
            if is_table_row(line):
                processed_lines.append(line)
            else:
                previous_is_list = bool(processed_lines and is_list(processed_lines[-1]))
                if processed_lines and processed_lines[-1] != "" and not (
                    is_list(line) and previous_is_list
                ):
                    processed_lines.append("")
                processed_lines.append(line)
                if not is_list(line) and not is_url(line):
                    processed_lines.append("")
            continue

        if current_paragraph:
            current_paragraph.append(line)
        else:
            current_paragraph.append(line)

    flush_paragraph(processed_lines, current_paragraph)
    final_text = "\n".join(processed_lines)
    final_text = re.sub(r"\n{3,}", "\n\n", final_text).strip() + "\n"
    return final_text


def clean_manuscript(input_path, output_path, profile=None, strict=False, dry_run=False):
    profile = profile or get_profile()
    input_path = Path(input_path)
    output_path = Path(output_path)
    raw_text = input_path.read_text(encoding="utf-8")
    before = analyze_text(raw_text, profile=profile, strict=False)
    clean_text = merge_and_structure(raw_text, profile=profile)
    after = analyze_text(clean_text, profile=profile, strict=strict)
    comparison = compare_reports(before, after, profile=profile, strict=strict)
    if not dry_run:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(clean_text, encoding="utf-8")
    manifest = {
        "input_path": str(input_path),
        "output_path": str(output_path),
        "dry_run": dry_run,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "profile": profile.to_dict(),
        "before": before,
        "after": after,
        "comparison": comparison,
        "warnings": after["warnings"] + comparison["warnings"],
        "errors": after["errors"] + comparison["errors"],
        "severity": "error"
        if after["severity"] == "error" or comparison["severity"] == "error"
        else "warning"
        if after["severity"] == "warning" or comparison["severity"] == "warning"
        else "ok",
    }
    manifest_path = output_path.parent / "manifest.json"
    return clean_text, manifest, manifest_path

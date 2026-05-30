import re
from pathlib import Path

from .config import get_profile


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
    stripped = line.strip()
    if re.match(profile.section_pattern, stripped):
        return True
    if profile.subsection_pattern and re.match(profile.subsection_pattern, stripped):
        return True
    return False


def _is_structural_line(stripped, profile):
    """Return True if line should not be flagged as a broken line."""
    if is_table_row(stripped):
        return True
    if is_section_heading(stripped, profile):
        return True
    if profile.figure_pattern and re.match(profile.figure_pattern, stripped, re.IGNORECASE):
        return True
    if profile.table_caption_pattern and re.match(profile.table_caption_pattern, stripped, re.IGNORECASE):
        return True
    if profile.footnote_pattern and re.match(profile.footnote_pattern, stripped, re.IGNORECASE):
        return True
    return False


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


def detect_broken_tables(lines):
    broken = []
    in_block = False
    block_start = 0
    block_lines = []

    for idx, line in enumerate(lines, start=1):
        stripped = line.strip()
        if not stripped:
            if in_block:
                broken.append({"start": block_start, "end": idx - 1, "row_lines": block_lines[:]})
                in_block = False
                block_lines = []
            continue
        num_count = len(re.findall(r"\d+[\.,]?\d*", stripped))
        has_pipes = "|" in stripped
        is_list_item = bool(re.match(r"^[-*]|\d+\.\s", stripped))
        if num_count >= 3 and not has_pipes and len(stripped) < 80 and not is_list_item:
            if not in_block:
                block_start = idx
                in_block = True
            block_lines.append(idx)
        elif in_block:
            broken.append({"start": block_start, "end": idx - 1, "row_lines": block_lines[:]})
            in_block = False
            block_lines = []

    if in_block:
        broken.append({"start": block_start, "end": len(lines), "row_lines": block_lines[:]})

    return broken


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
            not stripped.endswith(profile.broken_line_endings)
            and len(stripped) > profile.broken_line_min_length
            and not _is_structural_line(stripped, profile)
        ):
            broken_lines.append({"line": idx, "section": current_section, "text": stripped})
            section_counts[current_section] = section_counts.get(current_section, 0) + 1

    return {"total": len(broken_lines), "items": broken_lines, "by_section": section_counts}


def detect_ghost_chapters(lines, profile):
    if not profile.stub_chapter_pattern:
        return []
    ghosts = []
    for idx, line in enumerate(lines, start=1):
        stripped = line.strip()
        if re.match(profile.stub_chapter_pattern, stripped, re.IGNORECASE):
            clean = re.sub(r"^#+\s*", "", stripped).strip()
            if len(clean) < 15:
                ghosts.append({"line": idx, "text": stripped})
    return ghosts


def count_structural_elements(lines, profile):
    figures = 0
    table_captions = 0
    footnotes = 0
    for line in lines:
        stripped = line.strip()
        if profile.figure_pattern and re.match(profile.figure_pattern, stripped, re.IGNORECASE):
            figures += 1
        if profile.table_caption_pattern and re.match(profile.table_caption_pattern, stripped, re.IGNORECASE):
            table_captions += 1
        if profile.footnote_pattern and re.match(profile.footnote_pattern, stripped, re.IGNORECASE):
            footnotes += 1
    return {"figures": figures, "table_captions": table_captions, "footnotes": footnotes}


def validate_required_sections(lines, profile):
    if not profile.required_sections:
        return []
    found = set()
    for line in lines:
        if is_heading(line, profile) or is_section_heading(line, profile):
            normalized = re.sub(r"^#+\s*", "", line.strip()).upper().strip()
            found.add(normalized)
    return [s for s in profile.required_sections if s.upper() not in found]


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


def build_warnings(metrics, broken, broken_tables, citations, missing_sections, strict=False):
    warnings = []
    errors = []
    if metrics["form_feeds"] > 0:
        target = errors if strict else warnings
        target.append(f"Found {metrics['form_feeds']} form feed/page break characters.")
    if broken["total"] > 0:
        target = errors if strict else warnings
        target.append(f"Found {broken['total']} likely broken lines.")
    if broken_tables:
        target = errors if strict else warnings
        target.append(f"Found {len(broken_tables)} possible broken table(s) (numeric rows without pipe separators).")
    if citations["missing_references"]:
        errors.append(f"Missing references for citations: {citations['missing_references']}.")
    if missing_sections:
        errors.append(f"Required sections not found: {missing_sections}.")
    return warnings, errors


def analyze_text(text, profile=None, strict=False):
    profile = profile or get_profile()
    lines = text.splitlines()
    metrics = collect_metrics(text)
    table_blocks = detect_table_blocks(lines)
    broken_tables = detect_broken_tables(lines)
    broken = detect_broken_lines(lines, profile)
    ghosts = detect_ghost_chapters(lines, profile)
    citations = analyze_citations(text, profile)
    structural = count_structural_elements(lines, profile)
    missing_sections = validate_required_sections(lines, profile)
    warnings, errors = build_warnings(metrics, broken, broken_tables, citations, missing_sections, strict=strict)
    severity = "error" if errors else "warning" if warnings else "ok"
    return {
        "severity": severity,
        "metrics": metrics,
        "warnings": warnings,
        "errors": errors,
        "table_blocks": table_blocks,
        "broken_tables": broken_tables,
        "broken_lines": broken,
        "ghost_chapters": ghosts,
        "citations": citations,
        "structural_elements": structural,
        "missing_required_sections": missing_sections,
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
        "citation_delta": clean_report["citations"]["citation_count"]
        - source_report["citations"]["citation_count"],
        "broken_line_delta": clean_report["broken_lines"]["total"]
        - source_report["broken_lines"]["total"],
        "table_block_delta": len(clean_report["table_blocks"]) - len(source_report["table_blocks"]),
        "broken_table_delta": len(clean_report["broken_tables"]) - len(source_report["broken_tables"]),
        "warnings": warnings,
        "errors": errors,
        "profile": profile.to_dict(),
    }


def compare_files(source_path, clean_path, profile=None, strict=False):
    profile = profile or get_profile()
    source_report = analyze_file(source_path, profile=profile, strict=False)
    clean_report = analyze_file(clean_path, profile=profile, strict=strict)
    return compare_reports(source_report, clean_report, profile=profile, strict=strict)


def chunk_by_headings(text, profile=None):
    profile = profile or get_profile()
    lines = text.splitlines()
    chunks = []
    current_heading = "FRONT MATTER"
    current_lines = []
    start_line = 1

    for idx, line in enumerate(lines, start=1):
        if is_heading(line.strip(), profile) and line.strip():
            if current_lines:
                chunks.append({
                    "heading": current_heading,
                    "start_line": start_line,
                    "end_line": idx - 1,
                    "text": "\n".join(current_lines).strip(),
                    "word_count": count_words("\n".join(current_lines)),
                })
            current_heading = re.sub(r"^#+\s*", "", line.strip()).strip()
            current_lines = [line]
            start_line = idx
        else:
            current_lines.append(line)

    if current_lines:
        chunks.append({
            "heading": current_heading,
            "start_line": start_line,
            "end_line": len(lines),
            "text": "\n".join(current_lines).strip(),
            "word_count": count_words("\n".join(current_lines)),
        })

    return chunks


def chunk_file(path, profile=None):
    profile = profile or get_profile()
    return chunk_by_headings(read_text(path), profile=profile)

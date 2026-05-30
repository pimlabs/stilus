import json
from pathlib import Path


def write_json(path, data):
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def print_inspection(report, title="MANUSCRIPT INSPECTION"):
    metrics = report["metrics"]
    print("=" * 70)
    print(title)
    print("=" * 70)
    print(f"Severity              : {report['severity']}")
    print()
    print(f"Characters            : {metrics['characters']:,}")
    print(f"Words                 : {metrics['words']:,}")
    print(f"Lines                 : {metrics['lines']:,}")
    print(f"Empty line ratio      : {metrics['empty_line_ratio']:.1f}%")
    print()
    print(f"Page breaks           : {metrics['form_feeds']}")
    print(f"Table blocks          : {len(report['table_blocks'])}")
    print(f"Broken tables (likely): {len(report.get('broken_tables', []))}")
    print(f"Broken lines (likely) : {report['broken_lines']['total']}")
    print(f"Ghost headings        : {len(report['ghost_chapters'])}")
    se = report.get("structural_elements", {})
    if any(se.get(k, 0) for k in ("figures", "table_captions", "footnotes")):
        print()
        print(f"Figures               : {se.get('figures', 0)}")
        print(f"Table captions        : {se.get('table_captions', 0)}")
        if se.get("footnotes", 0):
            print(f"Footnotes             : {se.get('footnotes', 0)}")
    print()
    print(f"Citations             : {report['citations']['citation_count']}")
    print(f"References found      : {report['citations']['reference_count']}")
    if report["citations"]["missing_references"]:
        print(f"Missing references    : {report['citations']['missing_references']}")
    if report.get("missing_required_sections"):
        print(f"Missing sections      : {report['missing_required_sections']}")
    by_section = {
        sec: count
        for sec, count in report["broken_lines"]["by_section"].items()
        if count > 0
    }
    if by_section:
        print("\nBroken lines by section:")
        for section, count in by_section.items():
            print(f"  {count:>3}  {section}")
    if report["warnings"]:
        print("\nWarnings:")
        for warning in report["warnings"]:
            print(f"  - {warning}")
    if report["errors"]:
        print("\nErrors:")
        for error in report["errors"]:
            print(f"  - {error}")
    print("=" * 70)


def print_chunk_summary(chunks, output_dir):
    print("=" * 70)
    print(f"MANUSCRIPT CHUNKS: {output_dir}")
    print("=" * 70)
    print(f"Total chunks          : {len(chunks)}")
    print(f"Total words           : {sum(c['word_count'] for c in chunks):,}")
    print()
    for idx, chunk in enumerate(chunks):
        slug = chunk["slug"]
        print(f"  {idx:02d}  {slug:<40}  {chunk['word_count']:>6} words  (lines {chunk['start_line']}–{chunk['end_line']})")
    print("=" * 70)


def print_compare(report):
    print("=" * 70)
    print("MANUSCRIPT COMPARISON")
    print("=" * 70)
    print(f"Severity              : {report['severity']}")
    print()
    print(f"Character delta       : {report['character_delta']:+d}")
    print(f"Word delta            : {report['word_delta']:+d}")
    print()
    print(f"Table blocks delta    : {report.get('table_block_delta', 0):+d}")
    print(f"Broken tables delta   : {report.get('broken_table_delta', 0):+d}")
    print(f"Broken lines delta    : {report['broken_line_delta']:+d}")
    print()
    print(f"Citations delta       : {report.get('citation_delta', 0):+d}")
    print(f"References delta      : {report['reference_delta']:+d}")
    if report["warnings"]:
        print("\nWarnings:")
        for warning in report["warnings"]:
            print(f"  - {warning}")
    if report["errors"]:
        print("\nErrors:")
        for error in report["errors"]:
            print(f"  - {error}")
    print("=" * 70)

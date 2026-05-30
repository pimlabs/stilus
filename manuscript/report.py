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
    print(f"Characters            : {metrics['characters']:,}")
    print(f"Words                 : {metrics['words']:,}")
    print(f"Lines                 : {metrics['lines']:,}")
    print(f"Empty line ratio      : {metrics['empty_line_ratio']:.1f}%")
    print(f"Form feeds            : {metrics['form_feeds']}")
    print(f"Table blocks          : {len(report['table_blocks'])}")
    print(f"Broken lines          : {report['broken_lines']['total']}")
    print(f"Ghost chapters        : {len(report['ghost_chapters'])}")
    print(f"Citations             : {report['citations']['citation_count']}")
    print(f"References            : {report['citations']['reference_count']}")
    if report["warnings"]:
        print("\nWarnings:")
        for warning in report["warnings"]:
            print(f"- {warning}")
    if report["errors"]:
        print("\nErrors:")
        for error in report["errors"]:
            print(f"- {error}")
    print("=" * 70)


def print_compare(report):
    print("=" * 70)
    print("MANUSCRIPT COMPARISON")
    print("=" * 70)
    print(f"Severity              : {report['severity']}")
    print(f"Character delta       : {report['character_delta']:+d}")
    print(f"Word delta            : {report['word_delta']:+d}")
    print(f"Reference delta       : {report['reference_delta']:+d}")
    print(f"Broken line delta     : {report['broken_line_delta']:+d}")
    if report["warnings"]:
        print("\nWarnings:")
        for warning in report["warnings"]:
            print(f"- {warning}")
    if report["errors"]:
        print("\nErrors:")
        for error in report["errors"]:
            print(f"- {error}")
    print("=" * 70)

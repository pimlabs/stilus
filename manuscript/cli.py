import argparse
from pathlib import Path

from .analyzer import analyze_file, compare_files
from .cleaner import clean_manuscript
from .config import get_profile
from .report import print_compare, print_inspection, write_json


SAMPLE_INPUT = Path("data/example.md")
SAMPLE_OUTPUT = Path("dist/example-clean.md")


def add_common_options(parser):
    parser.add_argument("--profile", default="indonesian-book", help="Heuristic profile to use.")
    parser.add_argument("--strict", action="store_true", help="Exit with error on strict QA failures.")


def resolve_profile(args):
    return get_profile(args.profile)


def command_inspect(args):
    profile = resolve_profile(args)
    input_value = args.input_path or args.input
    input_path = SAMPLE_INPUT if args.sample else Path(input_value)
    report = analyze_file(input_path, profile=profile, strict=args.strict)
    print_inspection(report, title=f"MANUSCRIPT INSPECTION: {input_path}")
    if args.json:
        write_json(args.json, report)
    return 1 if report["severity"] == "error" else 0


def command_clean(args):
    profile = resolve_profile(args)
    input_value = args.input_path or args.input
    output_value = args.output_path or args.output
    input_path = SAMPLE_INPUT if args.sample else Path(input_value)
    output_path = SAMPLE_OUTPUT if args.sample and not output_value else Path(output_value)
    _clean_text, manifest, manifest_path = clean_manuscript(
        input_path, output_path, profile=profile, strict=args.strict
    )
    write_json(manifest_path, manifest)
    print(f"Cleaned manuscript written to: {output_path}")
    print(f"Manifest written to          : {manifest_path}")
    print(f"Severity                     : {manifest['severity']}")
    return 1 if manifest["severity"] == "error" else 0


def command_compare(args):
    profile = resolve_profile(args)
    source_value = args.source_path or args.source
    clean_value = args.clean_path or args.clean
    report = compare_files(source_value, clean_value, profile=profile, strict=args.strict)
    print_compare(report)
    if args.json:
        write_json(args.json, report)
    return 1 if report["severity"] == "error" else 0


def build_parser():
    parser = argparse.ArgumentParser(description="Manuscript QA and cleanup CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    inspect_parser = subparsers.add_parser("inspect", help="Inspect a manuscript.")
    inspect_parser.add_argument("input_path", nargs="?", help="Input Markdown file.")
    inspect_parser.add_argument("--input", help="Input Markdown file. Deprecated; use positional input.")
    inspect_parser.add_argument("--sample", action="store_true", help="Use data/example.md.")
    inspect_parser.add_argument("--json", help="Optional JSON report path.")
    add_common_options(inspect_parser)
    inspect_parser.set_defaults(func=command_inspect)

    clean_parser = subparsers.add_parser("clean", help="Clean a manuscript.")
    clean_parser.add_argument("input_path", nargs="?", help="Input Markdown file.")
    clean_parser.add_argument("--input", help="Input Markdown file. Deprecated; use positional input.")
    clean_parser.add_argument("--sample", action="store_true", help="Use data/example.md.")
    clean_parser.add_argument("-o", "--output", dest="output", help="Output Markdown file.")
    clean_parser.add_argument("--output-path", dest="output_path", help=argparse.SUPPRESS)
    add_common_options(clean_parser)
    clean_parser.set_defaults(func=command_clean)

    compare_parser = subparsers.add_parser("compare", help="Compare source and clean files.")
    compare_parser.add_argument("source_path", nargs="?", help="Source Markdown file.")
    compare_parser.add_argument("clean_path", nargs="?", help="Clean Markdown file.")
    compare_parser.add_argument("--source", help="Source Markdown file. Deprecated; use positional source.")
    compare_parser.add_argument("--clean", help="Clean Markdown file. Deprecated; use positional clean.")
    compare_parser.add_argument("--json", help="Optional JSON report path.")
    add_common_options(compare_parser)
    compare_parser.set_defaults(func=command_compare)

    return parser


def validate_args(args, parser):
    if args.command == "inspect":
        has_input = bool(args.input_path or args.input or getattr(args, "sample", False))
        if not has_input:
            parser.error(f"{args.command} requires an input path or --sample.")
        if getattr(args, "sample", False) and (args.input_path or args.input):
            parser.error(f"{args.command} accepts either an input path or --sample, not both.")
    if args.command == "clean":
        has_input = bool(args.input_path or args.input or args.sample)
        has_output = bool(args.output_path or args.output or args.sample)
        if not has_input:
            parser.error("clean requires an input path or --sample.")
        if args.sample and (args.input_path or args.input):
            parser.error("clean accepts either an input path or --sample, not both.")
        if not has_output:
            parser.error("clean requires -o/--output unless --sample is used.")
    if args.command == "compare":
        if not (args.source_path or args.source):
            parser.error("compare requires a source path.")
        if not (args.clean_path or args.clean):
            parser.error("compare requires a clean path.")


def main(argv=None):
    parser = build_parser()
    args = parser.parse_args(argv)
    validate_args(args, parser)
    try:
        return args.func(args)
    except (OSError, ValueError) as exc:
        print(f"Error: {exc}")
        return 1

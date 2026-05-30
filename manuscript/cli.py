import argparse
import sys
from pathlib import Path

from .analyzer import analyze_file, chunk_file, compare_files
from .cleaner import clean_manuscript
from .config import DEFAULT_PROFILE, get_profile, list_profiles
from .report import print_chunk_summary, print_compare, print_inspection, write_json


SAMPLE_INPUT = Path("data/example.md")
SAMPLE_OUTPUT = Path("dist/example-clean.md")


def add_common_options(parser):
    parser.add_argument("--profile", default=DEFAULT_PROFILE, help="Built-in profile name or path to a JSON profile file.")
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
    dry_run = getattr(args, "dry_run", False)
    if args.sample and not output_value:
        output_path = SAMPLE_OUTPUT
    elif dry_run and not output_value:
        output_path = input_path.with_suffix(".clean.md")
    else:
        output_path = Path(output_value)
    _clean_text, manifest, manifest_path = clean_manuscript(
        input_path, output_path, profile=profile, strict=args.strict, dry_run=dry_run
    )
    if not dry_run:
        manifest_out = Path(args.manifest) if getattr(args, "manifest", None) else manifest_path
        write_json(manifest_out, manifest)
        print(f"Cleaned:  {output_path}")
        print(f"Manifest: {manifest_out}")
    else:
        print("Dry run — no files written.")
    if getattr(args, "json", None):
        write_json(args.json, manifest)
    print(f"Severity: {manifest['severity']}")
    return 1 if manifest["severity"] == "error" else 0


def command_chunk(args):
    import re
    profile = resolve_profile(args)
    input_path = Path(args.input_path)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    chunks = chunk_file(input_path, profile=profile)
    written = []
    for idx, chunk in enumerate(chunks):
        slug = re.sub(r"[^\w]+", "-", chunk["heading"].lower()).strip("-")
        slug = slug[:60] or f"chunk-{idx:02d}"
        filename = f"{idx:02d}-{slug}.md"
        out_path = output_dir / filename
        out_path.write_text(chunk["text"] + "\n", encoding="utf-8")
        chunk["slug"] = filename
        written.append(out_path)
    if args.json:
        write_json(args.json, chunks)
    print_chunk_summary(chunks, output_dir)
    return 0


def command_profiles(args):
    import json as _json
    profiles = list_profiles()
    if args.json:
        print(_json.dumps(profiles, indent=2))
    else:
        print("Available profiles (manuscript/profiles/):\n")
        for p in profiles:
            ext = f"extends: {p['extends']}" if p["extends"] else "(base)"
            print(f"  {p['name']:<22}{ext}")
    return 0


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
    clean_parser.add_argument("--manifest", dest="manifest", help="Override manifest output path (default: <output_dir>/manifest.json).")
    clean_parser.add_argument("--json", dest="json", help="Write full manifest JSON to this path (for structured output).")
    clean_parser.add_argument("--dry-run", dest="dry_run", action="store_true", help="Analyze without writing any files.")
    add_common_options(clean_parser)
    clean_parser.set_defaults(func=command_clean)

    chunk_parser = subparsers.add_parser("chunk", help="Split manuscript into per-chapter files.")
    chunk_parser.add_argument("input_path", help="Input Markdown file.")
    chunk_parser.add_argument("-o", "--output-dir", dest="output_dir", required=True, help="Output directory for chunk files.")
    chunk_parser.add_argument("--json", help="Optional JSON report path.")
    chunk_parser.add_argument("--profile", default=DEFAULT_PROFILE, help="Built-in profile name or path to a JSON profile file.")
    chunk_parser.set_defaults(func=command_chunk)

    profiles_parser = subparsers.add_parser("profiles", help="List available built-in profiles.")
    profiles_parser.add_argument("--json", action="store_true", help="Output as JSON.")
    profiles_parser.set_defaults(func=command_profiles)

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
        has_output = bool(args.output_path or args.output or args.sample or getattr(args, "dry_run", False))
        if not has_input:
            parser.error("clean requires an input path or --sample.")
        if args.sample and (args.input_path or args.input):
            parser.error("clean accepts either an input path or --sample, not both.")
        if not has_output:
            parser.error("clean requires -o/--output unless --sample or --dry-run is used.")
    if args.command == "chunk":
        if not args.input_path:
            parser.error("chunk requires an input path.")
        if not args.output_dir:
            parser.error("chunk requires -o/--output-dir.")
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
        print(f"Error: {exc}", file=sys.stderr)
        return 1

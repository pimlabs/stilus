import sys

from manuscript.cli import main


if __name__ == "__main__":
    args = sys.argv[1:]
    if "--file" in args:
        args = ["--input" if arg == "--file" else arg for arg in args]
    raise SystemExit(main(["inspect", *args]))

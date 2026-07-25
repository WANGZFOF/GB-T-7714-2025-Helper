#!/usr/bin/env python3
"""Build a byte-for-byte reproducible Zotero XPI archive."""

from __future__ import annotations

import sys
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


ROOT_FILES = (
    "manifest.json",
    "bootstrap.js",
    "LICENSE",
    "PRIVACY.md",
    "README.md",
)
ROOT_DIRS = ("content", "styles")
FIXED_TIMESTAMP = (2025, 1, 1, 0, 0, 0)


def iter_files(project_dir: Path):
    for relative in ROOT_FILES:
        yield project_dir / relative
    for relative in ROOT_DIRS:
        for path in (project_dir / relative).rglob("*"):
            if path.is_file() and path.name != ".DS_Store":
                yield path


def build(project_dir: Path, output_file: Path) -> None:
    files = sorted(iter_files(project_dir), key=lambda path: path.relative_to(project_dir).as_posix())
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with ZipFile(output_file, "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for path in files:
            relative = path.relative_to(project_dir).as_posix()
            info = ZipInfo(relative, FIXED_TIMESTAMP)
            info.create_system = 3
            info.compress_type = ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, path.read_bytes(), compress_type=ZIP_DEFLATED, compresslevel=9)


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: build_xpi.py PROJECT_DIR OUTPUT_FILE")
    build(Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve())


if __name__ == "__main__":
    main()

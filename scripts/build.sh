#!/bin/sh
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
output_dir="$project_dir/dist"
version=$(node -p "require('$project_dir/manifest.json').version")
output_file="$output_dir/gbt7714-2025-helper-$version.xpi"

mkdir -p "$output_dir"
rm -f "$output_file"
python3 "$project_dir/scripts/build_xpi.py" "$project_dir" "$output_file"

output_hash=$(shasum -a 256 "$output_file" | awk '{print $1}')
style_hash=$(shasum -a 256 "$project_dir/styles/gb-t-7714-2025-numeric-bilingual.csl" | awk '{print $1}')
{
  printf '%s  %s\n' "$output_hash" "$(basename "$output_file")"
  printf '%s  %s\n' "$style_hash" "gb-t-7714-2025-numeric-bilingual.csl"
} > "$output_dir/SHA256SUMS"

printf '%s\n' "$output_file"

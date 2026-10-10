#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${GO_BIN:=go}"
command -v "$GO_BIN" >/dev/null || { printf 'Go 1.24+ is required to build pinned MinIO source.\n' >&2; exit 1; }
root=.codex-runs/c2-local/toolchain
mkdir -p "$root"
chmod 700 .codex-runs/c2-local "$root"
archive="$root/minio-src.tar.gz"
source_dir="$root/minio-RELEASE.2025-09-07T16-13-09Z"
if [[ ! -f "$archive" ]]; then
  curl --fail --location --silent --show-error --retry 2 \
    https://codeload.github.com/minio/minio/tar.gz/refs/tags/RELEASE.2025-09-07T16-13-09Z -o "$archive"
fi
printf 'c9598dcce3440977e79f787f2ba0e7e4d92c8d556bd51e7cef3785bafd6635f3  %s\n' "$archive" | sha256sum -c -
if [[ ! -d "$source_dir" ]]; then tar -xzf "$archive" -C "$root"; fi
output_dir="$(realpath "$root")"
(cd "$source_dir" && GOTOOLCHAIN=local "$GO_BIN" build -o "$output_dir/minio" .)
printf 'Pinned MinIO build ready in ignored local toolchain directory.\n'

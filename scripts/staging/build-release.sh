#!/usr/bin/env bash
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
output="${1:?Usage: build-release.sh /absolute/output.tar.gz}"
[[ "$output" = /* ]] || { echo 'Output path must be absolute' >&2; exit 1; }
[[ "$(node -p 'process.versions.node.split(".")[0]')" = 24 ]] || { echo 'Node 24 is required' >&2; exit 1; }
[[ "$(npm --version | cut -d. -f1)" = 12 ]] || { echo 'npm 12 is required' >&2; exit 1; }

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/release/apps/server" "$tmp/release/apps/studio" "$tmp/release/packages"
cp "$repo/package.json" "$repo/package-lock.json" "$tmp/release/"
for app in server studio; do
  cp "$repo/apps/$app/package.json" "$tmp/release/apps/$app/"
done
cp -a "$repo/apps/server/dist" "$repo/apps/server/migrations" "$tmp/release/apps/server/"
cp -a "$repo/apps/studio/dist" "$tmp/release/apps/studio/"
for package in agent channel-engine contracts generator tv; do
  mkdir -p "$tmp/release/packages/$package"
  cp "$repo/packages/$package/package.json" "$tmp/release/packages/$package/"
  cp -a "$repo/packages/$package/dist" "$tmp/release/packages/$package/"
done
cp -a "$repo/templates" "$tmp/release/"
(
  cd "$tmp/release"
  npm ci --omit=dev --ignore-scripts --no-audit --no-fund
  node --input-type=module -e "import('@firelaunch/generator').then(() => console.log('Runtime workspace imports OK'))"
)
mkdir -p "$(dirname "$output")"
tar -C "$tmp/release" --sort=name --owner=0 --group=0 --numeric-owner -czf "$output" .
sha256sum "$output" > "$output.sha256"
echo "Release artifact: $output"
echo "SHA-256: $(cut -d' ' -f1 "$output.sha256")"

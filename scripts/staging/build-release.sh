#!/usr/bin/env bash
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
output="${1:?Usage: build-release.sh /absolute/output.tar.gz /absolute/active-studio-index.html}"
prior_index="${2:?Usage: build-release.sh /absolute/output.tar.gz /absolute/active-studio-index.html}"
[[ "$output" = /* ]] || { echo 'Output path must be absolute' >&2; exit 1; }
[[ "$prior_index" = /* && -f "$prior_index" && ! -L "$prior_index" ]] || { echo 'Active Studio index must be an absolute regular file' >&2; exit 1; }
[[ "$(node -p 'process.versions.node.split(".")[0]')" = 24 ]] || { echo 'Node 24 is required' >&2; exit 1; }
[[ "$(npm --version | cut -d. -f1)" = 12 ]] || { echo 'npm 12 is required' >&2; exit 1; }

# Check the new entrypoint before packaging.
node "$repo/scripts/staging/smoke-studio.mjs" "$repo/apps/studio/dist"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/release/apps/server" "$tmp/release/apps/studio" "$tmp/release/packages"
cp "$repo/package.json" "$repo/package-lock.json" "$tmp/release/"
for app in server studio; do
  cp "$repo/apps/$app/package.json" "$tmp/release/apps/$app/"
done
cp -a "$repo/apps/server/dist" "$repo/apps/server/migrations" "$tmp/release/apps/server/"
cp -a "$repo/apps/studio/dist" "$tmp/release/apps/studio/"
# Carry the active release's bounded hashed JS/CSS inventory, including assets
# retained from its own predecessor. A browser may keep either cached HTML
# across consecutive atomic switches; Nginx serves HTML for missing modules.
mapfile -t entry_assets < <(grep -oE '/assets/[A-Za-z0-9_-]+\.(js|css)' "$prior_index" | sort -u)
[[ ${#entry_assets[@]} -ge 2 && ${#entry_assets[@]} -le 8 ]] || { echo 'Unexpected active Studio entrypoint assets' >&2; exit 1; }
prior_assets_dir="$(dirname "$prior_index")/assets"
[[ -d "$prior_assets_dir" && ! -L "$prior_assets_dir" ]] || { echo 'Active Studio assets directory is unsafe' >&2; exit 1; }
mapfile -t prior_assets < <(find "$prior_assets_dir" -mindepth 1 -maxdepth 1 \( -name '*.js' -o -name '*.css' \) -printf '%f\n' | sort -u)
# Consecutive protected releases retain older hashed entrypoints for cached browsers.
# Successive browser-required checkpoints retain earlier entrypoints for cached tabs.
# Keep a finite cap while allowing the P3 source and its first corrected release.
[[ ${#prior_assets[@]} -ge ${#entry_assets[@]} && ${#prior_assets[@]} -le 64 ]] || { echo 'Unexpected retained Studio asset inventory' >&2; exit 1; }
for asset in "${entry_assets[@]}"; do
  [[ -f "$(dirname "$prior_index")$asset" ]] || { echo "Active Studio entrypoint asset missing: $asset" >&2; exit 1; }
done
for asset_name in "${prior_assets[@]}"; do
  [[ "$asset_name" =~ ^[A-Za-z0-9_-]+\.(js|css)$ ]] || { echo "Unsafe retained Studio asset name: $asset_name" >&2; exit 1; }
  source_asset="$prior_assets_dir/$asset_name"
  target_asset="$tmp/release/apps/studio/dist/assets/$asset_name"
  [[ -f "$source_asset" && ! -L "$source_asset" && "$(stat -c %s "$source_asset")" -le 5000000 ]] || { echo "Unsafe or missing prior Studio asset: $asset_name" >&2; exit 1; }
  if [[ -e "$target_asset" ]]; then
    cmp -s "$source_asset" "$target_asset" || { echo "Studio asset hash-name collision: $asset_name" >&2; exit 1; }
  else
    cp "$source_asset" "$target_asset"
  fi
done
# A previously cached entrypoint must execute with the assembled release.
node "$repo/scripts/staging/smoke-studio.mjs" "$tmp/release/apps/studio/dist" "$prior_index"
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
mkdir -p "$tmp/release/infra/aws-media" "$tmp/release/scripts"
cp "$repo/infra/aws-media/hls-avc-aac-v1.settings.json" "$tmp/release/infra/aws-media/"
cp -a "$repo/scripts/staging" "$tmp/release/scripts/"
# Privileged host preparation is an operator-only input, never release runtime.
rm -f "$tmp/release/scripts/staging/prepare-privileged.sh"
tar -C "$tmp/release" --sort=name --owner=0 --group=0 --numeric-owner -czf "$output" .
sha256sum "$output" > "$output.sha256"
echo "Release artifact: $output"
echo "SHA-256: $(cut -d' ' -f1 "$output.sha256")"

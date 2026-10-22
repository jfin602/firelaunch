#!/usr/bin/env bash
# One-time reviewed schema 14 -> 15 staging cutover for P8D P2.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

artifact="${1:?Usage: deploy-audio-schema15.sh RELEASE.tar.gz EXPECTED_SHA256}"
operator_hash="${2:?Exact SHA-256 required}"
[[ $# = 2 && "$operator_hash" =~ ^[a-f0-9]{64}$ ]] || die 'Invalid release hash'
require_operator
require_layout
health || die 'Existing staging health failed'
[[ "$artifact" = /home/deploy/firelaunch-incoming/*.tar.gz && -f "$artifact" && ! -L "$artifact" && -f "$artifact.sha256" ]] || die 'Unsafe release archive'
[[ "$(cut -d' ' -f1 "$artifact.sha256")" = "$operator_hash" && "$(sha256sum "$artifact" | cut -d' ' -f1)" = "$operator_hash" ]] || die 'Release checksum mismatch'
validate_archive "$artifact"

old="$(readlink -f "$base/current")"
[[ "$(schema_max "$old")" = 14 && "$(database_schema "$old")" = 14 ]] || die 'Expected schema 14 baseline is absent'
release="$(date -u +%Y%m%dT%H%M%SZ)-${operator_hash:0:12}"
target="$base/releases/$release"
[[ ! -e "$target" ]] || die 'Release already exists'
mkdir -m 0755 "$target"
tar -xzf "$artifact" -C "$target" --no-same-owner
chown -R root:root "$target"
chmod -R go-w "$target"
[[ "$(schema_max "$target")" = 15 && -f "$target/apps/server/dist/index.js" && -f "$target/scripts/staging/apply-audio-schema-down.mjs" ]] || die 'Schema 15 release is incomplete'
[[ "$("$node_bin" -p "require('$target/package.json').version")" = 0.8.15 ]] || die 'Unexpected release version'

# This backup is made by the currently running schema-14 binary and verified by
# its existing operator script before the application or proxy configuration moves.
"$(dirname "${BASH_SOURCE[0]}")/backup.sh" "${release}-pre-audio-schema15"
"$node_bin" --env-file="$env_file" "$target/scripts/staging/rehearse-audio-restore.mjs" "$old" \
  "$backup_dir/${release}-pre-audio-schema15-schema-14.flrec"
nginx_site=/etc/nginx/sites-available/firelaunch-staging
nginx_saved="$backup_dir/${release}-nginx-before-audio-schema15.conf"
[[ -f "$nginx_site" && ! -L "$nginx_site" && ! -e "$nginx_saved" ]] || die 'Nginx configuration cannot be protected'
install -o root -g root -m 0600 "$nginx_site" "$nginx_saved"
snippet="$target/scripts/staging/nginx-audio-location.conf"
[[ -f "$snippet" && ! -L "$snippet" ]] || die 'Audio ingress location missing'
python3 - "$nginx_site" "$snippet" <<'PY'
from pathlib import Path
import sys
site, snippet = map(Path, sys.argv[1:])
text = site.read_text()
needle = '    location /api/ {\n'
if text.count(needle) != 1 or 'client_max_body_size 2m;' not in text or 'private-objects/audio$' in text:
    raise SystemExit('Unexpected Nginx baseline')
site.write_text(text.replace(needle, snippet.read_text() + needle, 1))
PY
nginx -t || { install -o root -g root -m 0644 "$nginx_saved" "$nginx_site"; die 'Nginx candidate rejected'; }

restore_before_acceptance() {
  local status=$?
  if (( status == 0 )) || [[ -n "${accepted:-}" ]]; then return; fi
  install -o root -g root -m 0644 "$nginx_saved" "$nginx_site"
  nginx -t && systemctl reload nginx || true
  if [[ "$(database_schema "$target" 2>/dev/null || true)" = 15 ]]; then
    "$node_bin" --env-file="$env_file" "$target/scripts/staging/apply-audio-schema-down.mjs" "$target" || true
  fi
  switch_release "$(basename "$old")"
  systemctl restart "$unit" && wait_health || true
  echo 'Cutover failed; review database schema and protected backup before further action' >&2
}
trap restore_before_acceptance EXIT

switch_release "$release"
systemctl restart "$unit"
wait_health || die 'Candidate application health failed'
[[ "$(database_schema "$target")" = 15 ]] || die 'Candidate did not apply schema 15'
systemctl reload nginx
health || die 'HTTPS health failed after Nginx reload'
set_previous "$old"
# Future protected backups must understand large MP3 object metadata and archive size.
install -o root -g root -m 0755 "$target/scripts/staging/backup.sh" "$(dirname "${BASH_SOURCE[0]}")/backup.sh"
accepted=1
echo "Staging audio release active: $release; schema 14 -> 15; protected backup and Nginx copy retained"

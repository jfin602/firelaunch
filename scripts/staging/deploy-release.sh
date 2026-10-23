#!/usr/bin/env bash
# Run on muffinos as root after separately copying a reviewed release archive.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

artifact="${1:?Usage: sudo deploy-release.sh /home/deploy/vegalaunch-incoming/release.tar.gz EXPECTED_SHA256}"
operator_hash="${2:?Record the build workstation SHA-256 independently before deployment}"
[[ $# = 2 ]] || die 'Schema-changing cutover is disabled pending an isolated restore rehearsal and reviewed procedure'
[[ "$operator_hash" =~ ^[a-f0-9]{64}$ ]] || die 'Invalid operator-provided SHA-256'
require_operator
require_layout
health || die 'Existing staging HTTPS health check failed'
[[ "$artifact" = /home/deploy/vegalaunch-incoming/*.tar.gz && -f "$artifact" && ! -L "$artifact" && -f "$artifact.sha256" ]] || die 'Release archive must be a regular file in the staging incoming directory'
expected="$(cut -d' ' -f1 "$artifact.sha256")"
[[ "$expected" = "$operator_hash" && "$(sha256sum "$artifact" | cut -d' ' -f1)" = "$operator_hash" ]] || die 'Release checksum mismatch'
validate_archive "$artifact"

release="$(date -u +%Y%m%dT%H%M%SZ)-${expected:0:12}"
target="$base/releases/$release"
[[ ! -e "$target" ]] || die 'Release already exists'
mkdir -m 0755 "$target"
trap '[[ -n "${activated:-}" ]] || rm -rf -- "$target"' EXIT
tar -xzf "$artifact" -C "$target" --no-same-owner
chown -R root:root "$target"
chmod -R go-w "$target"
[[ -f "$target/apps/server/dist/index.js" && -f "$target/apps/server/dist/operations-cli.js" && -f "$target/scripts/staging/schema-version.mjs" ]] || die 'Release is incomplete'
old="$(readlink -f "$base/current")"
old_schema="$(schema_max "$old")"
new_schema="$(schema_max "$target")"
db_schema="$(database_schema "$target")"
[[ "$db_schema" = "$old_schema" ]] || die 'Live database schema differs from running release'
[[ "$new_schema" = "$old_schema" ]] || die 'Schema-changing cutover is disabled; use a separately rehearsed database and object recovery procedure'

# This path is schema-compatible only. The independent backup procedure checks
# capacity and validates the encrypted archive before the release link changes.
backup_script="$(dirname "${BASH_SOURCE[0]}")/backup.sh"
[[ -f "$backup_script" && ! -L "$backup_script" && "$(stat -c '%U' "$backup_script")" = root ]] || die 'Backup script must be root owned'
backup_mode="$(stat -c '%a' "$backup_script")"
[[ $((8#$backup_mode & 022)) = 0 ]] || die 'Backup script is writable by another user'
"$backup_script" "${release}-pre-deploy"

systemctl daemon-reload
[[ "$(systemctl show "$unit" -p DropInPaths --value)" = "$drop_in" ]] || die 'Unexpected staging systemd drop-ins'
require_layout
switch_release "$release"
activated=1
if systemctl restart "$unit" && wait_health; then
  set_previous "$old"
  echo "Staging release active: $release; schema $db_schema -> $new_schema"
  exit 0
fi

switch_release "$(basename "$old")"
if systemctl restart "$unit" && wait_health; then
  die 'Candidate failed health; prior compatible release restored'
fi
die 'Candidate and prior release failed health; operator intervention required'

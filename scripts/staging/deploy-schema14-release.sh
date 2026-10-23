#!/usr/bin/env bash
# One-time, protected staging cutover for c6-supporting-media migration 014.
# Install as root in /opt/firelaunch-staging-ops; never run from the checkout.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

artifact="${1:?Usage: deploy-schema14-release.sh ARCHIVE SHA256 EXPECTED_CURRENT_RELEASE}"
operator_hash="${2:?Independently recorded archive SHA-256 required}"
expected_current="${3:?Independently observed current release name required}"
[[ $# = 3 && "$operator_hash" =~ ^[a-f0-9]{64}$ &&
   "$expected_current" =~ ^[0-9]{8}T[0-9]{6}Z-[a-f0-9]{12}$ ]] || die 'Invalid cutover arguments'
require_operator
require_layout
health || die 'Existing staging HTTPS health check failed'
[[ "$artifact" = /home/deploy/firelaunch-incoming/*.tar.gz && -f "$artifact" && ! -L "$artifact" && -f "$artifact.sha256" ]] || die 'Unexpected archive path'
[[ "$(cut -d' ' -f1 "$artifact.sha256")" = "$operator_hash" &&
   "$(sha256sum "$artifact" | cut -d' ' -f1)" = "$operator_hash" ]] || die 'Archive checksum mismatch'
validate_archive "$artifact"

old="$(readlink -f "$base/current")"
[[ "$(basename "$old")" = "$expected_current" && "$(schema_max "$old")" = 13 &&
   "$(database_schema "$old")" = 13 ]] || die 'Live release or database changed since preflight'
[[ "$($node_bin -p "require('$old/package.json').version")" = 0.6.7 ]] || die 'Unexpected old version'

release="$(date -u +%Y%m%dT%H%M%SZ)-${operator_hash:0:12}"
target="$base/releases/$release"
[[ ! -e "$target" ]] || die 'Release already exists'
mkdir -m 0755 "$target"
trap '[[ -n "${activated:-}" ]] || rm -rf -- "$target"' EXIT
tar -xzf "$artifact" -C "$target" --no-same-owner
chown -R root:root "$target"
chmod -R go-w "$target"
[[ "$(schema_max "$target")" = 14 && "$($node_bin -p "require('$target/package.json').version")" = 0.6.7 ]] || die 'Candidate schema/version mismatch'
[[ "$(sha256sum "$target/apps/server/migrations/014_video_subtitles.up.sql" | cut -d' ' -f1)" = db002ed32096cb212f27c4d75c01b61a46315ecfa341474d5703494393efc667 ]] || die 'Migration 014 differs from rehearsal'
[[ -f "$target/apps/server/dist/index.js" && -f "$target/apps/studio/dist/index.html" ]] || die 'Incomplete candidate'

# The running schema-13 binary creates the protected backup before writes stop.
"$(dirname "${BASH_SOURCE[0]}")/backup.sh" "$(date -u +%Y%m%dT%H%M%SZ)-c6s-schema14-predeploy"
systemctl stop "$unit"
if [[ "$(systemctl is-active "$unit" || true)" != inactive || "$(database_schema "$old")" != 13 ]]; then
  systemctl start "$unit" || true
  die 'Service did not stop cleanly or database changed'
fi

if ! runuser -u postgres -- psql -X -v ON_ERROR_STOP=1 -1 -d firelaunch_alpha_067 \
    -f "$target/apps/server/migrations/014_video_subtitles.up.sql" \
    -c 'GRANT SELECT, INSERT, UPDATE, DELETE ON video_subtitle_tracks TO firelaunch_staging' \
    -c 'INSERT INTO firelaunch_schema_migrations(version) VALUES (14)' >/dev/null; then
  systemctl start "$unit" || true
  die 'Migration failed; old release retained'
fi
# Retain the candidate for recovery once the database may be at schema 14.
activated=1
[[ "$(database_schema "$target")" = 14 ]] || die 'Migration did not record schema 14'

switch_release "$release"
if systemctl restart "$unit" && wait_health; then
  activated=1
  set_previous "$old"
  echo "Staging release active: $release; schema 13 -> 14"
  exit 0
fi

# Automatic recovery is safe only before any private subtitle is stored.
systemctl stop "$unit" || true
if [[ "$(runuser -u postgres -- psql -X -Atqc "SELECT count(*) FROM video_subtitle_tracks" -d firelaunch_alpha_067)" = 0 &&
      "$(runuser -u postgres -- psql -X -Atqc "SELECT count(*) FROM private_objects WHERE content_type='text/vtt'" -d firelaunch_alpha_067)" = 0 ]]; then
  runuser -u postgres -- psql -X -v ON_ERROR_STOP=1 -1 -d firelaunch_alpha_067 \
    -f "$target/apps/server/migrations/014_video_subtitles.down.sql" \
    -c 'DELETE FROM firelaunch_schema_migrations WHERE version=14' >/dev/null
  switch_release "$(basename "$old")"
  if systemctl start "$unit" && wait_health; then
    die 'Candidate failed health; schema-13 release and database restored'
  fi
fi
activated=1
die 'Candidate failed health; automatic rollback unsafe, protected backup and candidate retained for operator recovery'

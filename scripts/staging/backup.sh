#!/usr/bin/env bash
# Encrypted database plus referenced private objects. Run only from a root-owned operator tree.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

label="${1:?Usage: backup.sh YYYYMMDDTHHMMSSZ-label}"
[[ $# = 1 && "$label" =~ ^[0-9]{8}T[0-9]{6}Z-[a-zA-Z0-9_-]{1,48}$ ]] || die 'Invalid backup label'
require_operator
require_layout
if grep -Fxq 'FIRELAUNCH_OBJECT_AUTH=aws-profile' "$env_file"; then
  export AWS_PROFILE=firelaunch-staging-app AWS_CONFIG_FILE=/home/deploy/.aws/config
fi
for helper in backup-preflight.mjs inspect-archive.mjs; do
  helper_path="$(dirname "${BASH_SOURCE[0]}")/$helper"
  [[ -f "$helper_path" && ! -L "$helper_path" && "$(stat -c '%U' "$helper_path")" = root ]] || die 'Backup helper must be root owned'
  helper_mode="$(stat -c '%a' "$helper_path")"
  [[ $((8#$helper_mode & 022)) = 0 ]] || die 'Backup helper is writable by another user'
done
release="$(readlink -f "$base/current")"
[[ -f "$release/apps/server/dist/operations-cli.js" ]] || die 'Running release backup command missing'
if grep -Fxq 'FIRELAUNCH_OBJECT_AUTH=aws-profile' "$env_file"; then
  grep -Fq 'export function privateS3OptionsFromEnv' "$release/apps/server/dist/private-objects.js" ||
    die 'Running release does not support named-profile private objects'
fi
schema="$(schema_max "$release")"
preflight_output="$("$node_bin" --env-file="$env_file" "$(dirname "${BASH_SOURCE[0]}")/backup-preflight.mjs" "$release")"
read -r live_schema db_bytes object_count object_bytes <<< "$preflight_output"
[[ "$live_schema" = "$schema" ]] || die 'Database and release schema differ'
(( object_count <= 100000 )) || die 'Recovery object count exceeds archive limit'
# Recovery v1 has a 256 MB encrypted archive limit. Leave room for JSON/base64
# overhead and temporary files; reject uncertain capacity before work begins.
(( db_bytes + (object_bytes * 2) <= 200000000 )) || die 'Recovery archive may exceed format limit'
mkdir -p -m 0700 "$backup_dir"
[[ ! -L "$backup_dir" && "$(stat -c '%U:%G %a' "$backup_dir")" = 'root:root 700' ]] || die 'Unsafe backup directory'
available_kib="$(df -Pk "$backup_dir" | awk 'NR==2 {print $4}')"
[[ "$available_kib" =~ ^[0-9]+$ ]] || die 'Cannot inspect backup disk space'
(( available_kib * 1024 >= 3 * (db_bytes + object_bytes) + 536870912 )) || die 'Insufficient backup disk space'

backup="$backup_dir/$label-schema-$schema.flrec"
[[ ! -e "$backup" && ! -e "$backup.sha256" && ! -e "$backup.meta" ]] || die 'Backup label already exists'
umask 0077
# The running binary owns the format and cannot be preceded by candidate migration.
"$node_bin" --env-file="$env_file" "$release/apps/server/dist/operations-cli.js" backup --out "$backup" --retain-days 30 >/dev/null
[[ -s "$backup" && ! -L "$backup" && "$(stat -c '%a' "$backup")" = 600 ]] || die 'Encrypted archive missing or unprotected'
inspection_output="$("$node_bin" --env-file="$env_file" "$(dirname "${BASH_SOURCE[0]}")/inspect-archive.mjs" "$release" "$backup")"
read -r archived_count database_sha <<< "$inspection_output"
[[ "$archived_count" = "$object_count" && "$database_sha" =~ ^[a-f0-9]{64}$ ]] || die 'Archive manifest does not match preflight'
sha256sum "$backup" > "$backup.sha256"
release_version="$($node_bin -p "require('$release/package.json').version")"
printf 'created_utc=%s\nrelease=%s\nversion=%s\nschema=%s\ndatabase_bytes_estimate=%s\nobject_count=%s\nobject_bytes=%s\ndatabase_dump_sha256=%s\n' \
  "$(date -u +%FT%TZ)" "$release" "$release_version" "$schema" "$db_bytes" "$object_count" "$object_bytes" "$database_sha" > "$backup.meta"
chmod 0600 "$backup.sha256" "$backup.meta"
echo "Encrypted backup verified: $backup"
echo "Archive SHA-256: $(cut -d' ' -f1 "$backup.sha256")"

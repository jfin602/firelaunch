#!/usr/bin/env bash
set -euo pipefail

base=/srv/firelaunch
unit=firelaunch-staging.service
env_file=/etc/firelaunch/staging.env
drop_in=/etc/systemd/system/firelaunch-staging.service.d/aws.conf
backup_dir=/var/backups/firelaunch-staging
node_bin=/opt/firelaunch-staging-runtime/node24/bin/node
die() { echo "$*" >&2; exit 1; }

require_operator() {
  [[ "$EUID" = 0 && "$(hostname -s)" = muffinos ]] || die 'Run as root on muffinos only'
  local file directory mode
  for file in "${BASH_SOURCE[1]}" "${BASH_SOURCE[0]}"; do
    [[ "$file" = /* && -f "$file" && ! -L "$file" && "$(realpath -e "$file")" = "$file" &&
       "$(stat -c '%U' "$file")" = root ]] || die 'Operator scripts must be root owned and canonical'
    mode="$(stat -c '%a' "$file")"
    [[ $((8#$mode & 022)) = 0 ]] || die 'Operator script is writable by another user'
    directory="$(dirname "$file")"
    while :; do
      mode="$(stat -c '%a' "$directory")"
      [[ "$(stat -c '%U' "$directory")" = root && $((8#$mode & 022)) = 0 ]] || die 'Operator script path is writable by another user'
      [[ "$directory" = / ]] && break
      directory="$(dirname "$directory")"
    done
  done
}

trusted_path() {
  local candidate="$1" part mode
  [[ "$candidate" = /* && "$(realpath -e "$candidate")" = "$candidate" ]] || die 'Operator path is not canonical'
  part="$candidate"
  while :; do
    mode="$(stat -c '%a' "$part")"
    [[ "$(stat -c '%U' "$part")" = root && $((8#$mode & 022)) = 0 ]] || die 'Operator path is writable by another user'
    [[ "$part" = / ]] && break
    part="$(dirname "$part")"
  done
}

require_layout() {
  local active_release link resolved
  [[ "$(systemctl show "$unit" -p User --value)" = deploy &&
     "$(systemctl show "$unit" -p WorkingDirectory --value)" = "$base/current" &&
     "$(systemctl show "$unit" -p FragmentPath --value)" = /etc/systemd/system/firelaunch-staging.service ]] || die 'Unexpected staging unit identity or layout'
  systemctl show "$unit" -p ExecStart --value | grep -Fq "$node_bin $base/current/apps/server/dist/index.js" || die 'Unexpected staging ExecStart'
  [[ "$(systemctl show "$unit" -p ProtectSystem --value)" = strict ]] || die 'Staging filesystem protection changed'
  [[ -d "$base/releases" && -L "$base/current" && -x "$node_bin" ]] || die 'Staging release layout or Node runtime missing'
  [[ "$(readlink -f "$base/current")" = "$base"/releases/* ]] || die 'Current release escapes staging'
  # These files are executed by privileged scripts. The initial 0.5.8 layout
  # is deploy-owned and must be secured by an operator before root execution.
  trusted_path "$node_bin"
  trusted_path "$base/releases"
  active_release="$(readlink -f "$base/current")"
  trusted_path "$active_release"
  # Link mode is conventionally 0777 and does not grant write access. Check
  # link ownership and target containment separately from regular file modes.
  [[ -z "$(find "$active_release" -xdev \( ! -user root -o \( ! -type l -a -perm /022 \) \) -print -quit)" ]] || die 'Running release contains deploy-writable code'
  while IFS= read -r -d '' link; do
    resolved="$(readlink -f "$link")"
    [[ "$resolved" = "$active_release"/* ]] || die 'Running release contains an escaping link'
  done < <(find "$active_release" -xdev -type l -print0)
  [[ "$(stat -c '%U:%G %a' "$env_file")" = 'root:root 600' ]] || die 'Staging environment protections changed'
  [[ -f "$drop_in" && "$(stat -c '%U:%G' "$drop_in")" = root:root ]] || die 'Prepared AWS service drop-in missing'
  grep -Fxq 'Environment=AWS_PROFILE=firelaunch-staging-app' "$drop_in" || die 'Unexpected AWS service profile'
  grep -Fxq 'Environment=AWS_CONFIG_FILE=/home/deploy/.aws/config' "$drop_in" || die 'Unexpected AWS config path'
  if grep -Fxq 'FIRELAUNCH_OBJECT_AUTH=aws-profile' "$env_file"; then
    ! grep -Eq '^FIRELAUNCH_OBJECT_ENDPOINT=.+' "$env_file" || die 'AWS profile cannot use a custom private-object endpoint'
  else
    grep -Eq '^FIRELAUNCH_OBJECT_ACCESS_KEY_ID=' "$env_file" || die 'Existing object access key missing'
    grep -Eq '^FIRELAUNCH_OBJECT_SECRET_ACCESS_KEY=' "$env_file" || die 'Existing object secret key missing'
  fi
}

health() {
  local local_code https_code
  local_code="$(curl --max-time 5 -sS -o /dev/null -w '%{http_code}' -H 'Host: firelaunch.jfin.dev' -H 'X-Forwarded-Proto: https' http://127.0.0.1:4184/api/auth/session 2>/dev/null || true)"
  https_code="$(curl --max-time 8 -sS -o /dev/null -w '%{http_code}' --resolve firelaunch.jfin.dev:443:127.0.0.1 https://firelaunch.jfin.dev/api/auth/session 2>/dev/null || true)"
  [[ "$local_code" = 401 && "$https_code" = 401 ]]
}

wait_health() {
  local attempt
  for attempt in {1..20}; do health && return 0; sleep 1; done
  return 1
}

schema_max() {
  local directory="$1" versions
  [[ -d "$directory/apps/server/migrations" ]] || die 'Release migration directory missing'
  versions="$(find "$directory/apps/server/migrations" -maxdepth 1 -type f -name '[0-9][0-9][0-9]_*.up.sql' -printf '%f\n' | cut -c1-3 | sort -n | uniq)"
  [[ -n "$versions" ]] || die 'No schema migrations found'
  local expected=1 version
  while read -r version; do
    (( 10#$version == expected )) || die 'Non-contiguous schema migrations'
    (( expected += 1 ))
  done <<< "$versions"
  echo "$((expected - 1))"
}

database_schema() {
  local release="$1"
  "$node_bin" --env-file="$env_file" "$release/scripts/staging/schema-version.mjs"
}

rollback_schema_safe() {
  local current="$1" target_max="$2"
  [[ "$current" =~ ^[0-9]+$ && "$target_max" =~ ^[0-9]+$ ]] && (( current <= target_max ))
}

validate_archive() {
  python3 - "$1" <<'PY'
import posixpath, sys, tarfile
with tarfile.open(sys.argv[1], 'r:gz') as archive:
    for member in archive:
        name = member.name.removeprefix('./')
        if not name or name == '.':
            continue
        if name.startswith('/') or '..' in name.split('/') or member.isdev() or member.isfifo():
            raise SystemExit('Unsafe release archive entry')
        if member.issym() or member.islnk():
            link = member.linkname
            resolved = posixpath.normpath(posixpath.join(posixpath.dirname(name) if member.issym() else '', link))
            if link.startswith('/') or resolved == '..' or resolved.startswith('../'):
                raise SystemExit('Release archive link escapes destination')
PY
}

switch_release() {
  local name="$1" target
  # The installed 0.5.8 release predates hash-suffixed release names.
  [[ "$name" =~ ^[0-9]{8}T[0-9]{6}Z(-[a-f0-9]{12})?$ ]] || die 'Invalid release name'
  target="$base/releases/$name"
  [[ -d "$target" && ! -L "$target" ]] || die 'Release target is missing or linked'
  ln -s "$target" "$base/.current-next"
  mv -Tf "$base/.current-next" "$base/current"
}

set_previous() {
  local target="$1"
  [[ "$target" = "$base"/releases/* && -d "$target" && ! -L "$target" ]] || die 'Unsafe previous release'
  ln -s "$target" "$base/.previous-next"
  mv -Tf "$base/.previous-next" "$base/previous"
}

#!/usr/bin/env bash
# Stage trusted copies for an operator review. Never changes the live release,
# service, environment, database, object bucket or routing.
set -euo pipefail

[[ "$EUID" = 0 && "$(hostname -s)" = muffinos && $# = 1 ]] || { echo 'Run as root on muffinos with one candidate archive' >&2; exit 1; }
artifact="$1"
[[ "$artifact" = /home/deploy/firelaunch-incoming/*.tar.gz && -f "$artifact" && ! -L "$artifact" ]] || { echo 'Expected a regular incoming archive' >&2; exit 1; }

expected_artifact=672450904c2ae959dbaf4e0c59a0c5ee2014ff066e9e0817ac6b146691453289
expected_node=d1de76d8edf2fededf6f8b30d244e2c0529ac607923a018283b77e9c74bd932c
old=/srv/firelaunch/releases/20261011T163833Z
node_source=/home/deploy/.nvm/versions/node/v24.15.0/bin/node
prep=/srv/firelaunch/recovery-prep
ops=/opt/firelaunch-staging-ops
runtime=/opt/firelaunch-staging-runtime/node24/bin
active_pid="$(systemctl show firelaunch-staging.service -p MainPID --value)"
[[ "$active_pid" =~ ^[1-9][0-9]*$ && "$(systemctl show firelaunch-staging.service -p ActiveState --value)" = active &&
   "$(readlink -f /srv/firelaunch/current)" = "$old" && -d "$old" && ! -L "$old" ]] || { echo 'Live staging identity changed' >&2; exit 1; }
[[ "$(stat -c '%U:%G %a' /etc/firelaunch/staging.env)" = 'root:root 600' ]] || { echo 'Protected environment changed' >&2; exit 1; }
[[ "$(sha256sum "$artifact" | cut -d' ' -f1)" = "$expected_artifact" &&
   "$(sha256sum "$node_source" | cut -d' ' -f1)" = "$expected_node" ]] || { echo 'Artifact or Node hash changed' >&2; exit 1; }

# Refuse archive traversal, special files, links that escape, or duplicate names.
python3 - "$artifact" <<'PY'
import posixpath, sys, tarfile
seen = set()
with tarfile.open(sys.argv[1], 'r:gz') as archive:
    for member in archive:
        name = posixpath.normpath(member.name.removeprefix('./'))
        if name == '.':
            continue
        if name.startswith('/') or name == '..' or name.startswith('../') or name in seen:
            raise SystemExit('Unsafe or duplicate release archive entry')
        seen.add(name)
        if not (member.isfile() or member.isdir() or member.issym() or member.islnk()):
            raise SystemExit('Unsafe release archive file type')
        if member.issym() or member.islnk():
            target = posixpath.normpath(posixpath.join(posixpath.dirname(name) if member.issym() else '', member.linkname))
            if member.linkname.startswith('/') or target == '..' or target.startswith('../'):
                raise SystemExit('Release archive link escapes destination')
PY

install -d -o root -g root -m 0700 "$prep" /var/backups/firelaunch-staging "$ops"
install -d -o root -g root -m 0755 "$runtime"
install -o root -g root -m 0755 "$node_source" "$runtime/node"
[[ "$(sha256sum "$runtime/node" | cut -d' ' -f1)" = "$expected_node" && "$("$runtime/node" -v)" = v24.15.0 ]] || { echo 'Root-owned Node verification failed' >&2; exit 1; }

prep_temp=''
trap '[[ -z "$prep_temp" ]] || rm -rf -- "$prep_temp"' EXIT
stage() {
  local name="$1" source="$2" target
  target="$prep/$name"
  [[ ! -e "$target" ]] || { echo 'Prepared release already exists; refusing overwrite' >&2; exit 1; }
  prep_temp="$(mktemp -d "$prep/.prepare.XXXXXXXX")"
  if [[ "$source" = "$old" ]]; then
    cp -a -- "$old/." "$prep_temp/"
  else
    tar -xzf "$artifact" -C "$prep_temp" --no-same-owner --no-same-permissions
  fi
  chown -R root:root "$prep_temp"
  chmod -R go-w "$prep_temp"
  [[ -z "$(find "$prep_temp" -xdev \( ! -user root -o \( ! -type l -a -perm /022 \) \) -print -quit)" ]] || { echo 'Prepared release contains writable code' >&2; exit 1; }
  local link resolved
  while IFS= read -r -d '' link; do
    resolved="$(readlink -f "$link")"
    [[ "$resolved" = "$prep_temp"/* ]] || { echo 'Prepared release link escapes' >&2; exit 1; }
  done < <(find "$prep_temp" -xdev -type l -print0)
  [[ -f "$prep_temp/apps/server/dist/index.js" && -f "$prep_temp/apps/server/dist/operations-cli.js" ]] || { echo 'Prepared release incomplete' >&2; exit 1; }
  [[ "$(python3 - "$prep_temp/package.json" <<'PY'
import json,sys
print(json.load(open(sys.argv[1]))['version'])
PY
)" = "${name%%-*}" ]] || { echo 'Prepared release version mismatch' >&2; exit 1; }
  mv -T "$prep_temp" "$target"
  prep_temp=''
}

stage "0.5.8-legacy" "$old"
stage "0.6.7-${expected_artifact:0:12}" "$artifact"
for helper in lib.sh backup.sh backup-preflight.mjs inspect-archive.mjs schema-version.mjs deploy-release.sh rollback.sh; do
  install -o root -g root -m 0755 "$prep/0.6.7-${expected_artifact:0:12}/scripts/staging/$helper" "$ops/$helper"
done
[[ "$(systemctl show firelaunch-staging.service -p MainPID --value)" = "$active_pid" &&
   "$(readlink -f /srv/firelaunch/current)" = "$old" ]] || { echo 'Live service changed during preparation' >&2; exit 1; }
printf 'Prepared root-owned runtime, two release copies, operator and backup directories. Live PID and release link unchanged.\n'

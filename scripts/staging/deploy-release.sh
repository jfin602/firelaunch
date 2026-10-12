#!/usr/bin/env bash
set -euo pipefail
artifact="${1:?Usage: deploy-release.sh /absolute/release.tar.gz}"
[[ -f "$artifact" && -f "$artifact.sha256" ]] || { echo 'Artifact and checksum are required' >&2; exit 1; }
expected="$(cut -d' ' -f1 "$artifact.sha256")"
[[ "$expected" =~ ^[a-f0-9]{64}$ ]] || exit 1
actual="$(sha256sum "$artifact" | cut -d' ' -f1)"
[[ "$actual" = "$expected" ]] || { echo 'Artifact checksum mismatch' >&2; exit 1; }
release="$(date -u +%Y%m%dT%H%M%SZ)-${expected:0:12}"
remote=deploy@muffinos
base=/srv/firelaunch-staging
ssh "$remote" "test -d '$base/releases' && test -f '$base/shared/backend.env' && test -x '$base/shared/start-server.sh'"
scp "$artifact" "$remote:$base/incoming/$release.tar.gz"
ssh "$remote" bash -s -- "$release" "$expected" <<'REMOTE'
set -euo pipefail
release="$1"; expected="$2"; base=/srv/firelaunch-staging
[[ "$release" =~ ^[0-9]{8}T[0-9]{6}Z-[a-f0-9]{12}$ ]] || exit 1
archive="$base/incoming/$release.tar.gz"
[[ "$(sha256sum "$archive" | cut -d' ' -f1)" = "$expected" ]] || exit 1
mkdir "$base/releases/$release"
tar -xzf "$archive" -C "$base/releases/$release" --no-same-owner
rm "$archive"
old="$(readlink -f "$base/current" 2>/dev/null || true)"
ln -s "$base/releases/$release" "$base/.current-next"
mv -Tf "$base/.current-next" "$base/current"
if [[ -n "$old" ]]; then ln -s "$old" "$base/.previous-next"; mv -Tf "$base/.previous-next" "$base/previous"; fi
if pm2 describe firelaunch-staging >/dev/null 2>&1; then
  pm2 restart firelaunch-staging --update-env
else
  pm2 start "$base/shared/start-server.sh" --name firelaunch-staging --cwd "$base/shared"
fi
for attempt in {1..20}; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' -H 'Host: firelaunch.jfin.dev' -H 'X-Forwarded-Proto: https' http://127.0.0.1:4175/api/auth/session || true)"
  [[ "$code" = 401 ]] && { pm2 save; echo "Deployed $release; hosted API returned 401 without session"; exit 0; }
  sleep 1
done
if [[ -n "$old" ]]; then
  ln -s "$old" "$base/.current-next"; mv -Tf "$base/.current-next" "$base/current"
  pm2 restart firelaunch-staging --update-env || true
fi
echo 'Deployment health check failed; previous release restored if available' >&2
exit 1
REMOTE

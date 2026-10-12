#!/usr/bin/env bash
set -euo pipefail
base=/srv/firelaunch-staging
[[ -L "$base/current" && -L "$base/previous" ]] || { echo 'Current and previous releases are required' >&2; exit 1; }
old="$(readlink -f "$base/current")"
prior="$(readlink -f "$base/previous")"
[[ "$old" = "$base"/releases/* && "$prior" = "$base"/releases/* ]] || exit 1
ln -s "$prior" "$base/.current-next"
mv -Tf "$base/.current-next" "$base/current"
pm2 restart firelaunch-staging --update-env
code="$(curl -sS -o /dev/null -w '%{http_code}' -H 'Host: firelaunch.jfin.dev' -H 'X-Forwarded-Proto: https' http://127.0.0.1:4175/api/auth/session || true)"
[[ "$code" = 401 ]] || { ln -s "$old" "$base/.current-next"; mv -Tf "$base/.current-next" "$base/current"; pm2 restart firelaunch-staging --update-env; echo 'Rollback target failed health check' >&2; exit 1; }
ln -s "$old" "$base/.previous-next"
mv -Tf "$base/.previous-next" "$base/previous"
pm2 save
echo "Rolled back to $prior"

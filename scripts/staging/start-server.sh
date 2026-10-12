#!/usr/bin/env bash
set -euo pipefail
base=/srv/firelaunch-staging
node_bin="$HOME/.nvm/versions/node/v24.15.0/bin/node"
[[ -x "$node_bin" ]] || { echo 'Staging Node 24 runtime is missing' >&2; exit 1; }
[[ -f "$base/shared/backend.env" ]] || { echo 'Staging environment is missing' >&2; exit 1; }
cd "$base/current"
exec "$node_bin" --env-file="$base/shared/backend.env" apps/server/dist/index.js

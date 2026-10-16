#!/usr/bin/env bash
# Run on muffinos as root. Refuses binary rollback across an incompatible schema.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_operator
require_layout
[[ -L "$base/previous" ]] || die 'No previous release is recorded'
old="$(readlink -f "$base/current")"
prior="$(readlink -f "$base/previous")"
[[ "$prior" = "$base"/releases/* && -d "$prior" && ! -L "$prior" ]] || die 'Previous release is unsafe'
current_schema="$(database_schema "$old")"
prior_max="$(schema_max "$prior")"
rollback_schema_safe "$current_schema" "$prior_max" || die "Database schema $current_schema exceeds rollback binary maximum $prior_max; use reviewed database recovery"
switch_release "$(basename "$prior")"
if systemctl restart "$unit" && wait_health; then
  set_previous "$old"
  echo "Staging rolled back to $(basename "$prior")"
  exit 0
fi
switch_release "$(basename "$old")"
systemctl restart "$unit" || true
die 'Rollback target failed health; original release link restored'

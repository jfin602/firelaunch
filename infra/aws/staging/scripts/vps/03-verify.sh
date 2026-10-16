#!/usr/bin/env bash
# FireLaunch staging VPS - step 3 of 3: prove the VPS gets short-lived credentials
# for its own workload role (NOT the developer's identity). Non-billable checks only.
set -euo pipefail
APP_USER=${FIRELAUNCH_APP_USER:?Set FIRELAUNCH_APP_USER to the verified Unix service user}
APP_HOME=$(getent passwd "$APP_USER" | cut -d: -f6)
AWS="$APP_HOME/.local/bin/aws"
[[ -x "$AWS" ]] || { echo "AWS CLI v2 is missing for $APP_USER" >&2; exit 1; }
if [[ $EUID -eq 0 ]]; then
  aws_cmd=(sudo -u "$APP_USER" -H "$AWS")
elif [[ "$(id -un)" == "$APP_USER" ]]; then
  aws_cmd=("$AWS")
else
  echo "Run as root or the verified service user $APP_USER" >&2; exit 1
fi

out=$("${aws_cmd[@]}" sts get-caller-identity --profile firelaunch-staging-app --output json)
echo "$out"
acct=$(echo "$out" | python3 -c 'import json,sys;print(json.load(sys.stdin)["Account"])')
arn=$(echo "$out"  | python3 -c 'import json,sys;print(json.load(sys.stdin)["Arn"])')

[[ "$acct" == "363242105231" ]] || { echo "FAIL: wrong account $acct" >&2; exit 1; }
[[ "$arn" == arn:aws:sts::363242105231:assumed-role/firelaunch-staging-app/* ]] || { echo "FAIL: unexpected identity $arn" >&2; exit 1; }
echo "PASS: VPS authenticates as firelaunch-staging-app in 363242105231"

# The app policy does not grant an unscoped originals ListBucket, which a
# head-bucket request may require. STS proves authentication only. Test S3
# rights separately with scoped IAM simulation or an approved bounded probe.
echo "S3 and publisher boundaries require separate qualification; no object probe was run."

#!/usr/bin/env bash
# FireLaunch staging - create/update the developer-maintainable foundation stack.
#
# Run as JFin with the FireLaunch-Staging-Deployer role (see docs/DEVELOPER-ACCESS.md).
# The stack is always deployed through the bounded CloudFormation execution role;
# the deployer role is not allowed to deploy without it.
#
# Usage:
#   scripts/deploy-foundation.sh --create-change-set [--param Key=Value ...]
#   scripts/deploy-foundation.sh --execute-change-set NAME
# Creation never executes an update. Inspect the complete change set before the
# separate execution command, especially IAM, CloudFront and billable switches.
set -euo pipefail

ACCOUNT_ID=363242105231
REGION=us-east-2
STACK=firelaunch-staging-foundation
EXEC_ROLE=arn:aws:iam::${ACCOUNT_ID}:role/firelaunch-access/firelaunch-cfn-deployer
HERE="$(cd "$(dirname "$0")/.." && pwd)"
TEMPLATE="$HERE/cloudformation/02-firelaunch-staging-foundation.yaml"

[[ "${AWS_PROFILE:-}" == firelaunch-deployer ]] || { echo "Set AWS_PROFILE=firelaunch-deployer" >&2; exit 1; }
identity=$(aws sts get-caller-identity --output json)
actual=$(python3 -c 'import json,sys;print(json.load(sys.stdin)["Account"])' <<<"$identity")
arn=$(python3 -c 'import json,sys;print(json.load(sys.stdin)["Arn"])' <<<"$identity")
[[ "$actual" == "$ACCOUNT_ID" && "$arn" == arn:aws:sts::363242105231:assumed-role/FireLaunch-Staging-Deployer/* ]] || {
  echo "Refusing: expected the FireLaunch-Staging-Deployer session in $ACCOUNT_ID" >&2; exit 1;
}

mode=${1:-}
[[ "$mode" == --create-change-set || "$mode" == --execute-change-set ]] || {
  echo "Specify --create-change-set or --execute-change-set NAME" >&2; exit 2;
}
shift
if [[ "$mode" == --execute-change-set ]]; then
  name=${1:-}
  [[ "$name" =~ ^firelaunch-review-[0-9]{8}T[0-9]{6}Z$ && $# == 1 ]] || exit 2
  aws cloudformation describe-change-set --region "$REGION" --stack-name "$STACK" --change-set-name "$name" \
    --query '{Status:Status,Changes:Changes[].ResourceChange.[Action,LogicalResourceId,Replacement]}' --output table
  echo "Executing reviewed change set $name"
  aws cloudformation execute-change-set --region "$REGION" --stack-name "$STACK" --change-set-name "$name"
  aws cloudformation wait stack-update-complete --region "$REGION" --stack-name "$STACK"
  exit 0
fi

# Keep every current parameter value unless overridden with --param Key=Value
declare -A override=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --param)
      [[ $# -ge 2 && "$2" == *=* ]] || exit 2
      key=${2%%=*}; value=${2#*=}
      case "$key" in
        QueueStatus|QueueConcurrentJobs|EventProcessingState|CloudFrontSigningPublicKeyPem|CloudFrontSigningKeyVersion|DeliveryDistributionEnabled|BedrockModelArns|DeveloperBoundaryArn) ;;
        *) echo "unknown parameter $key" >&2; exit 2;;
      esac
      override["$key"]="$value"; shift 2;;
    *) echo "unknown argument $1" >&2; exit 2;;
  esac
done
params=()
for key in QueueStatus QueueConcurrentJobs EventProcessingState CloudFrontSigningPublicKeyPem \
           CloudFrontSigningKeyVersion DeliveryDistributionEnabled BedrockModelArns DeveloperBoundaryArn; do
  if [[ -n "${override[$key]+x}" ]]; then
    params+=("ParameterKey=$key,ParameterValue=${override[$key]}")
  elif [[ "$key" == DeliveryDistributionEnabled ]]; then
    # New parameter is absent from the deployed stack; keep delivery off by default.
    params+=("ParameterKey=$key,ParameterValue=false")
  else
    params+=("ParameterKey=$key,UsePreviousValue=true")
  fi
done

cs="firelaunch-review-$(date -u +%Y%m%dT%H%M%SZ)"
aws cloudformation validate-template --region "$REGION" --template-body "file://$TEMPLATE" >/dev/null
aws cloudformation create-change-set --region "$REGION" --stack-name "$STACK" --change-set-name "$cs" \
  --change-set-type UPDATE --template-body "file://$TEMPLATE" --capabilities CAPABILITY_NAMED_IAM \
  --role-arn "$EXEC_ROLE" --parameters "${params[@]}" >/dev/null
aws cloudformation wait change-set-create-complete --region "$REGION" --stack-name "$STACK" --change-set-name "$cs" || true
aws cloudformation describe-change-set --region "$REGION" --stack-name "$STACK" --change-set-name "$cs" \
  --query '{Status:Status,Reason:StatusReason,Changes:Changes[].ResourceChange.[Action,LogicalResourceId,Replacement]}' --output table
echo "Review $cs in full. It has not been executed."

# Local Bedrock Nova Lite readiness (c4-fix P2)

This is a local configuration and offline test path at root version `0.4.8`. It does not establish AWS account access, a successful model invocation, a saved live agent mutation, or Phase 4 GREEN. The server owns the provider configuration; Studio and API request bodies must not carry AWS credentials or a caller-selected owner.

## Server-only configuration

Use an IAM Identity Center (SSO) profile or temporary role credentials with only the permissions needed for this test. Never use AWS root access keys. The existing `BedrockRuntimeClient({})` uses the AWS SDK for JavaScript v3 [default credential chain](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/setting-credentials-node.html); FireLaunch does not create, capture or store keys. Keep AWS shared configuration outside the repository and do not commit `.env` files, tokens or command output containing private account data.

After account verification, set these in the **server process environment** before starting/restarting the local server:

```sh
export FIRELAUNCH_AGENT_PROVIDER=bedrock
export AWS_REGION=us-east-2
export BEDROCK_MODEL_ID=amazon.nova-lite-v1:0
export AWS_PROFILE=your-sso-profile
```

`amazon.nova-lite-v1:0` is the [Nova Lite model ID](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-amazon-nova-lite.html) and a candidate for Ohio; the same AWS page lists `us.amazon.nova-lite-v1:0` as a US cross-region inference profile. Select an ID actually supported for the verified account, region and invocation mode. Cross-region profiles may route to other US regions and require corresponding IAM/SCP allowance. Neither ID is an entitlement claim. `AWS_PROFILE` is optional if the default credential chain already resolves the intended temporary identity. If AWS CLI is installed and the profile is configured, `aws sso login --profile your-sso-profile` may refresh an SSO session; `aws sts get-caller-identity --profile your-sso-profile` is an optional identity check. Do not paste its output into Git or a support report. STS identity alone does not show Bedrock model access.

Grant the selected role narrowly scoped `bedrock:InvokeModel` permission for the chosen model or inference profile and required destination resources; [Converse uses that IAM action](https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference.html). Confirm Nova Lite model access and regional/inference-profile availability in the account before any paid request. Do not automate IAM console access or create keys for this correction.

An authenticated project `GET /api/projects/{projectId}/agent-status` can show `provider: bedrock` and `configured: true` when a nonblank model ID is present. This is **configuration only**. Region resolution, credential validity, IAM authorization, model access, network reachability and successful mutation remain unverified until a real request succeeds. Offline tests inject a fake Converse client and require no AWS credentials or paid call.

## Optional live smoke, only after account verification

First set an AWS budget or spend alert and review current Bedrock pricing, quotas and any cross-region routing; a model call can incur charges. With an explicitly approved, creator-owned catalog and rights-safe selection, follow [the P4 provider smoke](../p4/provider-smoke.md), substituting `bedrock` for `openai` in the environment and expected response provider. Observe a real `inspect_catalog` tool result, validated saved mutation, incremented persisted revision and visible Preview effect. Check stale revision, foreign/unapproved item and rights-ineligible denial. Retain only safe status, revision and Preview evidence; do not log full private catalog prompts, credentials, cookies, evidence, object keys or model transcripts.

If AWS account verification, model entitlement, permissions, budget approval or a suitable catalog is absent, mark the live smoke **UNQUALIFIED / NOT EXECUTED**. A configured status, injected-client test or STS call is not a live integration pass. P4 and hosted-release external gates remain open.

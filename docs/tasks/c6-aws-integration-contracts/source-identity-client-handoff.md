# Client handoff: preserve the Roles Anywhere source identity across publication

Status: **review only; no IAM update or staging deployment executed**. Target account `363242105231`, region `us-east-2`. The developer's verified `firelaunch-deployer` session and the VPS `firelaunch-staging-app` session both reached this account. A live VPS `AssumeRole` call to `firelaunch-staging-publisher` returned `AccessDenied` for `sts:SetSourceIdentity`.

## Cause and ownership

IAM Roles Anywhere sets the app session's source identity from the VPS certificate subject CN. AWS requires `sts:SetSourceIdentity` at each role hop when that identity propagates. The app role's certificate/CA trust is already correct and must remain unchanged. The publisher chain currently omits the action in three places:

| Layer | Exact change | Owner |
| --- | --- | --- |
| App identity policy `firelaunch-staging-app-permissions` | Add `sts:SetSourceIdentity` to existing `AssumeOnlyThePublisherRole`, resource only `arn:aws:iam::363242105231:role/firelaunch/firelaunch-staging-publisher` | JFin-owned `firelaunch-staging-foundation`, `ApplicationPermissions` in `02-firelaunch-staging-foundation.yaml` |
| App permissions boundary `firelaunch-developer-boundary` | Add the same action to its publisher-only statement | Client-owned standalone managed policy, **not owned by a CloudFormation stack**; reviewed v3 proposal is `infra/aws/staging/iam/firelaunch-developer-boundary.v3.json` |
| Publisher role trust | Add the action to `ApplicationRoleOnly`, keeping the sole app-role principal | Client-owned `firelaunch-staging-workload-identity`, `PublisherRole` in `03-firelaunch-staging-workload-identity.yaml`; exact patch is `client-source-identity.patch` |

The current live boundary v2 matches the checked-in v2 JSON, and both live client stack templates match the local files byte for byte. The JFin foundation proposal differs from the live foundation template only in this one action. The live app-policy simulation reported `sts:AssumeRole=allowed` and `sts:SetSourceIdentity=implicitDeny`, including `AllowedByPermissionsBoundary=false`. Simulation is diagnostic, not proof that a future live call succeeds. The developer profile cannot inspect organization SCPs (`AccessDenied`); a client administrator must check any relevant SCP effect before approval. Do not widen S3 actions, delivery paths, principal trust, certificate conditions, Bedrock, CloudFront or MediaConvert switches.

## Client-owned correction procedure

1. Authenticate with a client-approved administrator profile. Verify STS account `363242105231` and the administrator role. Stop on any mismatch. Inspect the live default boundary policy, stack 03 template and current parameters again; compare them to this handoff.
2. Review `infra/aws/staging/iam/firelaunch-developer-boundary.v3.json` against v2. The only difference must be `sts:SetSourceIdentity` on the publisher-role ARN in `AssumeOnlyThePublisherRole`. Validate with IAM Access Analyzer `validate-policy` if available. Check current policy versions (v1 and v2 were observed); do not delete any version to make room without a separate review. Prepare a new policy version but set it as default only after approval. This is a standalone client-owned policy update, not a CloudFormation change set.
3. Check `git apply --check docs/tasks/c6-aws-integration-contracts/client-source-identity.patch`, then apply it to a clean copy of the client-owned stack 03 template. Validate the edited template with CloudFormation. Prepare an UPDATE change set for `firelaunch-staging-workload-identity` with `CAPABILITY_NAMED_IAM` and **all existing parameters preserved with `UsePreviousValue=true`**. Expect only `PublisherRole` trust policy to update, without replacement. Keep `ApplicationRole`, `VpsProfile`, trust anchor, attached policies and role boundaries unchanged.
4. Inspect the complete change set, exact policy JSON, resource changes and replacement flags. Obtain the client's explicit approval of the exact boundary version and change-set ID before making either change. Do not use `firelaunch-deployer` for client resources. Do not execute a foundation stack change in this client procedure.
5. After the client-owned changes, JFin separately reviews and deploys only the one-action foundation policy update under its own approval. Keep all other foundation parameters and resource states unchanged. Recheck the live app-role policy, boundary, publisher trust and negative S3 publication policy.
6. Only after all three layers are live, rerun `AssumeRole` as `deploy` on muffinos with `--query AssumedRoleUser.Arn --output text` so credentials never enter evidence. Confirm the returned publisher ARN, and separately verify direct app-role delivery writes remain denied. Recheck account, queue PAUSED, completion rule DISABLED, distribution DISABLED and no Bedrock access. Do not publish media.

## Self-contained Claude Code prompt for the client administrator

```text
Work only in AWS account 363242105231, region us-east-2, with a verified client administrator profile. Your task is to prepare, review, and, only after the client's explicit approval of exact changes, apply the client-owned source-identity correction. Do not deploy FireLaunch, touch the JFin-owned foundation stack, enable MediaConvert/EventBridge/CloudFront/Bedrock, or change S3 permissions.

First verify aws sts get-caller-identity and inspect live IAM role firelaunch-staging-app, role firelaunch-staging-publisher, the default firelaunch-developer-boundary policy version, stack firelaunch-staging-workload-identity template and parameters, and relevant SCP effects. Stop if account, ownership, or live source differs from the handoff in docs/tasks/c6-aws-integration-contracts/source-identity-client-handoff.md.

Review infra/aws/staging/iam/firelaunch-developer-boundary.v3.json against v2: the sole change must add sts:SetSourceIdentity to AssumeOnlyThePublisherRole scoped to arn:aws:iam::363242105231:role/firelaunch/firelaunch-staging-publisher. This boundary is a standalone client-managed IAM policy, not a CloudFormation resource. Check policy-version capacity and validate the proposed JSON. Prepare a new version but do not set it as default until the client approves the exact JSON and policy version.

In a clean repository copy, check and apply docs/tasks/c6-aws-integration-contracts/client-source-identity.patch. It adds sts:SetSourceIdentity only to PublisherRole trust statement ApplicationRoleOnly in client-owned stack 03. Preserve the sole app-role principal, Roles Anywhere certificate/CA conditions on ApplicationRole, profile, tags, policies and boundary. Validate the template. Prepare an UPDATE change set for firelaunch-staging-workload-identity with CAPABILITY_NAMED_IAM and UsePreviousValue=true for every existing parameter. Inspect every resource change and replacement flag; expect only PublisherRole trust to update without replacement. Do not execute until the client explicitly approves the exact change-set ID. Do not change stack 01 or the JFin-owned foundation stack 02.

If approved, apply only the reviewed boundary default-version change and execute only the reviewed stack 03 change set. Wait for UPDATE_COMPLETE. Return sanitized STS identity, live/default policy version and SHA-256, change-set ID and complete resource-change summary, stack result, source-identity trust action, and any SCP limitations. Do not print credentials, certificate private material or policy session tokens. IAM simulation may help diagnose but does not count as live success; the developer will separately update foundation and test the app-to-publisher STS hop from the VPS.
```

Reference: AWS [source identity and role chaining](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_control-access_monitor.html) and [Roles Anywhere trust model](https://docs.aws.amazon.com/rolesanywhere/latest/userguide/trust-model.html).

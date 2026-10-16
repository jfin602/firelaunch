# C6 staging foundation change-set review — deployed, configuration qualified

Date: 2026-10-15 CDT / 2026-10-16 UTC. Repository HEAD: `01069f0`. Root version: `0.6.7` unchanged. The approved `firelaunch-staging-foundation` correction was deployed and qualified for stack configuration and IAM simulation. This is not live media, viewer, or Vega qualification. Existing unrelated worktree changes remain intact.

## Verified predeployment state

- STS identity: account `363242105231`, `arn:aws:sts::363242105231:assumed-role/FireLaunch-Staging-Deployer/...`, Region `us-east-2`.
- `firelaunch-staging-access` is `UPDATE_COMPLETE`; its seven live parameters remain present. The supplied client template differs from the retrieved live template only by a trailing blank line. The local copy was reconciled to that supplied template and has SHA-256 `b4a7b54873025f3a5e609cb40cf3802d22aa04d329280d8a3de83e86098ff65`. Neither client-owned stack was updated here. `firelaunch-staging-workload-identity` is `CREATE_COMPLETE`.
- Foundation is still `CREATE_COMPLETE` with execution role `arn:aws:iam::363242105231:role/firelaunch-access/firelaunch-cfn-deployer`. Its MediaConvert queue is `PAUSED` with on-demand pricing and two concurrent jobs; the processing EventBridge rule is `DISABLED`; distribution `E3E4ESF38V413L` is disabled. The currently deployed CloudFront origin still prepends `/delivery`, which the proposed update corrects.

## Proposed foundation correction

Change set: `arn:aws:cloudformation:us-east-2:363242105231:changeSet/c6-nested-media-20261016/6bd55d6c-f824-47b3-84f0-f0628433ae2f`. It was `CREATE_COMPLETE` and `AVAILABLE` immediately before execution. Created with `CAPABILITY_NAMED_IAM` and the existing foundation execution role. The eight proposed parameter values were the seven prior foundation values plus `DeliveryDistributionEnabled=false`; `QueueStatus=PAUSED`, `EventProcessingState=DISABLED`, and the signing public key remained empty.

| Resource | Proposed action | Replacement | Purpose |
| --- | --- | --- | --- |
| `ApplicationPermissions` | Modify policy document | False | Match nested original/staged keys; allow bounded staged normalization; explicitly deny direct nested delivery writes. |
| `DeliveryDistribution` | Modify distribution configuration | False | Remove the `/delivery` origin prefix so viewer URLs map to exact approved object keys; keep distribution disabled. |
| `MediaBucketPolicy` | Modify policy document | False | Limit OAC reads to nested approved delivery keys for this distribution. |
| `MediaConvertServiceRole` | Modify inline policy | False | Read nested originals and write only nested staged output. |
| `PublisherPermissions` | Modify policy document | False | Read nested staged output and write approved nested delivery paths; no originals permission. |

There are no proposed Add or Remove actions, no replacements, no new queues, buckets, distributions, or direct public S3 access. The app gains required `PutObject` only on nested staged keys; MediaConvert and publisher writes move from top-level paths to their respective nested staged and delivery paths. Original access is narrowed from the prior broad pattern. The change set does not activate CloudFront, EventBridge processing, or MediaConvert. No new resource cost is indicated by this change set; usage-based charges still depend on future authorized activity. CloudFormation's resource-level preview cannot prove all runtime IAM or CDN behavior.

## Validation and limits

- Focused application tests: 17 passed, 0 failed. Infrastructure contract tests: 2 passed, 0 failed. Server typecheck and build passed. CloudFormation accepted the proposed template. `git diff --check` passed. Node `24.21.0`; installed npm `11.19.0` differs from the repository's declared npm 12, though these checks passed.
- The proposed template matches the change-set template except for AWS CLI's trailing blank line. The existing live template diff is limited to the reviewed nested paths, staged app write/explicit delivery deny, CloudFront origin correction, disabled enable switch, and conditional viewer path function. With the empty signing key, that function is not created and the existing lock function remains associated.
- The client-reported 18 IAM simulation outcomes are a separate client qualification; they did not prove the foundation policy before this update. The first deployer session expired after change-set creation; it was refreshed before final checks and execution.
- Immutable public manifests still contain stable HLS URLs and the installed Vega client's authorization of master, variant, and segment requests is unqualified. Keep CloudFront disabled. No MediaConvert job, content publication, VPS key, or CSR was created.

## Execution and postdeployment qualification

The owner approved this exact change set on 2026-10-15 CDT, conditional on fresh identity, unchanged five-resource proposal, preserved parameters, and paused/disabled services. Immediately before execution, STS returned account `363242105231` and `FireLaunch-Staging-Deployer` in `us-east-2`; the fresh change-set template matched the reviewed local proposal except for a trailing blank line. It still contained exactly the five `Modify` actions above, all `Replacement=False`, with no adds, removes, or unexpected IAM changes. The old seven foundation parameter values were preserved and `DeliveryDistributionEnabled=false`. MediaConvert, EventBridge processing, and CloudFront were still paused/disabled. Both app and publisher roles had only their expected attached managed policy and no inline policies. The change set was then executed without another approval request.

The foundation stack reached **`UPDATE_COMPLETE`** under the same execution role. The deployed template matches the reviewed proposal; all eight final parameter values match the approved change set, and the existing output identifiers remain stable. CloudFormation drift detection `e398ba60-c906-11f1-8f30-0274687f8c9f` completed `IN_SYNC` with **0 drifted resources** (17 resource records inspected). The client-owned access and workload-identity stacks remain `UPDATE_COMPLETE` and `CREATE_COMPLETE`, respectively; neither was modified.

Read-only IAM `SimulatePrincipalPolicy` with `aws:RequestedRegion=us-east-2` and `s3:ResourceAccount=363242105231` produced **21/21 expected object-action decisions** and **3/3 expected bucket-list decisions**:

| Principal | Allowed | Denied |
| --- | --- | --- |
| App | original Get/Put; staged Get/Put; staged prefix ListBucket | delivery Put/Delete (explicit); delivery prefix ListBucket; unrelated path/bucket Put |
| MediaConvert | original Get; staged Put | original Put; delivery Put; unrelated bucket Put |
| Publisher | staged Get; delivery Get/Put/Delete; delivery prefix ListBucket | original Put; staged Put; unrelated path/bucket Put |

Both S3 buckets have all four public-access-block settings enabled and `IsPublic=false` bucket-policy status. OAC `E3FC82P2MZSJ0K` still uses S3 `sigv4` with signing behavior `always`. The distribution remains **disabled**, with empty origin path and the viewer lock function attached; no signing key group is active. The MediaConvert queue remains **`PAUSED`** and on-demand with two concurrent jobs; the application EventBridge rule remains **`DISABLED`**. No encode job, media publication, VPS key, CSR, or VPS change occurred.

This qualifies the foundation correction's deployed configuration and evaluated IAM policy, **not** live S3 object operations, assumed workload credentials, MediaConvert execution, CDN authorization, or installed Vega playback. IAM simulation is policy evaluation, not proof of a real allowed request. The complete HLS authorization flow for master, variants, and segments remains unimplemented/unqualified, so CloudFront must stay disabled. The foundation configuration is ready for a separately authorized VPS certificate/integration step; this review stops before that step.

# FIRELAUNCH AWS — FINAL DEVELOPER HANDOFF

**SUPERSEDED INITIAL INVENTORY (2026-10-18 reconciliation):** This 2026-10-15 handoff is a dated baseline, NOT the current operator launch checklist. The nested S3/IAM/OAC correction was **deployed** to the existing client `firelaunch-staging-foundation` stack and qualified for configuration on 2026-10-16: [actual update/denial matrix](../../../docs/tasks/c6-aws-integration-contracts/foundation-change-set-review.md). At that time MediaConvert was PAUSED, EventBridge processing DISABLED and CloudFront DISABLED. Reverify live state rather than treating inventory below as current. Viewer signing is not required for approved **free** CDN delivery per [ADR 0013](../../../docs/decisions/0013-hybrid-video-access.md); protected paid media authorization is future-only. Use [current state](../../../docs/CURRENT-STATE.md) and [p6-live-vod](../../../docs/tasks/p6-live-vod/README.md) instead of the historical signer/VPS/CDN activation sequence. **No AWS activation, spend, public publication or IAM change follows from these docs.**

Prepared 2026-10-15 for the client (Michael) and developer (JFin). Status keys: **CREATED**, **VERIFIED**, **PREPARED**, **BLOCKED**, **DEFERRED TO DEVELOPER**.
Every value below was read back from the deployed resources or CloudFormation outputs.

## A. Account and eligibility
| Item | Value | Status |
|---|---|---|
| Account | 363242105231 (STS GetCallerIdentity before every change) | VERIFIED |
| Resource Region | us-east-2; IAM/CloudFront/Budgets global | VERIFIED |
| Organization | o-wh7jwaix2h, management account 463984225312 | VERIFIED |
| Advanced AWS Features | Already active (organization + region-restriction SCP) | VERIFIED |
| Allowed Regions (SCP) | us-east-1 (global services), us-east-2, us-west-2 | VERIFIED |
| Account plan / credits | Not readable from this member account | UNVERIFIED — check AWS Settings / billing in the management account |
| MediaConvert eligibility | API + SCP allow it; real encode eligibility proven only by the first authorized job | DEFERRED TO DEVELOPER |
| Budget | `firelaunch-staging-monthly`, $20/month; ACTUAL 50/80/100 % + FORECASTED 100 % → michael@mysticwatersmedia.net | CREATED, VERIFIED |
| Spending cap | **None.** Budgets only notify; no project spend limit applies with Advanced Features | — |
| Account-wide S3 Block Public Access | All four settings on | CREATED, VERIFIED |
| Approved recurring cost | KMS CA key ≈ $1/month | CREATED |

## B. Developer access
- Portal: https://aa-9j7mp5d1b.account-access.us-east-1.app.aws (account 363242105231)
- Identity: Identity Center user pickuptruck2000@gmail.com (Jacob Pickens / JFin), MFA per Identity Center settings (client to confirm "every sign-in")
- Roles assigned (VERIFIED in account access manager):
  - `arn:aws:iam::363242105231:role/firelaunch-access/firelaunch-developer-jfin` — ReadOnlyAccess only (the 07:10 maintain policy was removed as approved)
  - `arn:aws:iam::363242105231:role/firelaunch-access/FireLaunch-Staging-Deployer` — ReadOnlyAccess + `firelaunch-staging-deployer`
- Deployer can: create/update/execute change sets on `firelaunch-staging-foundation` **only with** execution role `firelaunch-cfn-deployer`; put/get/delete originals and `staged/`; read and **delete** `delivery/` (cleanup); CloudFront invalidations; MediaConvert CreateJob/Get/Cancel on the FireLaunch queue only; pass the MediaConvert role; SQS receive/delete/redrive; log queries.
- Deployer cannot: write `delivery/`, assume the publisher role, create/delete MediaConvert queues, update or delete the two client stacks, delete the foundation stack, create IAM users/keys, use the CA key, change Roles Anywhere, billing, budgets, Identity Center or the organization.
- Execution role `arn:aws:iam::363242105231:role/firelaunch-access/firelaunch-cfn-deployer` can create only the role `firelaunch-mediaconvert` (permission boundary required) and policies named `firelaunch-staging-*`; it can never change trust policies, delete roles or remove boundaries.
- 45/45 IAM policy simulations matched expectations (allows and denies, all five FireLaunch roles). Simulation is not a live test.
- CLI (refreshable, no long-lived keys): sign in to the portal in your default browser, open 363242105231 → FireLaunch-Staging-Deployer, then `aws login` (choose us-east-2, pick the session tile). Verify: `aws sts get-caller-identity` → `assumed-role/FireLaunch-Staging-Deployer/...` in 363242105231. `aws sso login` does not work with account access manager. **Not yet tested by JFin.**

## C. Infrastructure inventory (us-east-2)
| Resource | Value |
|---|---|
| Stacks | `firelaunch-staging-access` UPDATE_COMPLETE · `firelaunch-staging-foundation` CREATE_COMPLETE (21 resources) · `firelaunch-staging-workload-identity` CREATE_COMPLETE |
| Originals bucket | `firelaunch-staging-originals-363242105231-use2` |
| Output/delivery bucket | `firelaunch-staging-media-363242105231-use2` (`staged/`, `delivery/`) |
| CloudFront distribution | `E3E4ESF38V413L`, `dl2jzii5bnotd.cloudfront.net` — **Disabled**, lock function attached, origin path `/delivery`, OAC `E3FC82P2MZSJ0K`, HTTPS-only |
| CloudFront authorization | Signed URLs/cookies via key group — PREPARED (activates when the signing public key parameter is supplied) |
| MediaConvert queue | `arn:aws:mediaconvert:us-east-2:363242105231:queues/firelaunch-staging-encode` — PAUSED, ON_DEMAND, 2 concurrent jobs |
| MediaConvert role | `arn:aws:iam::363242105231:role/firelaunch/firelaunch-mediaconvert` |
| EventBridge rules | `firelaunch-staging-mediaconvert-jobs` (DISABLED) · `firelaunch-staging-mediaconvert-audit` (ENABLED → logs) |
| SQS queue | `https://sqs.us-east-2.amazonaws.com/363242105231/firelaunch-staging-mediaconvert-events` |
| SQS DLQ | `https://sqs.us-east-2.amazonaws.com/363242105231/firelaunch-staging-mediaconvert-events-dlq` |
| Alarms | `firelaunch-staging-job-events-dlq-not-empty`, `firelaunch-staging-job-events-backlog-age` |
| App runtime role | `arn:aws:iam::363242105231:role/firelaunch/firelaunch-staging-app` |
| Publisher role | `arn:aws:iam::363242105231:role/firelaunch/firelaunch-staging-publisher` |
| Roles Anywhere trust anchor | `arn:aws:rolesanywhere:us-east-2:363242105231:trust-anchor/a6180607-0f41-4054-9654-d5f16df17d56` |
| Roles Anywhere profile | `arn:aws:rolesanywhere:us-east-2:363242105231:profile/709699e9-1312-4eb6-ac48-9bb129335911` (1-hour sessions) |
| CA | KMS `alias/firelaunch-staging-roles-anywhere-ca` (key a3d28f70-60ff-4316-b670-d415551d1b0e); certificate `ca/firelaunch-staging-ca.pem`, SHA-256 fb96f129…9bb7, valid to 2036-10-12 |

## D. Infrastructure as Code
- Files: this bundle. `cloudformation/01..03`, `iam/firelaunch-developer-boundary.v2.json` (permission boundary, applied directly as policy v2), `scripts/`, `outputs/`, `docs/`.
- Foundation updates (JFin): `scripts/deploy-foundation.sh [--param Key=Value]` — validates, creates a change set with the execution role, shows it, executes only on confirmation. Parameters: `QueueStatus`, `QueueConcurrentJobs`, `EventProcessingState`, `CloudFrontSigningPublicKeyPem`, `CloudFrontSigningKeyVersion`, `BedrockModelArns`, `DeveloperBoundaryArn`.
- Drift: `aws cloudformation detect-stack-drift --stack-name firelaunch-staging-foundation` then `describe-stack-resource-drifts`.
- Validation: `cfn-lint cloudformation/*.yaml`, `aws cloudformation validate-template`.
- Rollback: a failed update rolls back automatically. Buckets are `Retain` (never deleted by CloudFormation). The execution role cannot delete roles, so a failed *initial* create needs the client to clean up — not relevant to updates.
- Client stacks: update only with the client admin role (`docs/CLIENT-RUNBOOK.md`).

## E. Application configuration (`outputs/firelaunch-staging.env`)
| Variable | Value | Status |
|---|---|---|
| FIRELAUNCH_MEDIA_AWS_REGION | us-east-2 | VERIFIED |
| FIRELAUNCH_MEDIA_ORIGINALS_BUCKET | firelaunch-staging-originals-363242105231-use2 | VERIFIED |
| FIRELAUNCH_MEDIA_DELIVERY_BUCKET | firelaunch-staging-media-363242105231-use2 | VERIFIED |
| FIRELAUNCH_MEDIA_CLOUDFRONT_ORIGIN | https://dl2jzii5bnotd.cloudfront.net | VERIFIED (serves nothing until enabled) |
| FIRELAUNCH_MEDIA_CLOUDFRONT_HOSTS | dl2jzii5bnotd.cloudfront.net | VERIFIED |
| FIRELAUNCH_MEDIACONVERT_ACCOUNT | 363242105231 | VERIFIED |
| FIRELAUNCH_MEDIACONVERT_QUEUE_ARN | arn:aws:mediaconvert:us-east-2:363242105231:queues/firelaunch-staging-encode | VERIFIED |
| FIRELAUNCH_MEDIACONVERT_ROLE_ARN | arn:aws:iam::363242105231:role/firelaunch/firelaunch-mediaconvert | VERIFIED |
| FIRELAUNCH_MEDIACONVERT_EVENT_QUEUE_URL | https://sqs.us-east-2.amazonaws.com/363242105231/firelaunch-staging-mediaconvert-events | VERIFIED |
| Publisher role variable | name set by the app code; value = publisher role ARN | DEFERRED TO DEVELOPER |
| BEDROCK_MODEL_ID | not authorized | BLOCKED (client decision) |
| CloudFront signing key pair id / private key path | after key group exists | DEFERRED TO DEVELOPER |

Application compatibility with the repository was **not** verified (no repository access). Assumed object layout: uploads in the originals bucket; MediaConvert writes under `staged/`; publication copies to `delivery/`. MediaConvert jobs should carry `UserMetadata` (e.g. asset id) so completion events can be correlated; the event `detail.jobId` and `detail.userMetadata` arrive in the SQS message.

## F. VPS integration (DEFERRED TO DEVELOPER unless noted)
1. `scripts/vps/01-generate-key-and-csr.sh` — EC P-256 key generated on the VPS at `/etc/firelaunch/aws/firelaunch-staging-vps.key` (0640 root:app-user), CSR subject `O=FireLaunch, CN=firelaunch-staging-vps`.
2. Client signs with `scripts/ca/firelaunch_ca.py sign-csr` (CloudShell, client admin) — PREPARED; issuance path VERIFIED with a throwaway CSR (test CN `firelaunch-ca-selftest`, expires 2026-10-16, cannot assume any role; test key destroyed).
3. `scripts/vps/02-install-certificate-and-helper.sh cert.pem ca.pem` — installs cert/chain, checks key match, writes `~app/.aws/config`:
   ```ini
   [profile firelaunch-staging-app]
   region = us-east-2
   credential_process = /usr/local/bin/aws_signing_helper credential-process --certificate /etc/firelaunch/aws/firelaunch-staging-vps.pem --private-key /etc/firelaunch/aws/firelaunch-staging-vps.key --trust-anchor-arn arn:aws:rolesanywhere:us-east-2:363242105231:trust-anchor/a6180607-0f41-4054-9654-d5f16df17d56 --profile-arn arn:aws:rolesanywhere:us-east-2:363242105231:profile/709699e9-1312-4eb6-ac48-9bb129335911 --role-arn arn:aws:iam::363242105231:role/firelaunch/firelaunch-staging-app
   ```
   Install `aws_signing_helper` from the official AWS credential-helper page and verify its checksum.
4. `scripts/vps/03-verify.sh` — must show `assumed-role/firelaunch-staging-app/<serial>` in 363242105231 and a denied delivery write. **VPS authentication is not verified until this passes on the VPS.**
5. Renewal every 60–80 days (90-day certificates); revocation via `disable-profile`, session revocation, or CRL import (`docs/CLIENT-RUNBOOK.md` §2).

## G. Cost and security
- Idle cost: ≈ $1/month (KMS). Usage-based: S3 storage/requests, CloudFront transfer, SQS requests (long-polling consumer ~130k requests/month, within free tier), CloudWatch Logs ingestion (small), MediaConvert per output minute, Bedrock per token.
- Idle charges possible: KMS key; S3 storage once media exists (versioning keeps replaced versions 30 days); CloudWatch alarms beyond the free tier ($0.10 each).
- Boundaries: every FireLaunch workload role carries the `firelaunch-developer-boundary` permission boundary (v2) capping it to FireLaunch buckets in this account, MediaConvert, CloudFront, events/SQS/logs, approved Bedrock actions, passing `/firelaunch/` roles to MediaConvert/EventBridge, and assuming only the publisher role.
- Residual risks: (1) JFin can expand app/publisher **permissions** through the foundation stack, but only within the boundary and never their **trust**; (2) the publisher role can overwrite `delivery/` objects — immutability is by application key design plus 30-day versions, not IAM; (3) CloudFront revocation cannot recall already-downloaded content, and cached objects stay until invalidation completes or signed URLs/cookies expire; (4) `AllowQueueCreation` must stay false — reserved MediaConvert queues are a paid commitment IAM cannot block; (5) MFA enforcement in Identity Center is a console setting the client should confirm.
- Deferred billable tests: all encoding, Bedrock inference, playback, publication and revocation qualification.
- Cleanup: empty buckets before stack deletion (Retain policy keeps them otherwise); deleting stacks and buckets is client-only.

## H. Verified deployment status
| Task | Status |
|---|---|
| Account, Region, Advanced Features, SCP | VERIFIED |
| Budget + alerts; account S3 BPA | CREATED, VERIFIED |
| Cap policy v2; deployer role + assignment; developer role back to read-only | CREATED, VERIFIED (simulation); JFin sign-in DEFERRED TO DEVELOPER |
| Execution-role deployment of the foundation stack | VERIFIED (deployed through it) |
| Private buckets, encryption, TLS-only, versioning, lifecycle | CREATED, VERIFIED |
| MediaConvert queue paused; service role scoped to the queue | CREATED, VERIFIED |
| EventBridge (app rule disabled), SQS + DLQ, alarms, audit log | CREATED, VERIFIED |
| CloudFront disabled + locked + OAC to delivery/ only | CREATED, VERIFIED |
| CloudFront signed-request enforcement | PREPARED (template); DEFERRED TO DEVELOPER |
| KMS CA + CA certificate; CSR signing reproducible | CREATED, VERIFIED |
| Roles Anywhere trust anchor, profile, app + publisher roles | CREATED, VERIFIED |
| VPS certificate + STS | DEFERRED TO DEVELOPER |
| Bedrock | BLOCKED (awaiting model approval) |
| No jobs / no Bedrock calls / no public exposure | VERIFIED (MediaConvert ListJobs = 0; CloudTrail 0 CreateJob / InvokeModel / Converse; bucket policy status not public) |

## I. Codex continuation
See `docs/CODEX-CONTINUATION-PROMPT.md` (copy-paste ready).

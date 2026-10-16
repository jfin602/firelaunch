# c6 AWS integration contracts — offline closeout

Date: 2026-10-15 CDT (AWS preflight recorded 2026-10-16 UTC). Repository HEAD at review: `01069f0`; root version `0.6.7` unchanged. Disposition: **NOT GREEN / no live delivery qualification**. This correction fixes the local key and origin-policy contract and prepares a client-owned IAM handoff. Secure native HLS viewer authorization remains blocked. No CloudFormation change set was created or executed; no AWS or VPS mutation occurred.

## Corrected contract

| Stage | Bucket | Canonical key or URL |
| --- | --- | --- |
| Original upload and MediaConvert input | `firelaunch-staging-originals-363242105231-use2` | `media/<creator32>/<project32>/<asset32>/original/<upload32>.mp4` |
| MediaConvert output and verified normalized HLS | `firelaunch-staging-media-363242105231-use2` | `media/<creator32>/<project32>/<asset32>/staged/<attempt-or-set32>/<filename>` |
| Approved immutable HLS publication | same media bucket | `media/<creator32>/<project32>/<asset32>/delivery/<set32>/<master-sha256-64>/<filename>` |
| Published master URL | CloudFront | `https://dl2jzii5bnotd.cloudfront.net/<exact delivery key>` |
| Revocation | media bucket + CloudFront | delete owned `media/<creator32>/<project32>/<asset32>/delivery/` subtree; invalidate `/media/<creator32>/<project32>/<asset32>/delivery/*` |

`S3MediaStorage.originalKey`, `stagedKey`, `deliveryKey`, `publishedMasterUrl`, `verifyManagedHls`, `publishVerifiedHls` and `removePublishedAsset` already implement this layout with strict scoped identities and complete HLS graph checks. No application-key rewrite was justified. The actual app normalizes staged output with its **control-role S3 client**, so its foundation policy now grants `GetObject` and `PutObject` only to nested staged objects. MediaConvert reads nested originals and writes nested staging. Publisher STS credentials write nested delivery; the app role has an explicit direct-delivery deny. The OAC S3 read grant accepts nested delivery only, and CloudFront no longer prepends `/delivery`. A viewer URI guard blocks paths outside canonical published HLS keys. `DeliveryDistributionEnabled` defaults false even when a public signing key is later supplied; the key group still requires signed requests if enabled. The distribution was not enabled here.

## Viewer authorization blocker

The public manifest v1 stores a **stable unsigned** HLS master URL. The generated Vega app sets `VideoPlayer.src = item.mediaUrl` and has no playback authorization exchange. Neither source nor direct device evidence proves that native `VideoPlayer` propagates CloudFront cookies to master, variant and segment requests; Amazon's published Vega guidance places adaptive HLS in MSE mode, while the generated player currently uses direct URL mode. Signed cookies are the simplest multi-object CloudFront design **if** that native behavior is verified. Signed URLs instead require authenticated playback resolution plus rewriting the master and every variant/segment reference, with short expiry and renewal, without putting expiring URLs into immutable manifests. Neither mechanism can be declared safe with the present native/public-manifest contract. No viewer signing key was generated, no signing code or insecure bypass was added. Keep CloudFront disabled until a rights-bound TV authorization flow and real installed-client HLS behavior are implemented and qualified. OAC alone does not authorize viewers.

## Files prepared

- `infra/aws/staging/cloudformation/02-firelaunch-staging-foundation.yaml`: JFin-owned **local proposal** for nested IAM and OAC resources, CloudFront path mapping/guard and separate disabled-by-default enable flag. Requires JFin-reviewed change set; not deployed.
- `infra/aws/staging/scripts/deploy-foundation.sh`: preserves its previous local safety edits, accepts the new flag and passes false on first update. It still creates a change set separately from execution.
- `infra/aws/staging/test/integration-contracts.test.mjs`: offline nested-role, path-guard, OAC and disabled-default checks.
- `apps/server/test/media-storage.test.ts`: asserts that the published master URL maps byte-for-byte to its delivery object key.
- `docs/tasks/c6-aws-integration-contracts/client-access.patch` and `client-iam-handoff.md`: exact client-owned stack 01 policy edit and independently executable Claude Code instructions. The client template itself and stack 03 are untouched.
- `docs/integrations/aws-vod-foundation.md`: actual deployed-state correction, canonical paths and viewer-signing blocker.
- `infra/aws/staging/{README.md,HANDOFF.md,docs/CODEX-CONTINUATION-PROMPT.md}`: warning banners so the older top-level-prefix/CDN activation instructions are not mistaken for current next steps.
- This closeout. The pre-existing untracked infrastructure bundle, its four safety-edited scripts, preflight note and unrelated `scripts/staging/build-release.sh` work were preserved.

The client-owned access patch changes only operator ARNs in existing `DeployerPolicy`. Stack `firelaunch-staging-workload-identity` needs no template change: app/publisher roles already import the foundation managed policies and keep separate trust. The JFin foundation change updates existing managed policies and distribution in place, plus adds one CloudFront path function and one default-off parameter. A future change set must verify no resource replacement or unrelated changes before execution.

## Validation and limits

- Confirmed read-only AWS STS identity: account `363242105231`, `FireLaunch-Staging-Deployer` role, `us-east-2` context. Never accessed account `309403336615`.
- Live **old** IAM simulation: app original `GetObject`/`PutObject` allowed; nested app staged `GetObject`/`PutObject`, MediaConvert nested staged `PutObject`, and publisher nested delivery `PutObject` returned `implicitDeny`. This confirms the existing mismatch; it cannot qualify the unexecuted replacement policies.
- Focused server media/publication/resolver suite: **19 passed, 3 skipped, 0 failed**. Skipped cases need a database fixture and are not claimed as passing.
- New infrastructure guards: **2 passed, 0 failed**. Server typecheck and build passed. `bash -n` passed. Live CloudFormation `validate-template` for the edited JFin foundation passed. `git apply --check` passed for the separate client patch. `git diff --check` passed for tracked changes; new files received separate whitespace checks.
- Local runtime was Node `24.21.0` with npm `11.19.0`; the repository declares npm 12. The focused build and checks passed under the available npm, but a declared-toolchain rerun remains for later aggregate qualification.
- No signed-cookie/URL master, variant, segment, expiry or revoked-auth test passed: the required native authorization implementation is absent. No real Vega or CDN playback was attempted. No live policy deployment, private object probe, MediaConvert job, publication, or VPS credential exercise occurred.

| Gate | Result |
| --- | --- |
| G1 canonical media-key contract | PASS offline; live IAM remains old |
| G2 CloudFront object-path mapping | PASS template/offline; distribution remains disabled |
| G3 secure HLS viewer authorization | **BLOCKED**; native playback and entitlement contract absent |
| G4 IAM role boundaries | PASS review/offline; live policies require separate deployments and simulation |
| G5 application and infrastructure tests | PARTIAL; focused checks pass, auth/device cases cannot pass |
| G6 client IAM review handoff | PASS; separate patch and full client instructions |
| G7 no unapproved AWS mutations | PASS; read-only identity/simulation/template validation only |

## Exact next integration step

The client should review the [IAM handoff](client-iam-handoff.md) and, only after approving its change set, update its own access stack. In parallel, JFin must implement and qualify a native Vega HLS playback authorization path for master, variants and segments, with a short rights-bound entitlement and revoked-content denial. Then JFin can review a foundation change set that keeps `QueueStatus=PAUSED`, `EventProcessingState=DISABLED` and `DeliveryDistributionEnabled=false`, deploy it under separate authorization, and repeat live positive/negative IAM simulation. Only after those gates pass should the VPS Roles Anywhere key/CSR and service-user integration begin. CDN enablement, jobs and media publication require later explicit qualification.

# C6 final staging cutover qualification — NOT GREEN

## 2026-10-16 final synthetic S3 recovery and cleanup — bounded GREEN

**Disposition:** GREEN for the approved, two-object synthetic S3 copy, byte-integrity and current-key cleanup sequence. The client leg is evidenced by its returned results and handoff; the developer cleanup and VPS read checks below were directly observed. This is **not** a full current-object app-role privacy proof, a database/object archive restore, a timed rollback, or staging cutover qualification. The full cutover remains **NOT GREEN**. This section supersedes only the earlier statement below that no client AWS object operation had occurred; the earlier record remains historical.

The returned `FIRELAUNCH-C6-S3-RECOVERY-HANDOFF.zip` passed `unzip -t`, had exactly five regular files with safe paths and bounded sizes, and had SHA-256 `3ff61470ebd6409e23b54129acdf3d66047bf2a5d34a7fa91fe44a44fa01de0d`. Before execution, its `manifest.json`, `results/results.json`, `results/CLIENT-RESULTS.md`, and `developer-cleanup.sh` matched their reported SHA-256 values `bcd463dbea78526ba27c0daa8b412e006a964e69c6f126b0ee8c6ccf1cc3c8f4`, `dc0612be18088476b09d1958af4b62741df057f7865466b75fc7e78f26e4e17f`, `835175571c96ec14388446a7eb27dcbc7271d7afcaa9503d9019cb439a4c7f59`, and `04885603a1065d293ee9f6be9e5f7be963db7ae22824a15d346a6c5dd4a97630`. Manifest/results fields, both literal keys, version IDs and base64-encoded SHA-256 checksums were cross-checked. The cleanup script passed shell syntax review and was inspected for its exact two-key, current-version-only operations. The earlier client package and `client-recovery.sh` were **not contained in this returned ZIP**, so their reported hashes and client execution were not independently reproduced here.

The client reported account `363242105231`, Region `us-east-2`, qualification `c6-private-recovery-20261016`, `COMPLETE` at 2026-10-16 21:15:44 UTC. As the separate recovery role, its script reported two 69-byte AES256 `image/png` source reads matching SHA-256, exactly two conditional destination copies with matching bytes, denial of explicit source historical-version HEAD and destination version listing, and destination current-key delete markers. These are client-supplied results, preserved as [manifest](evidence/manifest.json) and [client results](evidence/client-results.json); they are not a fresh independent read of the client-side copy operation.

On `muffinos` as `deploy`, live STS returned `arn:aws:sts::363242105231:assumed-role/firelaunch-staging-app/7ef4d254904bcd15c3bc157fdeed0ddd`. Read-only app-role HEAD requests against **both exact destination current keys** returned HTTP 403. Because the current keys already had delete markers, 403 does not isolate an IAM denial from S3's response to an absent current object without listing permission. Read-only HEAD requests against the two named noncurrent destination copy version IDs also returned 403; that supports denial of version-specific reads of the client-reported copies, but does not prove denial of a present current object. The app-role destination privacy check is therefore **limited/inconclusive for a current readable object**.

In a fresh mode-0700 directory `/home/deploy/c6-private-recovery-cleanup.MPxK4TvV`, the three execution inputs were rehashed on the VPS and matched the values above. `./developer-cleanup.sh manifest.json results/results.json` ran **once**, exited 0, and wrote mode-0600 [developer cleanup results](evidence/developer-cleanup-results.json), SHA-256 `da3a47b30ee03bf637694f130ab1d67a8c449aca67fcd2743ce9def230327275`, with `status: COMPLETE`. It verified both source current versions and hashes before the first delete, rechecked each immediately before deletion, and used only unversioned `DeleteObject` on the two manifest source keys. The returned source delete markers were:

| Exact source key | Prior current version | New delete marker |
| --- | --- | --- |
| `private/b55302647afed0370adb163c318827bc5eed1bd9de2960a0e56e063d585e20fd` | `FoQeBZYY8Nm.dS1DP3H_oWqDNtJGiJ4Q` | `1eOH8rhSWuT3cQIG75nMgcrLgkvqJUk_` |
| `private/c4789ea25b0f3a17a166bb2389d0a790688408b1b44f894241cfaafff34485c9` | `MRzMWAkfiNyVHd3uoofpEzeg5zl9nwRK` | `xngEffp2ky.e7NuqfQmI7ojNtJyiMfin` |

The script's post-delete HEAD requests and a separate app-role read returned 404 for both source current keys. No `DeleteObjectVersion` was called, so the prior object versions and the client's noncurrent destination copies were not targeted for deletion; version history was not independently enumerated by this role. No unrelated key was passed to a write call. A read-only post-check found `firelaunch-staging.service` still active at PID `486903`, `/srv/firelaunch/current` still pointing to `/srv/firelaunch/releases/20261011T163833Z`, version `0.5.8`. This developer cleanup made no IAM change, 0.6.7 deployment, database migration, staging restart, or AWS media activation.

**Shortest remaining route to the timed rollback rehearsal and cutover:** (1) use a fresh, approved isolated AWS object fixture and an isolated schema-10 database to prove actual app-role current-object reads, owner/foreign access, encrypted object-bearing archive and restore into the separate bucket, with a read of a *present* restore object under the app role to settle the privacy boundary; (2) run the 0.6.7 candidate and independently built 0.5.8 compatibility rollback against those isolated AWS objects behind real HTTPS/Google sessions for two independent accounts; (3) rehearse and time the complete root-owned unit, database and object-endpoint promotion and schema-10 rollback on a disposable VPS-equivalent host, then verify authenticated health; (4) establish protected off-host backup/retention and a final quiesced backup, and obtain the maintenance go/no-go for the separately controlled live cutover. The synthetic objects in this qualification are now delete-marked and cannot substitute for a present-object or end-to-end rehearsal.

---

## 2026-10-16 storage and rollback completion attempt — historical disposition before client recovery

**Recommendation: NOT GREEN for AWS storage, full rollback and staging 0.6.7 cutover.** This attempt prepared a narrower client-owned IAM template and a separate 0.5.8 compatibility build, then stopped before infrastructure execution and S3 writes. Earlier isolated C6 recovery evidence and historical P5/P6/P4 dispositions are unchanged. No live staging restart, migration, release switch, object deletion, media activation or publication occurred.

| Requested result | Direct evidence and status |
| --- | --- |
| IAM scope / change set | Read-only STS identified `firelaunch-deployer` in account `363242105231`. The live `firelaunch-staging-app` role has the `firelaunch-developer-boundary` and only the Foundation app managed policy; no inline policies. The current Foundation policy covers nested `media/*` originals/staged keys, with an explicit delivery-publication deny. The originals bucket policy only denies insecure transport; media additionally grants CloudFront OAC read solely under `media/*/*/*/delivery/*`. Both examined buckets default to SSE-S3; media is versioned and has full Block Public Access. The proposed separate-stack policy was rejected at review because it gave the ordinary app role restore write/delete and the deployer is only authorized for the Foundation stack. [The revised client workload template](proposals/workload-identity-private-recovery.yaml) passed `validate-template`, hash `2fb3ecefe682e11a2096fa1d240a6e5ef5a970ddcc98d312752da63c030b96dd`. **No actual change set was created or inspected:** all available client administrator sessions were expired, and the deployer cannot create this stack's change set. Deployment status: **not started**. Expected changes require actual client-admin review before execution. |
| Identity and recovery boundary | Proposed app policy has Get/Put/Delete only for originals `private/*`, with AES256 required for Put. Proposed separate `PrivateRecoveryRole` is trusted only by the client administrator role, carries the developer permissions boundary, and can read active `private/*` and write/read/delete media-bucket restore `private/*`; it cannot modify `media/*` through this policy. The ordinary app receives no restore object grant. Existing application database checks enforce per-creator ownership; IAM is the shared service boundary, not a per-creator identity. These are **reviewed design claims, not deployed permissions**. |
| 0.5.8 rollback compatibility | A patch against exact 0.5.8 commit `2330dcf` adds explicit native-S3 named-profile authentication to the old private-object store and recovery CLI, with no database migration or route change. Patch SHA-256 `42a804a48988f073229eb0c70d485d01c82557d59cb9f832be46d9e53cc6d893`; separate tarball `artifacts/c6-storage-rollback/firelaunch-0.5.8-aws-profile-compat.tar.gz` SHA-256 `e28e1c90a7f0b00963888849555bd0613a3e38c60200c4b68428b58e155d2210`. The archive retains migrations through 010 and root version 0.5.8. It was built with Node 24.21.0/npm 12.2.0 and has **not** replaced the original live 0.5.8. Local build, server typecheck, profile fail-closed tests (3 pass) and isolated PostgreSQL private-object ownership tests (1 pass) succeeded. A real local MinIO/PostgreSQL source-to-restore CLI test passed in 1.27 seconds with a synthetic object, encrypted archive, distinct buckets, checksum comparison and owner/foreign checks. This does **not** prove the named app profile can access AWS objects. |
| Actual client AWS object operations | **Not run.** No approved IAM grant or synthetic S3 write authorization existed. No AWS object was created, read back, deleted, backed up or restored in this attempt. Current app role's managed policy has no `private/*` object permission. No claimed checksum, SSE, version-ID, private-access or consistency result is based on a live AWS object. |
| Complete recovery / time | **Not qualified.** The earlier isolated schema-10 → 13 → 10 database/object and authenticated-service rehearsal remains valid in its local scope. This attempt did not promote a restored AWS bucket/database or run the compatibility tarball as a service against AWS. The 1.27-second local CLI test and prior four-second database-only result exclude AWS transfer, VPS operator promotion, service start and authenticated health, so a full recovery-time measurement is unavailable. A schema-13 to 0.5.8 symlink-only rollback remains forbidden. |
| Remaining release gates | Reauthenticate the client administrator and create/review the exact workload-identity change set; obtain explicit execution and bounded S3-write approval; verify deployed IAM positive/negative decisions and source/restore object hashes plus privacy; run both binaries with authenticated object access against isolated schema 10/13 and time full restoration. Real Google/HTTPS candidate, two-account security proof, quiesced encrypted live backup, protected off-host retention, root-owned release/unit cutover and owner maintenance approval remain open. Live 0.5.8/schema 10 stays in place. |

The exact client-admin change-set request and source/build hashes are in [the proposal handoff](proposals/README.md). The old one-policy YAML remains marked **SUPERSEDED — DO NOT DEPLOY**. Approval is needed only after the actual change set has been created and its resource changes inspected; no execution or S3 write is authorized by this report.

---

## 2026-10-16 storage contract resolution (historical, superseded IAM proposal)

The [storage contract and bounded AWS recovery design](storage-contract.md) supersede the narrower provider-selection decision immediately below. Live 0.5.8 and candidate 0.6.7 **both require** private objects for authenticated media/evidence uploads, catalog and rights references, owner-scoped downloads, account export/deletion, health and encrypted recovery. The current live database read-only counts are zero private objects, zero pending garbage, zero catalog private-object references and zero active capabilities. The existing encrypted preflight archive records zero objects, but historical archives/unreferenced objects have not been declared disposable.

**Selected destination:** existing private, versioned, SSE-S3 client originals bucket `firelaunch-staging-originals-363242105231-use2`, using its separate `private/<64hex>` namespace and the named `firelaunch-staging-app` Roles Anywhere profile. Existing media bucket `firelaunch-staging-media-363242105231-use2` is the separate, restricted `private/` restore destination. Its live CloudFront OAC bucket policy reads only `media/*/*/*/delivery/*`; no private-object viewer access was found. The two bucket security settings and policy were checked read-only. No new bucket is proposed. The [review-only IAM template](proposals/private-object-access.yaml) grants only private-prefix object read/write/delete and restore-prefix list to the app role; it has not been submitted as a CloudFormation change set or executed. IAM adds no fixed service charge; bounded S3 requests and versioned bytes are metered. Existing roles, publisher split, media paths and protections remain unchanged.

The named-profile code from the prior correction is compatible with native AWS S3 by design and keeps invalid static keys from overriding the explicitly selected profile. It has passed local configuration tests, server typecheck and build; **actual profile-backed private-object reads/writes remain unqualified** until the scoped IAM grant is authorized. The staging backup wrapper now explicitly refuses profile-mode backup with a binary lacking the new adapter, preventing a false 0.5.8 recovery claim. No service configuration or backup was removed. The live 0.5.8 binary cannot use Roles Anywhere temporary credentials for private S3; a fully functional 0.5.8 rollback after switching storage to AWS still needs a qualified compatibility hotfix or an explicitly accepted degraded legacy-storage state.

**Recovery plan:** after infrastructure and synthetic-write approvals, use at most two isolated objects (PDF evidence and PNG media, at most 2 MB total) and an isolated database, record MIME/SSE/version IDs/SHA-256, take an AES-256-GCM archive, restore into a new `firelaunch_restore_*` database and the separate media bucket, verify owner denial and matching bytes/metadata/checksums, and clean only recorded test keys. Versioned delete markers/noncurrent data follow the existing 30-day lifecycle unless the owner separately approves exact-version cleanup. The prior local MinIO/database/OIDC rehearsal is preserved, not repeated. No AWS write or infrastructure mutation occurred during this contract resolution.

**NOT GREEN for live cutover.** Required next approvals/proof: owner acceptance of the existing-bucket architecture and exact IAM change set; a directly observed app-profile read of both `private/` namespaces; explicit authorization for the bounded AWS synthetic write/read/delete and encrypted restore; a full 0.5.8-compatible rollback decision; the already open real Google/HTTPS candidate, quiesced backup, retention/off-host copy, root-owned service cutover and timed rollback gates. The running 0.5.8/schema-10 service and PID/release link were not changed. Do not deploy 0.6.7 yet.

---

## 2026-10-16 private-object authentication correction decision (before implementation)

Read-only inspection of the running 0.5.8 process found `FIRELAUNCH_OBJECT_STORE=s3`, bucket `firelaunch-source`, Region `us-east-2`, and **no** `FIRELAUNCH_OBJECT_ENDPOINT`. The S3 SDK therefore targets AWS S3 in `us-east-2`, not a configured third-party endpoint. The explicit access key has the exact `c2` plus 20 lowercase hexadecimal format generated by `scripts/local-hosted.mjs` for local MinIO; it is not an AWS `AKIA`/`ASIA` key. Neither key value was printed. A separate Roles Anywhere app-role read-only request to AWS S3 returned `NoSuchBucket` (404) for `firelaunch-source`. Thus the 403 `InvalidAccessKeyId` comes from AWS S3 rejecting a local-test credential, and the configured bucket also does not exist at that AWS endpoint. The credential's original owner cannot be established solely from its format; the repository generator is strong evidence of local-test provenance, not proof of a retired external account.

**Selected correction:** keep the legacy explicit-key mode for existing S3-compatible providers; add an explicit opt-in private-object mode using the reviewed Roles Anywhere AWS profile only for native AWS S3 with no custom endpoint. The same selected mode must be used by backup and isolated restore. No automatic fallback from invalid keys, no provider/bucket substitution, and no reuse of P6 originals/delivery buckets or IAM expansion. Before any live configuration change, the storage owner must identify and approve a real private-object bucket and a key-scoped app-role policy for `private/` (plus a distinct restore destination), or identify a separate provider and supply its supported replacement credentials. The current service environment and stored credentials remain untouched. A read-only app-role check of the approved bucket is the next external gate; writes require separate approval.

The implementation uses a **named profile** through the AWS SDK `fromIni` provider, rather than the ambient default chain; that narrows the selected identity to the reviewed Roles Anywhere profile. `FIRELAUNCH_OBJECT_AUTH=aws-profile` is a future opt-in, not a live setting. Existing explicit keys remain present and are ignored only when that mode is explicitly selected. The profile branch rejects a custom S3 endpoint and a missing profile. The legacy default continues to require both explicit keys; unknown modes fail. `operations-cli` backup and restore share the same option parser, and the staging backup helper exports the reviewed profile/config path only in profile mode. No running process, protected environment file, unit, bucket or object was changed.

### Verification and remaining recovery gates

| Check | Result |
| --- | --- |
| Actual configured target | Native AWS S3, `s3.us-east-2.amazonaws.com`, bucket `firelaunch-source`, Region `us-east-2`; no custom endpoint. `firelaunch-source` returned `NoSuchBucket` 404 using the functioning Roles Anywhere app identity. |
| Credential provenance/error | Explicit key matches the repository's local `c2` MinIO generator format; AWS key format is absent. AWS S3 rejected it with `InvalidAccessKeyId` 403 in the earlier cutover test. The exact origin of the copied value is unproven. No secret value was disclosed. |
| Client AWS role comparison | The Roles Anywhere app identity reaches the client account and the existing originals bucket (`HeadBucket` 200). A read of an intentionally absent `private/` key there returned 404, which is **not** proof of permission to write. The media bucket's `private/` read returned 403. The deployed media buckets serve different P6 key/rights contracts and are not selected for legacy private objects. |
| Corrective code | Explicit named-profile mode added to private S3 storage; the same parser is used by normal operations and isolated restore. Legacy static-key behavior remains. Staging preflight and backup profile routing were updated. No protected configuration changed. |
| Local validation | Server typecheck/build passed on Node 24.21.0 (available npm 11.19.0, while the repository declares npm 12). Focused private-object tests: 3 pass, 1 database case skipped. Staging deployment tests: 6 pass. Recovery route test: 1 pass; two database/MinIO integration cases skipped because their fixtures were not active. Shell and Node syntax checks plus `git diff --check` passed. Prior isolated synthetic database/object/OIDC recovery proof is preserved in the linked closeout, not rerun or relabeled as live. |
| Live storage identity/read | **BLOCKED:** no approved working identity for an existing private-object bucket. Roles Anywhere is functional, but the configured bucket is absent. No known object could be read. Zero referenced live objects does not prove storage health. |
| Write/read/delete and integrity | **BLOCKED:** no authorized destination or explicit approval for a bounded live AWS write. No production object was touched. Prepare unique synthetic `private/` keys and record bytes, MIME, SSE, SHA-256 and version IDs only after bucket/role approval. |
| Encrypted backup and isolated restore | **BLOCKED for real AWS objects:** the earlier encrypted live schema-10 archive has zero objects; the separate MinIO synthetic restore passed. A new archive containing approved test objects and a distinct AWS restore bucket are required before full database/object rehearsal. |
| Cutover readiness | **NOT GREEN:** real Google/HTTPS candidate, protected quiesced backup, root-owned live release/unit cutover, timed full rollback, retention/off-host backup and owner maintenance approval remain open as listed below. Live 0.5.8/schema 10 stays in place. |

**Current recommendation: NOT GREEN.** The code path is ready for a future approved AWS S3 private bucket, but authentication and recovery cannot be qualified without identifying that bucket and its owner-scoped permissions. If the owner instead identifies a separate S3-compatible provider, recover that provider's credentials through its supported owner procedure and keep the default explicit-key mode; do not switch providers silently. No live deployment, migration, service restart, IAM change, AWS write, MediaConvert/CloudFront activation or deletion occurred.

The original read-only cutover assessment and conditional commands below are historical evidence from before this correction. Its instruction to replace explicit credentials is superseded by the provider decision above; none of its conditional cutover steps is authorized now.

Read-only assessment: 2026-10-16 15:23 UTC. Repository HEAD `7bf2c33`, root `0.6.7`. The pre-existing staging-helper and recovery-closeout working-tree changes were preserved. This is a new gate record; it does not revise the [isolated recovery closeout](../c6-staging-recovery/closeout.md), the [AWS integration closeout](../c6-aws-integration-contracts/closeout.md), or any historical P5/P6 result. No live migration, restart, quiescence, S3 write, DNS change, IAM change, media action, or publication was performed.

## Remaining gate results

| Gate | Result | Direct observation / missing proof |
| --- | --- | --- |
| Existing service and release | PASS, read-only | `firelaunch-staging.service` active, PID `486903`, current link `/srv/firelaunch/releases/20261011T163833Z`, version 0.5.8. PostgreSQL and Nginx active. Local and public HTTPS `/api/auth/session` each returned expected 401; HTTPS certificate verified. This is anonymous availability, not authenticated functional health. |
| Database state | PASS, read-only | Live database `firelaunch_staging` is schema 10, 9,436,183 bytes, zero `private_objects`. The prior isolated 10→13→10 rehearsal remains valid only in its documented scope. |
| AWS control plane | PASS, read-only | Account `363242105231`, deployer role, `us-east-2`; Foundation `UPDATE_COMPLETE` and `IN_SYNC`. No IAM or Roles Anywhere requalification was repeated. Both Foundation buckets reported zero current objects and zero retained versions/delete markers; they use SSE-S3, versioning and Block Public Access. |
| AWS S3 test-object backup/restore | BLOCKED | No live AWS object was written. A bounded synthetic-object probe requires explicit approval. The checked app-role policy denied a generic `qualification/` key; the probe must use an operator-reviewed allowed path or dedicated test bucket, without widening client-owned IAM silently. Empty buckets are not restore proof. |
| Existing private-object credentials | **FAIL** | The running process contains both explicit credential variables, but read-only `GetBucketLocation` and a `GetObject` on an intentionally absent `private/` key each returned `InvalidAccessKeyId` HTTP 403 using those exact in-process values. `GetBucketLocation` returned the same result with the prepared Node 24 runtime. No values were printed or changed. Zero live private objects explains why this has not been exposed by ordinary anonymous health. A successful authenticated read of a known synthetic object is required after operator correction. |
| Candidate real Google/HTTPS auth | BLOCKED | The existing certificate covers only `firelaunch.jfin.dev`; live origin uses that exact host and `/api/auth/callback`. A separate candidate HTTPS hostname, certificate, registered Google callback, isolated candidate process/database/object bucket, and two real account sessions were not evidenced. The earlier signed fixture is not real Google evidence. |
| Privileged operating boundary | PARTIAL | Root-owned prepared runtime and release copies were reported by the supervised preparation run. Read-only host checks confirmed `/opt/firelaunch-staging-ops` and `/srv/firelaunch/recovery-prep` mode 0700, root-owned Node, and the original service PID/link. The active `/srv/firelaunch/releases` tree is still deploy-owned; the loaded unit still invokes deploy-owned Node, has no loaded drop-in and reports `NeedDaemonReload=yes`. `deploy` has supervised sudo, not FireLaunch passwordless sudo. No unit or live tree was changed. |
| Encrypted backup capacity and retention | PARTIAL | Root filesystem has 75 GB free and about 14.98 million free inodes; the live database is 9.4 MB. The 0.5.8 preflight `.flrec` is mode 0600 and checksummed. Recovery uses AES-256-GCM and a 30-day `retainUntil`; `backup.sh` enforces 0600, unique names, a 256 MB format ceiling and space checks. The root-owned backup directory is empty; no FireLaunch backup timer or off-host retained copy was evidenced, and there is no final quiesced backup. A metadata deadline is not a retention schedule. |
| Complete rollback | BLOCKED | Isolated SQL/object/schema recovery passed previously. A live-compatible separate AWS private restore bucket, functional credentials, operator database-creation and promotion path, restored-bucket environment switch, and timed end-to-end service rollback are unverified. Schema 13 cannot be served by 0.5.8; `rollback.sh` correctly refuses binary-only rollback. |

## Pre-cutover checklist and required approvals

1. Operator restores **functional** explicit private-object credentials through the protected configuration path, preserving the current entries until the replacement is verified. Prove a scoped known-object `GetObject` and fresh backup with actual object bytes. Do not infer success from credential presence or a bucket `HEAD` response.
2. Obtain explicit approval for only synthetic S3 object writes and cleanup in an operator-approved staging path. Record exact bucket, keys, version IDs, maximum bytes, cost, source/backup/restore SHA-256, encryption, and cleanup of only those test versions. No creator object or published delivery path may be modified. Current role simulation denies `qualification/`; resolve this by selecting an existing permitted test scope or a separate approved test bucket, not by unreviewed IAM expansion.
3. Prepare a separate HTTPS candidate hostname/certificate and Google OAuth redirect URI `${CANDIDATE_ORIGIN}/api/auth/callback`. Use an isolated schema-10 database snapshot and private object destination, never the live database. Start only the prepared 0.6.7 candidate on a separate loopback port and test two real Google identities in independent browser profiles: secure `__Host-` cookies, CSRF, session restart behavior, owner reads/writes, foreign denial, and actual private-object upload/read. The candidate may migrate only its disposable database to schema 13. Record TLS and account evidence without tokens, email, or private keys.
4. Under separate supervised approval, rehearse the exact root-owned live layout, unit/drop-in, final backup and database/object promotion on a **disposable VPS-equivalent** environment. Record timed healthy activation and full schema-10 rollback. The existing isolated MinIO/HTTP test does not measure these operator steps.
5. Obtain a maintenance window, an agreed write-drain/quiescence method, candidate archive hash `672450904c2ae959dbaf4e0c59a0c5ee2014ff066e9e0817ac6b146691453289`, independent copy verification, maximum outage and restore-point policy. Approve the root-only unit/release changes, final encrypted backup, live schema migration, service start and, if needed, database/object endpoint promotion. Do not use `deploy-release.sh` for 10→13; its refusal is intentional.
6. Establish daily protected/off-host backup retention, alerting, key escrow and a periodic restore drill. Do not delete an archive solely because its metadata deadline passed without a reviewed retention schedule.

## Conditional cutover command sequence — **not authorized to execute**

Run in an interactive supervised root shell on `muffinos`, only after all preceding gates pass. Check each command's exit status and keep writers stopped from the first `systemctl stop` until a healthy new release or fully restored old release is accepted. The operator must substitute the final approved timestamped candidate release name and backup label; never paste secret values into a terminal command or report.

```bash
set -euo pipefail
old=20261011T163833Z
new="$(date -u +%Y%m%dT%H%M%SZ)-672450904c2a"
base=/srv/firelaunch
node=/opt/firelaunch-staging-runtime/node24/bin/node
ops=/opt/firelaunch-staging-ops
test "$(readlink -f "$base/current")" = "$base/releases/$old"
test "$(systemctl is-active firelaunch-staging.service)" = active
old_pid="$(systemctl show firelaunch-staging.service -p MainPID --value)"
test "$old_pid" -gt 0
sha256sum /home/deploy/firelaunch-incoming/firelaunch-c6-staging-recovery-candidate-prepared-v3.tar.gz
systemctl stop firelaunch-staging.service
test "$(systemctl is-active firelaunch-staging.service)" = inactive

# Root-owned copies were prepared already; inspect their contents/hashes before this step.
mv "$base/releases/$old" "$base/recovery-prep/deploy-owned-old-hold"
cp -a "$base/recovery-prep/0.5.8-legacy" "$base/releases/$old"
cp -a "$base/recovery-prep/0.6.7-672450904c2a" "$base/releases/$new"
chown -R root:root "$base/releases"
chmod -R go-w "$base/releases"
test "$(sha256sum "$base/releases/$new/package.json" | cut -d' ' -f1)" = "$(sha256sum "$base/recovery-prep/0.6.7-672450904c2a/package.json" | cut -d' ' -f1)"

# Review the complete unit file first. Replace only the one pinned ExecStart line.
unit=/etc/systemd/system/firelaunch-staging.service
grep -Fx 'ExecStart=/home/deploy/.nvm/versions/node/v24.15.0/bin/node /srv/firelaunch/current/apps/server/dist/index.js' "$unit"
sed -i 's|^ExecStart=/home/deploy/.nvm/versions/node/v24.15.0/bin/node /srv/firelaunch/current/apps/server/dist/index.js$|ExecStart=/opt/firelaunch-staging-runtime/node24/bin/node /srv/firelaunch/current/apps/server/dist/index.js|' "$unit"
systemctl daemon-reload
test "$(systemctl show firelaunch-staging.service -p NeedDaemonReload --value)" = no
test "$(systemctl show firelaunch-staging.service -p DropInPaths --value)" = /etc/systemd/system/firelaunch-staging.service.d/aws.conf

label="$(date -u +%Y%m%dT%H%M%SZ)-precutover"
"$ops/backup.sh" "$label"
archive="/var/backups/firelaunch-staging/$label-schema-10.flrec"
sha256sum -c "$archive.sha256"
test -s "$archive.meta"

# Final go/no-go: backup, credentials, separate restore target and operator approval.
# This one isolated invocation applies migrations 11–13. It does not start HTTP.
"$node" --env-file=/etc/firelaunch/staging.env --input-type=module -e 'const m=await import("file:///srv/firelaunch/releases/"+process.argv[1]+"/apps/server/dist/hosted-repository.js"); const r=await m.HostedProjectRepository.connect(process.env.DATABASE_URL); await r.pool.end()' "$new"
test "$("$node" --env-file=/etc/firelaunch/staging.env "$base/releases/$new/scripts/staging/schema-version.mjs")" = 13
ln -s "$base/releases/$new" "$base/.current-next"
mv -Tf "$base/.current-next" "$base/current"
systemctl start firelaunch-staging.service
test "$(systemctl is-active firelaunch-staging.service)" = active
local_code="$(curl --max-time 5 -sS -o /dev/null -w '%{http_code}' -H 'Host: firelaunch.jfin.dev' -H 'X-Forwarded-Proto: https' http://127.0.0.1:4184/api/auth/session)"
https_code="$(curl --max-time 8 -sS -o /dev/null -w '%{http_code}' --resolve firelaunch.jfin.dev:443:127.0.0.1 https://firelaunch.jfin.dev/api/auth/session)"
test "$local_code" = 401 && test "$https_code" = 401
```

The production go/no-go also requires a real authenticated owner/object smoke, schema-13 check and restricted-log review before accepting writes. If any check fails or exceeds the approved limit, stop the service and enter the matching rollback branch below. Do not use the example block as an unattended script.

## Conditional rollback commands and stop rules

**Before migration, or only if a direct schema check remains 10:** restore the old root-owned unit/release link and start the old service. Never infer schema 10 from a failed migration command alone.

```bash
systemctl stop firelaunch-staging.service
test "$(/opt/firelaunch-staging-runtime/node24/bin/node --env-file=/etc/firelaunch/staging.env "/srv/firelaunch/releases/$new/scripts/staging/schema-version.mjs")" = 10
ln -s /srv/firelaunch/releases/20261011T163833Z /srv/firelaunch/.current-next
mv -Tf /srv/firelaunch/.current-next /srv/firelaunch/current
systemctl start firelaunch-staging.service
```

**At schema 11–13:** keep the service stopped. `rollback.sh` must not be used. Verify the final archive, restore it through `operations-cli.js restore` into a fresh `firelaunch_restore_*` database and a separate empty private bucket, prove schema 10 and object hashes, then perform an operator-reviewed atomic database-name and protected object-bucket configuration promotion. The staging database role currently lacks `CREATEDB`, and the separate bucket/working credentials are not identified; therefore an exact executable restore/promotion command **does not yet exist**. A partial, improvised rename or a symlink-only rollback would risk data loss. Continue the maintenance outage and escalate to the supervised database/storage operator if this branch is reached before the rehearsal is complete.

## Health and downtime rule

Pre-cutover and post-cutover checks: unit active with expected PID and root-owned executable path; schema exactly 10 before and 13 after; local and TLS `/api/auth/session` return 401; real Google login returns an authenticated session with Secure/HttpOnly/SameSite cookies; creator project and private-object read/write operate with the validated credentials; foreign and bad-CSRF requests fail; no migration/storage errors in restricted logs. Check the dedicated TV/public origin separately if it is part of the release, without publishing media.

Rollback immediately on schema mismatch, backup/hash failure, invalid storage credentials, TLS/Google failure, non-401 anonymous probe, failed authenticated owner/object smoke, foreign data exposure, sustained 5xx, unit crash or a breached operator-approved time threshold. The earlier four-second local database-only restore is **not** an outage estimate. No defensible maximum or expected downtime exists until the full root-owned database/object/service rehearsal is timed. The proposed operating window is 30 minutes, with a 10-minute activation decision point; both require operator acceptance and a measured rollback time before use. The restore point is the final quiesced archive; accepting writes before final go/no-go creates a data-loss window on rollback.

**Recommendation: NOT GREEN.** Keep the live 0.5.8/schema-10 service running until the invalid private-object credentials, real AWS object probe, isolated real Google/HTTPS candidate, protected retention and full timed rollback are qualified and the owner explicitly approves quiescence and cutover.

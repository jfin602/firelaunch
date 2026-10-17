# C6 private-object storage contract — review only

## 2026-10-16 storage IAM correction

The original one-policy proposal below is preserved as historical review evidence and is **superseded**. It let the ordinary app role put/delete isolated restore copies. Read-only live IAM inspection also found that `firelaunch-deployer` can create change sets only for `firelaunch-staging-foundation`; its CloudFormation execution role cannot attach policies to `firelaunch-staging-app`. The client-owned `firelaunch-staging-workload-identity` stack must be updated by a fresh client administrator session. No change set was created or executed.

The [revised exact workload template](proposals/workload-identity-private-recovery.yaml) is based on the live stack template (SHA-256 `c5962ebd60ff14cb316cc13774130fa770a8024cc39448a0188eb5002d3f621a`, not the slightly stale checked-in stack 03 template). Its SHA-256 is `2fb3ecefe682e11a2096fa1d240a6e5ef5a970ddcc98d312752da63c030b96dd`. It adds an active `private/*` inline policy to the existing app role and a separate, permissions-bound recovery role trusted only by the client administrator role. The app has no restore-bucket object grant. The recovery role can read source objects and write/read/delete only isolated restore objects; its `PutObject` requires SSE-S3 `AES256`. Neither role receives access to `media/*` beyond its existing permissions. CloudFront still reads only approved `media/*/*/*/delivery/*`; `private/*` is disjoint from MediaConvert original/staged/delivery keys. Server-side owner checks remain the tenant boundary within the shared active prefix.

CloudFormation `validate-template` passed with `CAPABILITY_NAMED_IAM`. The client administrator profiles available locally had expired sessions, so an actual change set and its resource-level change report remain **unavailable**. The expected changes are `ApplicationRole` policy modification without replacement, one `PrivateRecoveryRole` addition, and one output. They must be checked against the actual change set before execution. Use all six existing stack parameters with `UsePreviousValue=true`; do not pass the Foundation execution role. Infrastructure execution and any AWS S3 writes still require explicit approval.

## Original storage proposal (historical; IAM route superseded above)

Date: 2026-10-16. Root candidate remains 0.6.7; live staging remains 0.5.8/schema 10. This design supersedes the earlier assumption that a new private-object bucket is required. No AWS change set, bucket write, service restart or database migration has been executed.

## Requirement and evidence

Both the installed 0.5.8 module and current 0.6.7 source require S3 private-object storage in hosted mode. Authenticated project routes upload `media` or `evidence`, return owner-scoped metadata, issue short download capabilities and delete objects. Catalog attachments and rights evidence reference owned private-object rows. Account export/deletion, orphan cleanup, health and encrypted database/object recovery also use the store. This is distinct from P6 managed-video originals, HLS staging and approved delivery. The object key is always `private/<64 lowercase hex>`, with a maximum 1 MB object, AES256 `PutObject`, conditional create and owner-scoped metadata. The S3 bucket is server-only and does not appear in public manifests.

Live read-only counts on 2026-10-16: `private_objects=0`, `private_object_garbage=0`, catalog private-object references `=0`, active private-object capabilities `=0`. The existing mode-0600 encrypted schema-10 preflight archive contains zero objects; its original hash and digest are retained in [the recovery closeout](../c6-staging-recovery/closeout.md). This does **not** inventory all historical archives or unreferenced bucket objects. Preserve every credential and backup until the owner inventories and accepts retention. The current bucket name `firelaunch-source` does not exist in native AWS S3, and its configured static key matches the local MinIO generator format.

## Selected architecture

Reuse client account `363242105231` in `us-east-2`:

| Purpose | Existing bucket | Allowed keys | Runtime identity |
| --- | --- | --- | --- |
| Active private objects | `firelaunch-staging-originals-363242105231-use2` | `private/<64 lowercase hex>` | Named `firelaunch-staging-app` Roles Anywhere profile |
| Isolated restore only | `firelaunch-staging-media-363242105231-use2` | The exact source `private/<64 lowercase hex>` keys, in a different bucket | Same app profile only for supervised restore |

The two buckets are versioned, SSE-S3 encrypted and Block Public Access protected. The media bucket's CloudFront OAC policy names only `media/*/*/*/delivery/*`; it does not grant viewer access to `private/*`. No new bucket is needed. The app role presently has no `private/*` object grant, so the [review-only IAM template](proposals/private-object-access.yaml) adds `GetObject`, `PutObject` and `DeleteObject` only under those two private prefixes, plus `ListBucket` only for `private/` on the restore bucket. Originals already has bucket-level list permission. No publisher role, MediaConvert role, CloudFront distribution, trust policy, permission boundary, existing key or P6 media prefix changes. The application still enforces creator ownership before storage access; IAM controls the service's bucket/prefix boundary, not per-creator identity.

The template attaches one inline policy to the existing app role through a separate CloudFormation stack. This isolates the proposed IAM change from unrelated pending Foundation template changes. It is **not** an executed change set. Owner review must confirm the app role and bucket ownership, the CloudFormation execution role, current permission boundary/SCP, no policy-name collision and only one `AWS::IAM::Policy` addition. IAM has no separate fixed charge; S3 requests and versioned bytes are metered. The bounded rehearsal uses at most two synthetic objects of at most 1 MB each plus the same two restore copies. Deleted current versions may leave delete markers and noncurrent versions until the existing 30-day lifecycle expires; do not delete arbitrary versions. No media job, CDN traffic or new bucket cost is proposed.

The template passed AWS CloudFormation `validate-template` as a read-only call. After owner authorization to create a review artifact, the operator can create **but not execute** the new-stack change set with the exact reviewed template:

```bash
AWS_PROFILE=firelaunch-deployer aws cloudformation create-change-set \
  --region us-east-2 \
  --stack-name firelaunch-staging-private-object-access \
  --change-set-name firelaunch-private-objects-review-YYYYMMDDTHHMMSSZ \
  --change-set-type CREATE \
  --template-body file://docs/tasks/c6-staging-cutover/proposals/private-object-access.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --role-arn arn:aws:iam::363242105231:role/firelaunch-access/firelaunch-cfn-deployer
```

Creation is an AWS write and was **not** performed here. Replace the timestamp placeholder; verify account/role first. Review the complete CloudFormation resource and policy diff and obtain separate execution approval. If the execution role cannot attach the inline policy to the client-owned app role, return to its owner for a scoped change rather than broadening a boundary.

Candidate code opts into `FIRELAUNCH_OBJECT_AUTH=aws-profile`, uses `fromIni({profile: AWS_PROFILE})` and native AWS S3, and rejects a custom endpoint or missing profile. The existing static-key path remains the default for other S3-compatible providers. `operations-cli` source backup and restore choose the same mode; the backup wrapper exports the protected profile/config path in profile mode. No live environment is changed by this source edit. The live 0.5.8 binary has no named-profile support; the new backup wrapper now refuses to claim that 0.5.8 can make a profile-backed object backup. With zero live rows, its existing encrypted preflight remains a database-only snapshot, not functional-storage proof. A fully functional rollback to 0.5.8 against AWS S3 would need an independently qualified compatible storage hotfix or an owner-accepted temporary return to the already broken private-object feature; neither is yet approved.

## Bounded qualification, after IAM and write authorization

1. Review and approve the exact IAM template and create a CloudFormation **CREATE** change set for a new `firelaunch-staging-private-object-access` stack in account `363242105231`, Region `us-east-2`, using the approved execution role and `CAPABILITY_NAMED_IAM`. Inspect the full change set: only `PrivateObjectAccess` may be added; no bucket, role, Foundation, CloudFront or MediaConvert replacement. Execute only under separate infrastructure authorization. If current SCP/boundary prevents the grant, stop for client owner correction; do not add static keys.
2. Without writes, verify the named app profile's account/role and the already confirmed originals bucket location. The media bucket deliberately limits listing; its `HeadBucket` may return 403 without disproving scoped object access. A missing `private/<64hex>` read must return `NoSuchKey` 404 in each bucket after the policy update; 403 is a stop. This establishes the authenticated read path, not write permission. Do not infer success from a bucket HEAD alone.
3. After explicit synthetic-write approval, create one PDF evidence object and one PNG media object through the candidate's `PrivateObjectService` in an isolated database/project under two synthetic owners. Total source bytes at most 2 MB. Use random generated `private/` keys, `IfNoneMatch: *`, `AES256`; record object metadata, S3 version IDs, SHA-256 and MIME without recording secret credentials or object bytes in logs. Confirm second owner, anonymous access and forged capability are denied.
4. Take a mode-0600 AES-256-GCM `FLREC1` archive from the isolated database plus source objects. Verify archive checksum, database digest, object count and payload hashes. Restore into a fresh `firelaunch_restore_*` database and the **separate media bucket**, with `FIRELAUNCH_RESTORE_OBJECT_BUCKET` set only for the supervised operation. Verify each restored byte digest and metadata, capability invalidation, schema/version, owner-only API access and foreign denial. Repeat the corrupted/missing-object failure cases locally as already qualified; no need to damage AWS objects.
5. Delete only the recorded synthetic current keys after proof; verify `GetObject` no longer returns bytes. Record delete markers and retained versions. Permit the existing 30-day lifecycle to expire noncurrent versions, or request separate operator approval for exact-version cleanup. Keep encrypted archive under the protected, reviewed retention policy; do not remove historical backups. Verify zero live customer rows and unchanged live service/database before and after.

The rehearsal must run without using or migrating the live staging database. The existing local MinIO/database/OIDC recovery evidence remains valid within its isolated scope and should not be repeated. A later quiesced cutover still requires a new schema-10 backup, independent Google/HTTPS candidate checks, a timed full restore and operator-approved unit/release/database promotion. No cutover command is authorized by this design.

**Disposition: NOT GREEN.** The contract and smallest infrastructure proposal are reviewable. IAM execution, synthetic AWS writes, actual read/write/restore proof, 0.5.8-compatible rollback behavior and the wider HTTPS/cutover gates remain open.

## Local validation for this decision

CloudFormation template validation passed without creating a change set. Server TypeScript typecheck and build passed; focused private-object tests passed 3 with one database fixture test skipped; staging deployment tests passed 6. Shell/Node syntax checks and `git diff --check` passed. The built 0.6.7 module exports the named-profile adapter; the live 0.5.8 module does not. The service remained active with PID `486903` and the original release link after all read-only checks. This is implementation and design evidence, not live AWS private-object qualification.

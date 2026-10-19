# Q2 five-cycle qualification — Cycle 2/5

Date: 2026-10-19 UTC. **Final Cycle 2 status: PASS.** Cycle 1 completed PASS in `cycle-1.md`; historical evidence is retained. The owner explicitly directed, “All cycles approved across all circumstances. be as automatic as possible.” This was treated as authorization for the bounded negative probe described below within the previously specified preservation boundaries; no permission expansion, release publication or infrastructure change was included.

## Pre-probe inspection and exact scope

- Actual `ssh muffinos` STS request through `/home/deploy/.local/bin/aws --profile firelaunch-staging-app` returned account `363242105231` and `assumed-role/firelaunch-staging-app/<session>`. This is the existing short-lived Roles Anywhere application principal, **not** the human deployer or publisher. No certificate/private key was opened or exported.
- Live IAM app policy v3, read in Cycle 1, explicitly denies `s3:PutObject`, `s3:PutObjectTagging` and `s3:DeleteObject` for `arn:aws:s3:::firelaunch-staging-media-363242105231-use2/media/*/*/*/delivery/*`. The app-role trust uses the client CA and existing Roles Anywhere profile; no IAM change is planned.
- **Bucket:** `firelaunch-staging-media-363242105231-use2` in `us-east-2`.
- **One unique target key:** `media/0b6ad4132eae87c16f377242ba4d4d26/16e47bd8bb32a2853126c62c02b6d2a1/cc557eae1a2c60c36a0b369a42d9141a/delivery/q2-f5-deny-328882500eb2adfe/probe.txt`. It follows the nested S3 policy pattern but has synthetic identifiers unrelated to any creator or release.
- **One attempted action:** `s3:PutObject` as the confirmed app principal, with exact 16-byte ASCII payload `q2-f5-deny-only` plus newline. Expected AWS result: `AccessDenied` due to the explicit delivery-write deny, after an otherwise valid request to the existing bucket/key. No multipart upload, tag, ACL, public grant or CloudFront invalidation.
- **Preflight:** a read-only `ListObjectsV2` on the exact key returned no `Contents`; anonymous CloudFront GET of the exact path returned **403**. The live viewer function only admits release #1's different exact approved prefix and seven HLS names. Even an unexpected object creation at this synthetic key cannot become viewer-public through that function; direct S3 remains blocked by account/bucket public-access settings.
- **After the attempt:** repeat the exact-key object listing to prove absence. If unexpectedly allowed, mark **F5 FAIL**, stop access attempts and **do not automatically delete**; propose separate policy repair and cleanup. Query relevant CloudTrail/S3 event records if available. Remove only the local disposable payload file after the test; no release #1 object is touched.

No AWS mutation has occurred at the time of this pre-probe record. F5 remains PARTIAL; F6 PASS from retained evidence; F7 PARTIAL; Q2 NOT GREEN.

## One live denial and retest

Immediately before the request, a fresh STS call on the VPS again returned `arn:aws:sts::363242105231:assumed-role/firelaunch-staging-app/<session>` in account `363242105231`. A temporary local payload file measured **16 bytes**. Exactly one `s3api put-object` request used that app profile, target bucket/key and payload. AWS CLI exited **254** with `AccessDenied`, explicitly naming `s3:PutObject`, the exact target ARN and an **explicit deny in identity-based policy** `arn:aws:iam::363242105231:policy/firelaunch/firelaunch-staging-app-permissions`. This is an authorization denial, not an expired credential, malformed request, missing bucket or nonexistent-resource error.

The post-request `ListObjectsV2` on the exact key returned no `Contents`, confirming it was not created. A repeated anonymous CloudFront GET for the same path returned **403**. The temporary VPS payload file was removed. There was no publisher assume-role, delivery promotion, invalidation, release #1 change or AWS configuration mutation.

Read-only CloudTrail `LookupEvents` for `PutObject` in the bounded time window returned no events; `ListTrails` returned no regional trail. Those calls do **not** prove the absence of an S3 data event elsewhere and are not used to qualify the IAM denial. The actual S3 response and object-absence check are the direct evidence.

The earlier F5 IAM simulation and policy inspection predicted a delivery write denial. This request now proves that behavior for the **actual staging app role** on a canonical nested delivery key. The publisher policy remains separately scoped to delivery writes; no publisher write was needed or attempted because the already published seven-object release remains intact.

## Cycle 2/5 disposition

**PASS; F5 GREEN for the bounded existing FREE release.** Cycle 1 established the live stack, OAC/private S3, exact viewer path guard, role policies and budget; retained Q2 evidence proves positive approved CDN delivery and negative unapproved/private paths; this cycle adds the actual app-role delivery-write denial. This does not imply paid/protected delivery or a general future-media access policy is qualified.

F6 remains **PASS on retained release #1 evidence**. F7 remains **PARTIAL** pending real independent authenticated account/CSRF and isolated revocation/cache checks. **Q2 overall: NOT GREEN.** Automated tests: **0 run / 0 passed / 0 failed / 0 skipped**; no source modification or repair. Repository files changed: this evidence file and the pre-existing untracked Cycle 1 evidence file; no commit, version bump or AWS resource change. Next cycle: Cycle 3/5, using two separate real Google sessions if available. No synthetic JWT or fixture identity will substitute for them.

Final local check at 2026-10-19 02:13 UTC: HEAD `3eba83ffbe71646cd0e5b46a95d9b0f06707f264`, tree `d4949b2258341af86ba0f21745ddd83e3a7a8271`, root `0.6.7`; `git diff --check` passed, and the untracked evidence file has no trailing whitespace. No other working-tree file was edited by this cycle.

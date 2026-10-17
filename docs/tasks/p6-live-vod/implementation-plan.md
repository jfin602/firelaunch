# p6-live-vod - Manual execution plan

Status: DOCUMENTATION / NOT EXECUTED
Date: 2026-10-17 UTC
Model: GPT-6 Sol High for each manual Q1-Q3.
Inputs: [assessment](prompt-assessment.md), [matrix](qualification-matrix.md), [ADR 0013](../../decisions/0013-hybrid-video-access.md).
Target: carry verified 0.6.7 staging upload baseline forward; do not advance 0.6.8 or modify any historical closeout without a later approval.

## Dependency graph

Q1 (one real MediaConvert job + private READY HLS) -> Q2 (approved free CloudFront delivery + owner-bound PublishedManifest) -> Q3 (same installed Vega VPKG playback/refresh/rollback).

Each checkpoint stops on missing approval or essential evidence and produces its own closeout; a later checkpoint cannot infer an earlier PASS. If Q1 is NOT GREEN, Q2 cannot publish that fixture; if Q2 is NOT GREEN, Q3 cannot claim full live video despite possible independent offline player development. A genuine external blocker may be remediated in a resumed run of the same prompt rather than introducing a fourth planned stage.

## Q1 - Private MediaConvert integration and proof

**Preflight:** Verify source HEAD/dirty worktree, no duplicate staging service, active release schema, bounded preflight backup/rollback. Inventory account 363242105231 in us-east-2, deployed Foundation resources, queue status, EventBridge rule, private event SQS/DLQ, app control Roles Anywhere credentials and separate publisher role, originals/managed staging prefixes, prior job attempts and quota. Confirm the approved rights-owned short input is suitable for fixed 480p/720p profile. Compare actual IAM decisions with intended nested-prefix policy; test positive/negative **real permitted requests** when possible, not simulation alone.

**Implementation seam:** Reuse apps/server/src/managed-media-coordinator.ts and media-convert-provider.ts without custom encoding. The owned finalized upload binds a unique durable intent to exact S3 original SHA/bytes, queue/role/profile hash and private staging attempt before CreateJob. Trusted GetJob correlation and EventBridge private SQS are hints, retries/idempotency are bounded. Inspect actual host configuration and roles before proposing an additive runtime config. Do not deploy/source-edit without independent authorization and rollback.

**Authorized live test only:** First present exact paid activation scope, account/region, existing stack/queue/rule, one-job/maximum-work parameters, observed budget/credits/quotas and expected bounded cost. Await explicit owner/operator approval for each AWS state mutation/charge and any staging deploy. Activate only necessary resources; submit one approved fixture, monitor output, re-read GetJob and S3, validate complete HLS graph and rights-checked READY. Keep CloudFront disabled and delivery/ unpublished. Test replay/out-of-order/failed-job handling safely with offline/injected events unless a real failure can be observed without additional paid jobs. Stop on missing evidence.

**Evidence:** real job ID and source/output identity redacted, fixed profile digest, trusted account/region/queue, provider status, message reconciliation, playlist and segments/MIME/hash, private original/staged direct HTTP/S3/CDN denials, database/job state and publication pointer unchanged. After test, apply approved pause/disable disposition (do not strand in-flight jobs) and record actual usage/cost visibility. Produce Q1-closeout.md: GREEN only F0-F4.

## Q2 - Public free-only delivery and creator release

**Preflight:** Read Q1-closeout.md GREEN and verify actual ready rendition for authorized creator; verify no paid or unknown access policy can flow to the free public delivery. Recheck separate studio owner, rights/provenance, owned artwork, ChannelDeployment, persisted shelf intent and ChannelSpec draft content. Establish the P5 public-only dedicated TLS manifest origin with exact `/public/v1/deployments/...` GET allowlist; never expose Studio or authenticated /api.

**Operator boundary:** Inspect actual existing CloudFront distribution, OAC S3 bucket policy and disabled state, viewer path function, cache TTLs, allowed hosts, role trust, current CloudFormation parameters. Public approved HLS is unsigned per ADR 0013; originals, staged and unapproved/foreign/malformed keys remain inaccessible, and no purchase/rental/subscription content is eligible. Prepare *review-only* narrow change set and rollback strategy. Obtain separate explicit approval before execution, CDN activation, DNS/HTTPS changes or creator publication. Test access path policy under the real distribution, not templates alone.

**Creator sequence:** Creator explicitly checks current item, both TV rights, artwork and asset readiness; build validated draft, choose existing project channel/shelf and approve P5 immutable publication through existing Studio owner/CSRF workflow. Promote only matched verified graph via publisher credentials to immutable canonical delivery prefix. Verify manifest pointer/release SHA/ETag, full CloudFront .m3u8/segments HEAD/GET + MIME/bytes and input/destination exact path, and private S3 denial. Preserve previous healthy release and LKG; test nonready/foreign/revoked rejection and bounded revocation in an isolated disposable fixture, with CDN cache/offline limitations. Never intentionally revoke unrelated active creator content.

**Evidence:** exact consent/rights state, redacted deployment ID, manifest identity/digest/sequence and CDN path, CloudFront policy+negative HTTP checks, explicit owner publish action, public resolver from a nonowner device-capable network, cost/rollback. Produce Q2-closeout.md: GREEN only F5-F7.

## Q3 - Real Vega adaptive HLS and same installed VPKG

**Preflight:** Read Q1 and Q2 GREEN, inspect creator-bound source/build/manifest and live resolver, actual Vega CLI/SDK/VirtualDevice OS and log capture. Check native player support and SDK docs for adaptive HLS (MSE vs URL) at installed version. Current `templates/vega-channel/src/App.js` uses `VideoPlayer.src = item.mediaUrl` unqualified for HLS. If correction needed, implement smallest provider-compatible adaptive player with cleanup, pause/seek/Back and error behavior; preserve audio/content detail and remote release integrity.

**Local tests/build:** Use a distinct creator-owned package identity, genuine deployment HTTPS manifest origin, generated source with no secret/tenant data, SDK-compatible release build, exact VPKG hash. Host native builds stay disabled. Install the same VPKG once on VirtualDevice and record native launch/focus/detail/Back, actual HLS master/variants/segments requests, start/pause/seek, failure/recovery.

**P5/c5 carry-forward:** With explicit creator approvals, publish visible v1 already qualified in Q2; publish distinct v2 without rebuild/reinstall; verify same installed client refresh and pointer/hash. Network-off cold restart should render LKG v2. Controlled isolated test origin may return 404/5xx/bad-hash/bad-schema/timeouts, but do not mutate real immutable DB release bytes or a public shared origin. Restore real origin. Publish rights-checked new v3 rollback to old v1 content without overwriting v1/v2 release history; verify same installed package visibly rolls back. Record unchanged Ngest health before/after.

**Evidence:** SDK/OS/command, one installed package hash, screenshots/logs and actual network requests, v1/v2/v3 IDs/sequences/digests, offline/failure and rollback evidence, targeted native tests. Produce Q3-closeout.md: GREEN only F8-F9. A final P6 closeout is **not** automatically GREEN until matrix F10 and explicit version policy/remaining gates are assessed independently.

## Loop policy, scope and handoff

Each manual prompt allows at most three focused repair/retest cycles for directly observed defects. Use cheap focused tests first, one aggregate npm run check only at final convergence; never rerun all historical implementation stacks. A critical blocker (missing AWS privilege/permission, missing approved cost/creator publication, unsuitable media rights, CloudFront exposure, device tooling) stops that checkpoint and yields NOT GREEN or BLOCKED with an exact next operator action, preserving everything previously proven.

All prompts must:
- Check current worktree, refs and **docs branch** before any changes; the approved docs may be on `docs/p6-live-vod-hybrid-20261017` and may not be present in the runtime local checkout. Fetch read-only and integrate docs non-destructively if missing.
- Preserve canonical `firelaunch-staging.service` and schema 13, encrypted database and S3 backup/retention, exact release artifact hashes, Ngest and unrelated workloads; never create a second install.
- Use Node 24/npm 12 and current operator runbooks; do not use old FFmpeg worker, old CloudFormation proposal or old `/tv/v1` sample URL.
- Avoid auto-commits/pushes/merges, unrelated refactors and version changes. A source repair remains uncommitted for owner review until authorized release process.
- Redact signed capabilities, AWS/Google secrets, private S3 keys, media bytes and user-private data from shared closeout.
- Distinguish design, offline proof, staging observation, AWS paid activity, CDN exposure, native device and production/Appstore gates accurately.

## Outputs

Q1: `Q1-managed-private-hls.txt` -> `Q1-closeout.md` (when actually run).
Q2: `Q2-free-cloudfront-publication.txt` -> `Q2-closeout.md` (when actually run).
Q3: `Q3-vega-device-playback.txt` -> `Q3-closeout.md` (when actually run).

No runner manifest or runner invocation. No blanket deploy/AWS approval and no automatically generated closeout claiming GREEN.

# c6-usability — Implementation plan

Date: 2026-10-19. Status: authored, not run. Keep package.json and both lockfile version entries at 0.6.7.
Read README.md, prompt-assessment.md, docs/CURRENT-STATE.md, PRODUCT-MODEL.md, ARCHITECTURE.md and ADRs 0009, 0011, 0013. Verify local HEAD/worktree and actual staging status before any task. Preserve existing data and separate AWS Q2/Q3 evidence.

## P1: modal identity and library access

Sources: apps/studio/src/App.tsx, Home.tsx, Catalog.tsx, VideoUpload.tsx, style.css; Studio tests.
Create one large accessible popup/full-screen mobile sheet, keyed by project and optional existing catalog item. Link Add Video and video cards in Home/Catalog directly. Restore video draft/status/edit on reopening, keyboard focus trap, Escape, focus restoration, accurate account/project switch clearing. Keep advanced Catalog tools reachable. Reuse server-owned CatalogItem and MediaAsset; no duplicate lifecycle store. P1 can temporarily block popup closure during upload if needed; P2 owns detaching upload task. Test basic navigation/identity and build.

## P2: two-hour upload and popup-independent transfer

Sources: video-upload.ts, VideoUpload.tsx, api.ts and server media-upload-service.ts with related tests. Set browser/server duration to inclusive 1..7200. Assess current 250 MB browser vs existing 2 GB server cap and use a vetted, incremental chunked SHA-256 instead of file.arrayBuffer() before aligning browser up to 2 GB. Keep bytes/MIME/filename claims, 8 MiB signed multipart, exact checksum, idempotency, owner/CSRF and quota. Separate AbortController/upload task from popup visibility so closing within one tab does not abort; cancel is explicit. Show progress outside the popup and restore state on reopen. Warn before browser exit while uploading, and show safe restart on reload; browser File handle is not recoverable. Review server one-hour session TTL for big files and implement finite safe expiry/renewal strategy, not infinite sessions. Inspect DB duration check (currently 1..14400). Tests: size and duration bounds 7200/7201, memory-bounded hash, close vs cancel, idempotent retry, owner scope/session expiry. No actual cloud job.

## P3: verified two-hour HLS and exact cleanup

Sources: apps/server/src/media-storage.ts, managed provider/coordinator/publication/revocation callsites, fake S3 tests.
Configured MediaConvert profile has two variants and six-second segments; at two hours ~1200 segments per variant and ~2403 total objects. Existing verification rejects >250 segments, >600 objects and >1800 seconds. Existing ListObjectsV2 and delete cleanup assume 1000 keys; publication verifier separately checks <=250. Add bounded continuation pagination, reject repeated tokens, duplicate/foreign/extra/missing files and truncated lists. Set finite and profile-aware per-variant duration/object/byte limits adequate for 7200 seconds, not arbitrary unlimited. Limit S3 concurrency and streaming memory; never buffer an entire two-hour graph at once. Require fixed profile, canonical names, valid HLS/TS, checksum and metadata integrity. Publish only through existing explicit owner-approved verified flow; on partial staged copy failure do not announce a live release. Operator deletion after durable revoked state must handle >1000 exact asset-derived keys via bounded paging/batches; no wildcard or foreign deletion and safe interrupted cleanup retries. Tests: generated two-hour two-rendition ~2403 object fake graph, 7201 fail, missing/extra/duplicate/tampered, multi-page listing and >1000 cleanup. No paid AWS encoding or release.

## P4: progressive review through existing publish

Sources: VideoUpload/Catalog/Home/LivePublication/Delivery/api and Studio tests. Compact stage UI: initial upload/title/rights, then encoding, then optional metadata/artwork/basic collection (default Videos), then rights/source/HLS/ChannelSpec/deployment readiness, explicit creator channel review and publication. Preserve existing item and metadata on each reopen. Inline category creation only via existing catalog write semantics; defer multiple shelves, ordering/featured/drag-drop. Reuse LivePublication checkLiveReadiness/approveLive/publishLive and revisions or extract focused shared hook; no second publish authority. User must see current channel-wide changes and explicitly approve FREE release. Fail closed on missing approved public HLS, source, rights, artwork, stale revisions, revoked file or paid/restricted mode. Published vs unpublished draft derives from actual release history and can be reopened/edited. Native app export and Amazon submission stay separate.

## P5: creator UX/accessibility convergence

Tests and polish around active polling, failure/retry, processing unavailable, in-tab transfer progress, close/reopen/reload, multi-video Home/Catalog deep links, preserved metadata and status, stale cross-account/project fetch cancellation, modal keyboard/mobile accessibility and reduced motion. No fake percentages/data, no silent publication. Prefer action within 3 clicks to find an added video. Verify affected Studio/server build/typecheck and focused tests; reserve aggregate evidence in prior checkpoints rather than repeating the full npm run check for the fast closeout. Do not broaden to unrelated redesign.

## P6: autonomous repair, fast UX smoke, AWS ingest activation and protected deployment

Inspect P1-P5 evidence, exact candidate SHA/version 0.6.7 and worktree. Autonomously diagnose and repair remaining blockers using at most two focused source/config repair cycles. Run targeted Studio/server tests plus typechecks/build, stack grammar and diff checks; reuse unimpacted two-hour HLS evidence. Smoke browser UX (popup reopen, upload progress/metadata, truthful statuses, blocked publication) when available. No new hosted test upload finalization, paid test encode or public content release; mark missing browser evidence honestly.

After focused checks, deploy the tested schema-compatible application through the existing archive SHA/exact-command protected release, verified encrypted backup and rollback; preserve sole 4184 service, schema 13, and public release #1. Independently validate AWS identity 363242105231/us-east-2, existing foundation, private S3/CORS, scoped publisher/control roles, MediaConvert queue, job backlog, completion EventBridge/SQS/DLQ, app integration and budget. Owner pre-authorizes safe reversible changes needed for client media ingest, including enabling existing queue/rule, minimal scoped IAM/S3/CORS/runtime repair and AWS monitoring without repeatedly seeking approval. Do not unpause if unexpected queued jobs could incur processing costs; do not submit ANY paid test MediaConvert job or change CloudFront public access, publish media, perform a migration or touch Ngest. Record actual UX, DEPLOYED/BLOCKED/ROLLED BACK and AWS INGEST READY/NOT READY separately. Manual P6 can autonomously repair, but no self-commit or version bump.

## Dependency/checkpoint table

| Prompt | Slice | Handoff |
| --- | --- | --- |
| P1 | Popup + library identity | selection, lifetime, current tests |
| P2 | Background upload + 2hr admission | bounds, hash memory, TTL, close-vs-cancel |
| P3 | 2hr HLS verified graph/cleanup | page/byte caps and deterministic proof |
| P4 | Progressive review/publish | reused server-approved public-release seam |
| P5 | Usability and focused regressions | real-browser scenario and known gaps |
| P6 | Autonomous repair, quick UX, protected deployment + AWS ingest readiness | focused evidence, release rollback, queue/rule/config state |

## Non-negotiable guardrails

- Root and lockfiles version 0.6.7 throughout; reconcile local dirty checkout without reset/forced pull. Runner owns P1-P5 commits; exactly one final P6 manual closeout. No /activate step.
- Keep individual implementation checkpoints <=8 minutes target, 15-minute hard maximum. Stop with narrow blocker instead of doing unbounded work. Local/mock results never prove live cloud/device.
- Owner has authorized bounded reversible AWS staging ingest configuration in the verified client account and protected schema-compatible c6-usability deployment. This includes needed existing queue/EventBridge activation and narrow role/S3/CORS/app wiring repairs after checking job backlog and budgets. No new paid test processing, unapproved queued jobs, public CDN/path changes, unrelated stacks, destructive changes, live creator release, schema migration or Ngest changes.
- Preserve owner/CSRF, source and TV display/playback rights, private originals, publisher role separation, release #1, immutable releases, current staging schema and backup/rollback. Q2 F7 remains partial, Q3 unstarted pending direct evidence.

## P6 superseding instruction — autonomous repair, client-ingest readiness and deploy (2026-10-19)

The authoritative executable P6 prompt supersedes all earlier read-only or application-only P6 instructions. Reuse P1-P5 evidence and, within two focused repair/retest cycles, correct genuinely blocking defects. Run focused UI/API tests, typechecks/build and short authenticated browser UX smoke when available; avoid full npm run check, 2403-object fixture and Q2/Q3 qualification repeats unless impacted. Do not finalize a live upload or submit a paid MediaConvert test job. Missing Chrome tab is NOT VERIFIED, not fabricated evidence.

Autonomously deploy the exact tested schema-compatible candidate through scripts/staging/build-release.sh, verified archive hash and root-owned /opt/firelaunch-staging-ops/deploy-release.sh with protected predeploy encrypted backup and rollback. Narrow operator privileges are still required; never substitute blanket sudo. Confirm one 4184 service, schema 13, existing creator files, Ngest independence and preserved public release #1.

The owner pre-authorizes reversible changes necessary to make the existing FireLaunch staging video ingestion ready for client uploads: verify AWS identity/account/region, exact resource ownership and job backlog; fix scoped runtime IAM/S3/CORS, MediaConvert queue, EventBridge completion/SQS/DLQ, cost monitoring and role permissions; enable the existing queue/rule when no unapproved queued jobs can start. No new paid test processing, new public creator publication, unrelated AWS stacks, CloudFront allowlist expansion, customer data deletion, unsafe schema migration or credentials/permission bypass. Future **client-initiated** jobs can incur charges. Record separate UX, deployed/rollback and AWS-ingest-ready dispositions from actually observed state.

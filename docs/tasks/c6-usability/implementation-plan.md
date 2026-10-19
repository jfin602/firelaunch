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

Tests and polish around active polling, failure/retry, processing unavailable, in-tab transfer progress, close/reopen/reload, multi-video Home/Catalog deep links, preserved metadata and status, stale cross-account/project fetch cancellation, modal keyboard/mobile accessibility and reduced motion. No fake percentages/data, no silent publication. Prefer action within 3 clicks to find an added video. Verify affected Studio/server build/typecheck and focused tests; reserve one global npm run check for final closeout. Do not broaden to unrelated redesign.

## P6: independent manual closeout

Inspect P1-P5 runner checkpoint history and latest source, root version and test outputs. Run npm run codex:stack:validate -- c6-usability, one full npm run check on Node24/npm12 and git diff --check. In an authorized actual browser, observe owner login, initial video modal, saved library reopen, in-tab close while uploading, separate transfer cancellation, refresh retry warning, truthful encoding state, metadata/artwork/category changes, preview/readiness/review and explicit channel release gates, desktop and mobile/keyboard focus and cross-project isolation. Only rights-safe disposable fixture with separate explicit external approval if real S3/MediaConvert/publication actions are needed. For two-hour acceptance inspect deterministic full-graph ~2403-object fake S3 tests and 7200/7201 admission; do not assert live two-hour AWS encode or Vega playback from mocks. Create closeout.md with exact version/SHA/test totals, LOCAL CREATOR UX GREEN or NOT GREEN, real browser evidence and external gaps. Manual: no auto-commit, version/HEAD change, AWS spend or staging deploy.

## Dependency/checkpoint table

| Prompt | Slice | Handoff |
| --- | --- | --- |
| P1 | Popup + library identity | selection, lifetime, current tests |
| P2 | Background upload + 2hr admission | bounds, hash memory, TTL, close-vs-cancel |
| P3 | 2hr HLS verified graph/cleanup | page/byte caps and deterministic proof |
| P4 | Progressive review/publish | reused server-approved public-release seam |
| P5 | Usability and focused regressions | real-browser scenario and known gaps |
| P6 | Manual independent closeout | one aggregate + exact disposition |

## Non-negotiable guardrails

- Root and lockfiles version 0.6.7 throughout; reconcile local dirty checkout without reset/forced pull. Runner owns P1-P5 commits; exactly one final P6 manual closeout. No /activate step.
- Keep individual implementation checkpoints <=8 minutes target, 15-minute hard maximum. Stop with narrow blocker instead of doing unbounded work. Local/mock results never prove live cloud/device.
- No AWS queue/rule activation, new paid jobs, CloudFormation/IAM/CloudFront/DNS alterations, live creator publication, VPS deployment or Ngest changes; those require specific separate approval.
- Preserve owner/CSRF, source and TV display/playback rights, private originals, publisher role separation, release #1, immutable releases, current staging schema and backup/rollback. Q2 F7 remains partial, Q3 unstarted pending direct evidence.

# P7 — Prompt assessment: creator-bound Vega ZIP and independent playback

Date: 2026-10-20. Scope approved in [P7 README](README.md) and [delivery roadmap](../../roadmap/mvp-roadmap.md). **Assessment only, not build/device evidence.** Root version observed on GitHub main: 0.6.7. Phase versions 0.7.1–0.7.4 require a separately coherent 0.7.0 baseline before runner execution; this document does not modify package versions. Target: October 23 noon America/Chicago (handoff 11:30 AM).

## Existing evidence to reuse

- `packages/generator/src/index.ts` can generate Vega projects with a creator-bound `ChannelDeployment`, `src/release-config.json`, and an installed-app remote release client. The historical c5 Vega correction built a real **fixture-bound** x86_64 VPKG with Vega CLI 1.4.4 / SDK main@0.24.12112; c0 demonstrated an earlier fixture's VirtualDevice focus/detail/video. Neither was exported from a real current hosted creator project nor plays Q2's HLS on the current device.
- `apps/server/src/hosted-workspace.ts` generates/stores owner-scoped source in PostgreSQL, protects custom edits, exposes JSON source export and deliberately returns `Hosted Vega builds require an isolated build service` from `buildStatus/build`; `bundle` is blocked. `apps/server/src/api.ts` already scopes hosted project routes by authenticated principal and CSRF for writes, while `apps/studio/src/Delivery.tsx` disables hosted Build and shows artifact **paths**, not a downloadable ZIP. Existing `apps/server/src/workspace.ts` local build wrapper verifies a fresh VPKG but is NOT safe to invoke on the shared hosted server.
- `templates/vega-channel/src/App.js` currently sets `VideoPlayer.src = item.mediaUrl`; this is not real adaptive HLS proof. `docs/tasks/p6-live-vod/Q3-vega-device-playback.txt` documents the native SDK/MSE or compatible player inspection and independent device procedure. `docs/tasks/p5/P8-device-runbook.md` contains actual Vega CLI install/launch commands.
- Dated Phase 6 Q1 real managed private READY HLS and creator-approved Q2 FREE CloudFront release #1 exist. Q2 F7 remains PARTIAL/NOT GREEN; source artwork `/api/public-artwork/` implementation may be newer than the deployed version and is not proven reachable from VVD. Reuse only still-authorized public URLs. No new encode or creator publication is authorized.
- `docs/tasks/c6-supporting-media/` and the separate unfinished creative/video correction own creator media UI, thumbnail persistence, private Preview and publication artwork. P7 must consume its compatible final contracts without overwriting a parallel worktree.

## Gap and decision matrix

| Gap | Decision | Owned by |
| --- | --- | --- |
| Real creator/channel/deployment bound artifact, not fixture | Validate owner/project revisions, package and public-only HTTPS resolver; reuse generated source and test actual Release VPKG | P1 |
| Source is DB-backed; no native packaged artifact | Materialize a bounded revision-pinned source snapshot **only in isolated build job**; preserve custom edits and reproducibility | P1/P2 |
| Hosted builds intentionally blocked | Add strictly opt-in separately isolated worker; request/status/artifact retrieval remain owner+CSRF enforced; never child-process builds under VPS API identity | P2 |
| No downloadable binary ZIP | Package actual fresh VPKG + README + nonsecret export-info.json + SHA256SUMS and stream owner-authorized download | P2 |
| TV published artwork/HLS not verified | Test SDK-supported adaptive streaming, player lifecycle/sound/remote controls, exact rights-approved public release URLs | P3/P4 |
| No independent creator Studio-to-VVD result | Download/verify/extract/install from consumer perspective; capture SHA, TV/native logs and restart | P4 manual |

## Risks, alternatives and scope boundary

**Security highest:** building user-editable JS/native source may run arbitrary install/build scripts. A mere child process, OS user switch inside the credentialed VPS, directory name separation or disabling a Studio button is NOT sufficient. Prefer a dedicated isolated build worker on a separately controlled host/container/VM with no AWS/provider/PG/VPS secret mounts, tight network policy and ephemeral per-job filesystems. The hosted app sends an authenticated, immutable owner/revision/package-bound job to that worker; worker returns a signed/checksummed artifact result through a limited transport, never executes repository source in its privileged API. If no proven isolation available, fail closed and record a narrow operator blocker; do NOT turn on unsafe hosted builds to reach deadline.

**Dependency chain:** first establish real owner/deployment source and toolchain; then safe artifact production/export; then native HLS compatibility; last independent proof. Verify x86_64 first; ARM is optional, not a disguised Appstore readiness promise. The ZIP is a delivery wrapper, `.vpkg` is the real installable. Stable HTTPS published manifests remain device-read-only; media and artwork rights must be approved. Unpublished/draft/revoked/foreign assets and signed private URLs are never packaged.

**Avoid false blockers:** P1–P3 may implement offline-tested source and describe missing live credentials/SDK/VVD; implementation success is not P7 GREEN. P4 is the single final installed-device acceptance gate. Historical p6 Q3 v1/v2/offline/fault/v3 and Q2 F7 remain independently open; do not rerun a costly historic matrix just to qualify this minimal deliverable.

**Assessment:** Three focused GPT-6 Sol High implementation prompts followed by one independent GPT-6 Sol High manual browser/VVD closeout. ~8-minute goal and 15-minute maximum per implementation prompt; if any work proves wider, finish the smallest safe slice and report the exact separate bounded repair rather than silently degrading security.

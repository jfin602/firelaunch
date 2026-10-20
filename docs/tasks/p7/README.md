# P7 — Vega Export & Device Qualification

**Status (October 20, 2026): P1–P4 PROMPTS AUTHORED; P7 ENTRY BASELINE `0.7.0` APPROVED AND BEING ESTABLISHED; implementation NOT STARTED / native delivery NOT QUALIFIED.** Planned implementation versions 0.7.1–0.7.4. Deadline: October 23, 2026 noon America/Chicago (internal target 11:30 AM; freeze target October 22 5 PM).

## Goal
From signed-in Studio, a creator downloads a ZIP with a fresh real creator/deployment-bound x86_64 Vega release VPKG, extracts it independently, installs it on Vega VirtualDevice, sees their approved branding/shelves/artwork and plays their approved published free HLS video with sound, remote controls and success after app restart. A Studio browser Preview, fixture VPKG or ZIP of source files is not sufficient.

## Executable Prompt Stack (authored; not executed)
1. **[P1 creator-bound native build](P1-creator-bound-native-build.txt):** inspect actual git worktree and approved publication binding; reuse existing native generator/SDK; produce nonempty real owned VPKG, source/toolchain/release metadata and SHA-256. Verify public HTTPS manifest endpoint.
2. **[P2 isolated ZIP export](P2-isolated-zip-export.txt):** separate constrained native build worker with owner/project/CSRF authorization, ephemeral workspace, resource/time/network bounds, safe artifact collection and owner-only download. Hosted Studio shows progress/failures and downloads ZIP. Do not bypass the existing disabled-hosted-build guard by running creator code as the shared VPS service.
3. **[P3 native content/playback](P3-native-hls-integration.txt):** approved published immutable manifest, correct thumbnails, native SDK-compatible adaptive HLS player; focused device navigation/detail/Back/pause/seek/audio/restart repairs. No secrets, private signed URLs or unpublished content.
4. **[P4 independent manual closeout](P4-independent-export-closeout.txt):** from real creator Studio download the actual ZIP, extract/install/launch its exact VPKG on external VirtualDevice, verify branding, content, playback/controls and restart, record hashes/logs and GREEN/NOT GREEN. Manual independent gate, not runner-owned.

ZIP minimum: verified x86_64 VPKG, README with independent Vega VirtualDevice install/launch steps, nonsecret export-info.json, and SHA256SUMS. An extra ARM package is optional unless separately built and verified. ZIP is delivery wrapper; VPKG is the native installable artifact. The exported runtime references approved public-only HTTPS PublishedManifest and verified free HLS/artwork, not local loopback, private originals, temporary signed URLs, creator tokens or AWS credentials.

## Safety and integration
Reuse current ChannelSpec, CatalogItem, MediaAsset, ChannelDeployment, approved immutable release resolver and existing SDK tooling. Honor edited-source conflicts and real revisions; never silently regenerate over custom work. Native building untrusted creator code requires genuine per-job isolation from the shared staging server/credentials, fixed tool invocations and bounded resources. Verify other-owner build/download denial, stale artifact rejection, private data safeguards, and public media rights.

The separate Phase 6 creative/video correction can proceed concurrently and P7 consumes its final publication interfaces. Use still-valid existing approved FREE release #1 only if rights permit. No new paid encode, public CDN/IAM mutation, creator publication or VPS deployment authorized by this document. Historical P5/c5 NOT GREEN, Q2 F7 PARTIAL and broader Q3 v1/v2/offline/fault/rollback qualification remain separate; do not invent success.

Implementation checkpoints P1–P3 will use focused checks with runner-owned commits once prompts are authored, usually within 8 minutes per prompt (15-minute hard cap). P4 runs manually. GREEN only when the exact independently downloaded archive and contained real VPKG run actual published HLS on VirtualDevice. Physical Fire TV, Appstore approval, paid entitlements and billing are outside scope.

## Prompt planning and execution notes (authored October 20)

Read [prompt assessment](prompt-assessment.md) and [implementation plan](implementation-plan.md). P1–P3 use `GPT-6 Sol High` and have **Browser required: no**; P4 uses `GPT-6 Sol High`, **Browser required: yes**, and is the **one final manual closeout**. Target versions: P1 `0.7.1`, P2 `0.7.2`, P3 `0.7.3`, P4 `0.7.4`. No `/activate` command.

**P7 preflight:** GitHub `main` now integrates the Phase 6 playback repair in `8f984b4`; this entry transition sets root `package.json` plus two top-level `package-lock.json` version fields to `0.7.0`, with all workspace versions/source unchanged. The authored P1–P4 prompt target versions remain `0.7.1` through `0.7.4`. This is a source-control/runner baseline, **not** a deployed native package or proof of VirtualDevice playback. Confirm your LOCAL checkout is clean or reconcile pending dirty changes before pulling and starting. Do not clobber concurrent creative work, uploaded media or staging. The operator-approved public poster CloudFront change remains separate; an already-approved free release can be used for P7 if valid and device-reachable.

```bash
cd /home/jfin/dev/firelaunch
git status --short
# If clean, update local checkout from the accepted Phase 7 baseline:
git pull --ff-only
git log -1 --oneline
node --version && npm --version
npm run codex:stack:validate -- p7
npm run codex:stack -- p7
```

Runner owns P1–P3 commits and stops for the independent P4 manual browser/VVD closeout. Browser/SDK/real-public-origin absence is a recorded blocker, never permission to run untrusted builds on the shared VPS or substitute a fixture. P4 writes `docs/tasks/p7/closeout.md` only after actual qualification; it is not pre-created by this authoring task.

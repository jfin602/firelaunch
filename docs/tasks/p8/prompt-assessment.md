# P8 — Prompt assessment: Creative Studio UX & Pipeline Confirmation

**Date:** 2026-10-21 UTC. Owner-approved /docs-review decisions. This is a planning assessment, NOT implementation, live rollout or qualification.

## Current source evidence and problems
- apps/studio/src/App.tsx exposes eight flat Surface values: Home, Catalog, Create, Design, Content, Code, Build, Publish. Aside from Home, the page shares a large Preview and permanently mounted inspector; style.css gives it a clamped ~340–430px width on desktop. Home duplicates project/quick navigation.
- apps/studio/src/Catalog.tsx is both media library and import/provenance/rights manager. apps/studio/src/VideoWorkspace.tsx is an already implemented reopenable modal for upload/details/channel/publish; don't replace it. The older Content component edits ChannelSpec pages, modules and media projections; Design edits brand; AgentPanel is existing creator AI request flow.
- apps/studio/src/Delivery.tsx splits Code/Build/Publish by engineering history. Hosted legacy Run Build and Download Vega ZIP controls may be disabled under honest capability guards; c7 R2/R3 source may now supply real queue/status/download. Inspect actual merged source before hiding or rewiring these controls. LivePublication.tsx performs explicit rights-checked content publication, NOT an app build or Appstore submission.
- Desert Heat visual baseline expects a right rail but must now lock it as contextual ONLY. Full-width content workspaces and preserved in-context Preview are both requirements.
- Phase 6 supporting media and P7 real native export/release work are integrated risks. **C7 closeout dated 2026-10-20 23:39 UTC:** R1 Studio startup SCOPED GREEN; R2 same-VPS isolated worker and creator-bound VPKG GREEN; R3 authenticated four-file owner ZIP SCOPED GREEN; R4 installed the exact VPKG, displayed branding/artwork/Back/restart but stopped at its first HLS TS fragment. Actual moving playback, independently verified audio and pause/seek are NOT GREEN. Reuse positive evidence, do not requalify R1–R3 or infer staging status from a GitHub source hash.

## One-click export gap confirmed (owner-approved P4 expansion)

Current `Delivery.tsx` opens `NativeExportWorkspace` on **Build & Export App**, but a second `Build App` click triggers `requestNativeBuild`; then Download ZIP is offered after an asynchronous build. `HostedWorkspaceService.releaseBuildInput` already uses `generateProject(approved.channel, deployment)` **ephemerally if no saved source exists**. However `createReleaseBuildInput` rejects a **stale saved source** even if all files equal their generated baseline, while the Code page's manual regeneration is based on the current editable draft rather than the approved release. Fix this in P4 without overwriting creator files: resolve missing or stale-but-unmodified source against the exact approved publication snapshot, preserve up-to-date custom source, and reject stale/unsafe custom changes. Keep server owner/CSRF/release rights and queue fingerprint checks, and use an explicit click-driven enqueue/resume/download flow; do not auto-submit from a modal mount or poll effect. When finished asynchronously, show an explicit Download ZIP fallback rather than assuming browser auto-download is permitted.

Targeted tests must cover absent/current/unmodified-stale/current-custom/stale-custom source, draft/newer-than-published mismatch, no approved release, request idempotence, stale/foreign/expired job denial and browser reopen/ready-download. P4 owns affected server source-resolution and Studio export tests, not new worker infrastructure or native playback qualification. Full aggregate remains P5-only.

## Scope decisions and risks

| Risk/gap | Mitigation | Owner |
| --- | --- | --- |
| Eight ambiguous overlapping destinations | Home / Library / Channel / Publish / Export; Channel subviews AI Assistant, Appearance, Pages & Shelves; advanced source under Export | P1 |
| Dead actions and duplicate navigation | Inspect handlers and actual live capability; remove redundant entries, keep real disabled states with plain-language cause/next action | P1 |
| Permanent inspector squashes task workspaces | Select/deselect driven context rail only for applicable editors; no blank reserved space; Library/Publish/Export full width | P2 |
| Preview/editor context could be lost | Make toolbar Preview accessible and discoverable; preserve 16:9 D-pad/Back semantics and meaningful side-by-side on selected editor | P2 |
| Creator media edits silently drift | Reuse CatalogItem, MediaAsset, Collection, ChannelSpec; verify preview/title/artwork/shelf persistence and rights boundaries | P3 |
| Publish confused with native Export | LivePublication stays approval/immutable remote content; Export invokes isolated R2/R3 job and verified owner-only ZIP, not a local fixture | P4 |
| External P7 artifact/device still unqualified | Reuse real P7 evidence if available; report bounded dependency rather than reimplement/build unsafely in P8 | P4/P5 |
| Deadline / concurrent P7 work | No changes before safe git handoff; separate bounded tests and one final manual walkthrough; no broad historical matrices | All |

## Execution choice
Four narrow implementation prompts and one final manual closeout. P1 navigation mappings without broad layout rewrite; P2 targeted layout/selection; P3 media correctness; P4 public release/export contract smoke only; P5 creator acceptance. Sol Medium for UI/P3, Sol High for publication/export and manual browser. Target <=8 min per implementation checkpoint, 15-minute maximum. Do not copy/paste two independent editors or redesign the TV renderer; no fake completed states.

**Phase 8 entry now approved by owner:** [P7 owner closeout](../p7/owner-closeout-2026-10-21.md) records partial evidence acceptance and the committed 0.8.0 root/lock baseline. P1–P4 target 0.8.1–0.8.4; P5 proposes 0.8.5 only at separate manual closeout. Do not start until the actual local checkout is clean/safely reconciled at 0.8.0, but do not demand another C7 R4 repair as an activation gate. Native HLS playback remains NOT GREEN for P9 final acceptance; no browser/device qualification is inferred by this version change.
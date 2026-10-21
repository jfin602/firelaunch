# P8 — Prompt assessment: Creative Studio UX & Pipeline Confirmation

**Date:** 2026-10-21 UTC. Owner-approved /docs-review decisions. This is a planning assessment, NOT implementation, live rollout or qualification.

## Current source evidence and problems
- apps/studio/src/App.tsx exposes eight flat Surface values: Home, Catalog, Create, Design, Content, Code, Build, Publish. Aside from Home, the page shares a large Preview and permanently mounted inspector; style.css gives it a clamped ~340–430px width on desktop. Home duplicates project/quick navigation.
- apps/studio/src/Catalog.tsx is both media library and import/provenance/rights manager. apps/studio/src/VideoWorkspace.tsx is an already implemented reopenable modal for upload/details/channel/publish; don't replace it. The older Content component edits ChannelSpec pages, modules and media projections; Design edits brand; AgentPanel is existing creator AI request flow.
- apps/studio/src/Delivery.tsx splits Code/Build/Publish by engineering history. Hosted legacy Run Build and Download Vega ZIP controls may be disabled under honest capability guards; c7 R2/R3 source may now supply real queue/status/download. Inspect actual merged source before hiding or rewiring these controls. LivePublication.tsx performs explicit rights-checked content publication, NOT an app build or Appstore submission.
- Desert Heat visual baseline expects a right rail but must now lock it as contextual ONLY. Full-width content workspaces and preserved in-context Preview are both requirements.
- Phase 6 supporting media and P7 real native export/release work are integrated risks. **C7 closeout dated 2026-10-20 23:39 UTC:** R1 Studio startup SCOPED GREEN; R2 same-VPS isolated worker and creator-bound VPKG GREEN; R3 authenticated four-file owner ZIP SCOPED GREEN; R4 installed the exact VPKG, displayed branding/artwork/Back/restart but stopped at its first HLS TS fragment. Actual moving playback, independently verified audio and pause/seek are NOT GREEN. Reuse positive evidence, do not requalify R1–R3 or infer staging status from a GitHub source hash.

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

**No automatic Phase 8 activation now.** Current root/lock is 0.7.3; wait for safe P7 source handoff and a separately approved 0.8.0 version-only entry. P1–P4 assigned 0.8.1–0.8.4; P5 proposes 0.8.5 only at approved closeout. Browser/device evidence cannot be claimed from docs or code review.
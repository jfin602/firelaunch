# C8 Hero Multimedia — Prompt Assessment

**Owner-approved 2026-10-22; authoring only.** [Design contract](../../design/c8-hero-multimedia.md) and [plan](implementation-plan.md). Correct one TV presentation mechanism, not the entire publishing pipeline.

## Inspected source and minimum feasible split

GitHub `main` at review commit `2892d3c77c47`, root package and both root-lock versions `0.8.17`. `packages/tv/src/runtime.ts` already projects `hero|rail|grid` modules and stores `TvState.screen/pageId/focusId`; `focusRows()` and `transition()` already move D-pad focus and route Select→detail→playback and Back→returnFocusId. This supports a shared focus-driven spotlight without a persisted new selector. `packages/contracts/src/index.ts` still gives Hero one content item, plus separate first rail; existing authored content must not be thrown away.

`apps/studio/src/Preview.tsx` currently maps each module to a card row, including the Hero card, and renders `PreviewArtwork` with owner-safe private thumbnail resolution; `templates/vega-channel/src/App.js` uses the same runtime but separately renders Hero cards in a scrollable `Section`. `templates/vega-channel/src/tv-layout.js` uses height-first constants (`heroArtworkHeight` ~24% screen), and `revealFocus` scrolls to each focused section. A current Hero module + subsequent rail therefore appears as stacked independent content rows, not one integrated focus-driven backdrop.

The source can be corrected as three focused slices:
1. **P1 Model:** pure hero slot/selector selection and focus reconciliation from existing content, first row, page and D-pad; no ChannelSpec schema change.
2. **P2 Studio UI:** adaptive poster/album/book foreground+atmospheric backgrounds and hero+row one-screen layout, using existing private art resolver.
3. **P3 Native:** reuse canonical model and same visual constraints with compatible Vega images and current native focus/scroll infrastructure.
4. **P4 Manual closeout:** exact-source staging FIRST, real authenticated Codex browser, user-supplied mock reference and native x86_64 device visual acceptance.

Two implementation prompts would mix shared TV state, Preview CSS and native React Native rendering into one broad risk cluster. Four prompts total, including manual P4, are an efficient bounded split under time pressure.

## Contracts and risks

- **Selection** is the focused bottom card; hero copy/art updates immediately with D-pad focus. Enter opens details, never auto-plays; Back returns to focused card. Retain focus when returning from detail and during transient top-nav focus (when possible), default to first eligible item on page/release. Keep selected hero state derived/transient, not a saved ChannelSpec override.
- **Template compatibility:** Existing Hero module is one-item (or empty), first rail/grid can be the selector. Avoid duplicate if one Hero item and row refer to same content; don't delete/reorder authored modules. Other rows/sections remain reachable. Rows/Grid-only pages render as before.
- **Mixed media:** video landscape, square audio, portrait book and optional audiobook must use correct Watch/Listen/Explore semantics without assuming an audio/book item has HLS media. Art is sourced from same owner/rights-safe asset, native public assets require approved HTTPS; no S3 originals or Studio Blob URLs in exported native package. Missing/too small/revoked art must degrade legibly.
- **TV geometry:** 1280x720 and 1920x1080 header+hero+first row fit without vertical scroll. Some creator-defined extra sections may require deliberate scroll; don't hide or delete them. Safe-area insets, 16:9 stage and D-pad/Back are contractual.
- **Qualification:** Owner will attach actual mock art to manual P4, not included in GitHub prompt files. Native visual capture must yield real nonempty evidence; zero-byte screenshot commands remain a known blocker. A final mock match without attached art is NOT GREEN for direct comparison. Existing Phase 8 NOT GREEN and distinct unqualified mixed-media publication remain historically intact.

## Runner / operational constraints

Correction folder `c8-hero-multimedia` requires all prompts `TASK: Correction 8 / Pn — ...`, exact `Required unchanged project version: \`0.8.17\`.` and canonical `Browser required: no.` P1–P3 / `yes.` P4. Exactly one final `closeout` filename/title pair. Runner owns P1–P3 Git commits `c8-hero-multimedia/Pn: Title` and stops before P4. P4 manually commits observed evidence, without a root/version bump.

P1–P3: focused tests/typechecks, no repetitive global build/test, no real staging or browser preflight per prompt, <=8-min goal/15-min hard stop with bounded scope. P4: one settled-source `npm run test`, protected staging per current schema **15**, real browser/device. If P4 needs focused repair, every changed source must be committed/tested/archived/deployed and only then retested. Current standing `muffinos` staging grant remains privileged, and public FREE release #1 must remain byte-identical. No owner grant for AWS policy, production, paid encoding or new publishing.

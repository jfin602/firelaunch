# P8B — Phase 8 Wave 2: Human-First Page Layout & Full-Screen Preview

**Status (2026-10-21): /prompt-ass + /prompt-plan + /prompt-write COMPLETE; SEVEN EXECUTABLE PROMPTS AUTHORED, NOT RUN / NOT QUALIFIED.** Root/lock on GitHub main at authoring: **0.8.4**. Phase 8 remains OPEN. This is a pre-1.0 **Phase 8 continuation B**, not a new roadmap phase or the old Wave 1 runner.

## Source of authority

- [Wave 1 P5 GREEN / DEPLOYED](../p8/wave1-closeout.md) is the tested protected staging UI/export milestone; its manual P5 did **not** change root version to 0.8.5. Its report contains dated host/browser evidence, not a present-time host inspection.
- [Human-first design contract](../../design/page-layout-human-first.md): exact creator journeys, controls, empty states, copy, media rights, responsive/focus, and parity gates.
- [Prompt assessment](prompt-assessment.md): real existing module/editor/runtime limitations and risk split.
- [Implementation plan](implementation-plan.md): sequential source ownership, tests, versioning, manual Wave 2 acceptance.
- [Current state](../../CURRENT-STATE.md), [C7 R4 real Vega device evidence](../c7-export-recovery/R4-playback-evidence.md) and [Phase 9 capability model](../p9/README.md) take precedence over old historical C7/P7 partial snapshots. The actual local HEAD/dirty state must always be inspected before executing.

## User-facing goal

**Channel → Pages & Layout** becomes a first-class layout editor with a simple happy path:

**Name page → Choose Hero / Grid / Rows → Choose actual creator-owned content → View in Preview (including full screen).**

Home in **new channels** defaults to Hero; other new pages suggest Rows; existing saved channels are never silently redesigned. Templates are valid starter section arrangements, not a locked alternate page schema. **Six bounded section types:** Featured Hero, Content Row, Content Grid, Text Area, Image Banner and Image + Text. Friendly selected-only controls (Choose content, Change image, Edit text, Move up/down, Customize) and an unobtrusive contextual inspector replace low-level module/URL forms as the primary route. **Fullscreen** uses the SAME interactive TV Preview state and player, with explicit TV Back vs Exit and focus restoration. No freeform web editor, separate page data source or second TV preview engine.

All changes must be represented in canonical ChannelSpec and project equally through Studio Preview and installed native Vega. New static types and presentation presets must never be pushed to an installed app that cannot render them: conservatively block or classify Requires App Update until verified compatible. Preserve media/image ownership and public rights, unchanged approved free release #1, working Wave 1 Studio and C7 worker/ZIP/media playback.

## Sequential prompt stack and versions

| Step | Version | Prompt | Responsibility |
| --- | --- | --- | --- |
| P1 | **0.8.5** | [Page templates](P1-page-template-foundation.txt) | New Home Hero and atomic new-page Hero/Grid/Rows seed; visual choice |
| P2 | **0.8.6** | [Pages & Layout workspace](P2-pages-layout-workspace.txt) | Page list, central composition and contextual-only selection |
| P3 | **0.8.7** | [Human-first section controls](P3-human-first-section-controls.txt) | Friendly edit, reorder, selection and save states |
| P4 | **0.8.8** | [Static image/text contracts](P4-static-section-contracts.txt) | Safe schema/projection/Studio Preview and existing-project compatibility |
| P5 | **0.8.9** | [Vega parity and compatibility](P5-vega-parity-compatibility.txt) | Native renderer and fail-closed installed-app publishing |
| P6 | **0.8.10** | [Full-screen Preview](P6-stateful-fullscreen-preview.txt) | Reuse same TV player/state, Back/Exit and responsive access |
| P7 | **0.8.11 proposed** | [Wave 2 staging closeout](P7-wave2-staging-closeout.txt) | MANUAL browser/native parity evidence + protected staging deploy; Wave 3 handoff |

P1–P6 are sequential **runner-owned implementation commits**. P7 is the exactly one final closeout-type prompt and is **browser-required/manual**: normal runner stops before it. P7 closes **Wave 2 only**, not Phase 8. Do not use `docs/tasks/p8/closeout.md` for this milestone; P7 writes `docs/tasks/p8b/wave2-closeout.md` only after direct evidence. No `/activate` or special stack activation command.

## Entry and validation

The already accepted root + two top-level lockfile version fields are **0.8.4**. P8B is a pre-1.0 continuation folder: its version offset is **4** (P1 targets 0.8.5, then consecutive patches). **Do not make a separate 0.8.5 entry bump** or rerun Wave 1 P5. Inspect the actual local checkout (`git status --short`, HEAD and root+lock versions, origin sync, P8B existing commits). Reconcile dirty P5 files without overwrite/reset/force-pull. GitHub version alone cannot prove a clean local start. Check the standard runner grammar:

```bash
npm run codex:stack:validate -- p8b
npm run codex:stack -- p8b
```

Implementation prompts target <=8 minutes (15-minute hard stop) with focused changes/test files and affected package typechecks only; the runner owns commit/version/diff checks. Avoid repeated root builds, Studio-wide tests, browser logins, native builder, MediaConvert and expensive qualifications. P7 runs one aggregate `npm run test` after source settles, a short actual creator browser journey, focused changed-module native proof and a guarded exact-hash staging rollout with valid operator permission. Reuse prior passing C7 R4 and Wave 1 evidence for unaffected systems; no physical Fire TV or Appstore claims.

## Wave 2 does not close Phase 8

Following a truthful **Wave 2 GREEN/NOT GREEN, DEPLOYED/NOT DEPLOYED** outcome, the owner reviews the staging UX, identifies further friction and decides subsequent continuation work. **Do not automatically activate Phase 9, re-label P7/P5/c5 historical results or claim broad Phase 8 closure.** Project deadlines and rights/security constraints remain in force.

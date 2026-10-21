# P8B — Prompt assessment: human-first page layouts and full-screen Preview

**Date:** 2026-10-21. **Assessment and prompt authoring ONLY; no source implementation, schema/version bump, staging deployment or device qualification.** This continues Phase 8 after [Wave 1 GREEN / DEPLOYED](../p8/wave1-closeout.md), whose tested root/lock version was `0.8.4`. Phase 8 is still OPEN. Normative product/UI direction: [human-first Page Layout design](../../design/page-layout-human-first.md). Real local checkout/host may differ from GitHub main; inspect before implementation. Deadline 2026-10-23 noon America/Chicago, internal 11:30.

## Grounded state of implementation

- `apps/studio/src/App.tsx` contains the Channel subview `Pages & Shelves` and an embedded `Content` editor mixing page creation, film/content editing and module controls. Add Page currently submits `{id,title,modules:[]}`; its module picker exposes low-level `hero/rail/grid/text` terms. P8 Wave 1 introduced five primary destinations and a contextual inspector, which Wave 2 must REUSE, not replace.
- `packages/contracts/src/index.ts`: `Page.modules` supports only `hero`, `rail`, `grid`, `text`; `SCHEMA_VERSION=1`. These existing variants can express three template scaffolds. Content and asset validators reject unsafe references. New Image Banner/Image + Text variants require explicit schema, projection and renderer work.
- `packages/channel-engine/src/index.ts` has `addPage`, `addModule`, `updateModule`, `removeModule`, `reorderModules` and `starterChannel`, currently with an empty Home page. Some logic assumes every non-text module has `contentIds` (e.g. removal/projection); new static modules must not pass through that branch unguarded.
- `packages/tv/src/runtime.ts` maps valid `ChannelSpec` to a TV page, but maps every non-text module's `contentIds`; new static modules must project explicitly. `apps/studio/src/Preview.tsx` renders `text` or item cards, with keyboard D-pad focus. `templates/vega-channel/src/App.js` renders `text` or media tiles, and must implement any additional native section type. A pretty Studio-only layout is NOT complete.
- `Preview` is currently embedded with its own `TvState`, refs, key handler and media player; naïvely mounting a separate full-screen Preview would reset current page/focus/playback. Prefer one component/instance and a presentation-only fullscreen wrapper.
- [Wave 1 report](../p8/wave1-closeout.md) records protected staging GREEN at `0.8.4`, native READY ZIP reuse, owner login, layout and export smoke; use its exact measured evidence for untouched functionality. [C7 R4 evidence](../c7-export-recovery/R4-playback-evidence.md) supports installed Vega HLS picture, loopback audio, pause/seek, Back and restart in its scope; no need for a general native-media retest.
- [Phase 9](../p9/README.md) owns long-term installed-client compatibility and native update workflow. New layout module types must be blocked or marked Requires App Update for an installed renderer that does not support them; never assume publishing new schema is a compatible content-only update. Old `ChannelSpec` and approved public release #1 are protected.

## Product and safety decisions

| Decision | Rationale | Owning checkpoint |
| --- | --- | --- |
| Home -> Hero default for NEW channels, other pages -> Rows default; Grid and Hero selectable | Good first impression and fast creation; **do not mutate existing channels** merely for defaults | P1 |
| Page-creation transaction, ordered sections with stable IDs and honest empty placeholders | Avoid blank canvases, fake licensed content and duplicate retries | P1 |
| One Pages & Layout work surface: page list, large composition, contextual inspector | Human-first edit, not technical form / separate canvas system | P2 |
| Creator-language actions and progressive `Customize`; safe reorder/delete and clear save states | Casual happy path, bounded flexibility, keyboard alternatives | P3 |
| New static Image Banner and Image + Text, rights-safe asset/text presets | Useful individuality without HTML/CSS; shared, strictly validated spec and old-data compatibility | P4 |
| Native Vega and public publication compatibility for new modules | No Preview-to-installed drift or accidental publication of unsupported layout | P5 |
| Full-screen Preview must preserve SAME TvState/media and editor focus | No duplicate renderer, remount reset or Escape-vs-Back trap | P6 |
| Real browser + one aggregate + bounded native parity + protected staging acceptance | Evidence-based Wave 2 closeout, Phase 8 still OPEN | P7 |

## Optimization / prompt topology

The originally proposed four implementation prompts overloaded its single static-section checkpoint with schema, TV projection, Studio editing, native rendering and publication compatibility. **Use six narrow implementation prompts plus one final MANUAL Wave 2 staging closeout (P1–P7)**. Additional runner boundaries cost small fixed overhead but reduce broad repair loops and preserve the 8-minute target / 15-minute cap. Each implementation runs only focused changed-boundary tests and package typechecks as necessary, with runner-owned version/commit/diff checks. No repeated full `npm run test`/build, active media encoding, ZIP creation, staging deploy or browser sign-in inside P1–P6. P7 owns one aggregate, real UI and changed-layout native parity/rollout with operator authorization. Unexpected cross-boundary failures trigger scoped repair, not skipped security tests.

**Version contract:** GitHub main root/lock is `0.8.4`, Wave 1 P5 did NOT bump to `0.8.5`. `p8b` is pre-1.0 continuation B, so the first runner prompt targets **`0.8.5`** and subsequent prompts consecutively target `0.8.6`–`0.8.11`, with P7 manual closeout target `0.8.11` proposed only. No `0.8.5` entry bump and no `/activate` required; the runner checks current baseline `0.8.4`, Git-proven prompt-prefix and local worktree. P1–P6 runner commits versions `0.8.5`–`0.8.10`; P7 does not self-commit/bump/deploy without valid authorization.

## Practical risks requiring precise acceptance

- Source/data compatibility: strict Zod variants, old saved channels, references, pages, versions and home starter defaults; build-time published manifest compatibility and live-rights rejection must be explicit.
- Static artwork: owned/private image references must use existing rights-approved paths; image selection for editor/Preview does not confer public TV rights. Avoid new freely editable untrusted arbitrary URLs or private object leakage.
- Native/TV: correct module order, media and static focus safety, parity of size/crop/text presets; exact changed VPKG device proof where granted, not a broad historical C7 replay.
- Human-first UX: obvious actions, labeled thumbnail templates, meaningful empty state, no technical IDs on normal path, no unannounced lost changes, keyboard/mobile and reduced motion.
- Fullscreen: avoid a second Preview state/engine, preserve playback and editor scroll/focus, native browser API + accessible fallback, distinguish fullscreen Exit and TV Back.
- Staging: owner-approved protected procedure, same exact tested source archive, retained hashed assets/backup, schema14 compatibility, signed-out/authenticated real root smoke and rollback. Merely requesting staging is not proof of operator permission or deployed success.

**Assessment outcome:** The seven-prompt split is recommended. Wave 1 P5 remains unchanged; Phase 8 remains OPEN after Wave 2 milestone. The plan and prompts are executable *after* validating a coherent local `0.8.4` baseline and runner grammar.

# C8-UI2 — Prompt Assessment: Secondary Editor Rail & Fullscreen Left Drawer

**Date:** 2026-10-21. **Owner-approved design, documentation and prompt authoring only**; no implementation, version change or new deployment. [New visual contract](../../design/channel-secondary-rail.md). Previous [c8-ui P4 closeout](../c8-ui/closeout.md) is **UI GREEN / STAGING DEPLOYED** at `0.8.10`, but broader P8B Wave 2 remains NOT GREEN for native static-section device evidence. Phase 8 remains OPEN.

## Current source assessment (GitHub main f5c515c)

- `apps/studio/src/App.tsx` already contains the correct two user-visible Channel tabs `Pages & Layout` and `Appearance`, an always-mounted `Preview`, the persistent `Content` editor and a shared `channel-fullscreen-root`, `dockVisible` + reveal/hide/fallback focus handling. **Preserve these**.
- `apps/studio/src/style.css` lines near the end define `.channel-presentation{grid-template-rows:...}`, `.channel-tv-stage` on TOP and `.channel-dock` at BOTTOM. This is the exact structural seam to replace with **secondary LEFT editor rail + right 16:9 Preview**, not another renderer/editor.
- Existing `.channel-editor .layout-workspace` already has Pages rail, Page Composition and selected Inspector, including Hero/Grid/Rows, Image Banner/Image + Text, save/dirty protection. Keep all working mutations, source/publish compatibility and accessible selection; reflow within the new LEFT editor panel.
- Existing `channel-dock-header` tabs and editor buttons are partially styled; section/page editing still displays stark white/default buttons. Use targeted Studio-scoped CSS design tokens and genuine component class semantics, not a global button reset that touches the TV Preview, Library, Export or native renderer.
- Existing fullscreen `previewFullscreen` and `fullscreenRoot` preserve one Preview/player/editor. Its `.preview-fullscreen .channel-dock` animates vertically via `translateY`, `.channel-dock-handle` is BOTTOM-centered, and `onPointerMove` uses distance from BOTTOM. **Modify that existing state/handle/geometry to LEFT edge**, preserving keyboard Alt+E, touch, reduced motion, fallback inert/focus and Escape vs TV Back. No duplicate Preview or second fullscreen system.
- `apps/studio/src/Preview.tsx` renders the TV and virtual remote in `.remote-bar` near the stage; normal view should place remote BELOW the actual 16:9 screen in the right workspace's lower dead space. Prefer positioning/reparenting presentation only without remounting Preview/player or changing TV navigation.
- P8B and c8-ui historical closeouts must remain unchanged. C8-UI2 is follow-up UI presentation only. Preserve prior staging root release, schema 14, public FREE release #1, worker and verified rollback. P8B native Image Banner/Image + Text physical Vega proof is outside this small correction.

## Implementation split

**Three focused implementation prompts, one final independent manual browser/staging closeout** is enough:

| Prompt | Ownership | Out of scope |
| --- | --- | --- |
| P1 | Replace horizontal bottom dock with fixed adjacent SECONDARY LEFT EDITOR rail; fitted right 16:9 TV, remote below, keep state | Global brand redesign / new editor |
| P2 | Style all Channel editor controls consistently using Desert Heat, accessible hierarchy/touch/focus | Global CSS overhaul / video theme |
| P3 | Convert existing fullscreen bottom edge dock into LEFT slide-out overlay, safe hover/touch/keyboard | New fullscreen engine / player refactor |
| P4 | One final aggregate, real browser geometry/fullscreen/controls, protected staging deployment and owner UI smoke | Full native P8B device suite or repeating C7 |

P1 must own DOM layout and rail instance; P2 owns button classes/visual coherence; P3 owns fullscreen overlay state and left reveal. This sequencing avoids P3 moving mount points twice. Each P1–P3: focused Studio tests and Studio typecheck only, runner-owned diff/version/commits, ~8-minute target/15-minute stop. P4 owns one `npm run test`, real browser and protected release. No repeat native Vega/HLS or MediaConvert.

## Version/runner/safety decisions

- Latest GitHub main source root `package.json` and two top-level `package-lock.json` entries: **0.8.10**; c8-ui UI GREEN and STAGING DEPLOYED. This is `c8-ui2` **correction mode**, so all prompts declare exactly `- Required unchanged project version: `0.8.10`.` and `TASK: Correction 8 / Pn — ...`. No `/activate`, entry bump or self-commit.
- Before running verify actual local HEAD/status and no unprotected dirty post-c8-ui changes. GitHub main is not proof of laptop cleanliness. Do not reset/overwrite the finished c8-ui source, nor rerun c8-ui/P8B.
- Exactly ONE final file with `closeout` in filename and TASK title; Browser required yes. Runner executes P1–P3 then stops at manual P4.
- P4's staging rollout is the intended qualification path, but requires review/authorization for the exact archive/hash and protected scripts; prior 24-hour operator grant might not cover a new archive. No bypass. A UI pass without live deployment is not "STAGING GREEN." P8B Wave 2 remains independently NOT GREEN unless its missing native proof is separately obtained.
- Failure modes: clipped narrow editor, too-small TV/remote overlay, losing section form state when fullscreen toggles, overlay auto-hiding over focused form, stale bottom-edge hover or inert fallback hiding editor, default-button CSS affecting television focus/buttons. Cover these explicitly.

**Assessment:** Approved scope is a narrow additive follow-up `c8-ui2`, leaving Phase 8 open.

# Final Channel Preview Composition — c8-ui3

**Approved visual target: 2026-10-21. DESIGN CONTRACT, not implementation or qualification.** The user-approved *last mockup in the conversation* is the visual reference. The user will attach that image to the Codex implementation and closeout prompts. This design supersedes prior c8-ui2 visual positioning of the TV frame and its controls, **not** its completed secondary left editor, button hierarchy or fullscreen LEFT drawer.

Authority: [Channel secondary rail](channel-secondary-rail.md), [Desert Heat](studio-visual-baseline.md), [c8-ui2 correction](../tasks/c8-ui2/README.md), [c8-ui3 stack](../tasks/c8-ui3/README.md). Image is not a GitHub repo asset; do not claim the image exists inside a repository or infer an accessible absolute path. Attach the approved image directly to the relevant Codex prompt to enable literal visual comparison.

## Exact normal-mode composition

1. **Main global navigation** remains at far left; immediately beside it is the **secondary left Channel editor rail** with Pages & Layout and Appearance. **No gap or misaligned inset seam** between the two vertical bars. Each still has a discernible subtle divider for navigation/a11y hierarchy. The header/topbar is aligned with the columns below, with unnecessary Channel-only outer padding removed. Retain global navigation/identity and status functionality.
2. **Neutral tool palette**: the editor rail, page rows, section cards, tabs and forms should adopt the same **dark/neutral charcoal gray family as the actual New Page popup**, not the former warm brown panel background. Deliberate accent orange is for selected/primary controls; destructive states retain meaningful risk color; focus remains visible. Do not recolor the creator TV brand or thumbnails.
3. **Channel workspace background**: the existing very-dark preview-stage background (near-black/charcoal) spans ALL of the Channel work area, behind both editor and TV. On Channel only, the scenic canyon image must be entirely hidden behind the continuous solid surface; no scenic fragments along top, seams or margins. Other Studio surfaces continue using their prior visual system.
4. **Right TV Preview** is the visual focus. It occupies the **maximum safe upper-right 16:9 rectangle** available in the right preview column, bounded by actual width AND height. No decorative TV bezel, outer card border, extra shadow, or thick frame. Never crop, stretch or fake 16:9 by distorting video content. The app's own intentional content boundaries/navigation remain untouched. The TV touches its allocated container edges where the geometry permits; letterboxing only where required by aspect ratio.
5. **Controls live below TV, not above it:** in the remaining lower-right space, put a compact row with `Draft TV Preview`, green `16:9 · Interactive` indicator, and a styled `View full screen` button. The Virtual remote stays a separate bottom/right controller BELOW the actual TV, not superimposed on frame or video. Use this space without gratuitous panels or dead margins. Keep keyboard/remote help legible and visually subdued.
6. **Viewport responsiveness**: desktop reference ~1440×900 and ~1280×720; tablet and phone remain operational via c8-ui2 adaptations. No whole-document vertical or horizontal scroll on ordinary desktop merely from padding/frame/control placement. Long editing content scrolls only inside secondary rail. Small screens prioritize real TV aspect, reachable metadata/fullscreen/remote, and usable controls; allow deliberate contained scrolling when truly necessary.

## Source-level implementation guidance

At source review, `apps/studio/src/Preview.tsx` renders `.preview-heading` before `.tv-frame`, and `.remote-bar` after the frame. `apps/studio/src/App.tsx` puts `View full screen` in `.channel-stage-action` above the Preview. `apps/studio/src/style.css` has `.channel-tv-stage .preview-wrap` vertical padding, `.channel-tv-stage .tv-frame` reserve calculations and border/shadow, and responsive overrides; the main Channel wrapper still includes outer workspace padding. These are the main seams for c8-ui3. Change markup only as needed to achieve the exact normal-mode order; **keep ONE Preview instance and ONE fullscreen/editor state**. A small stable control row or CSS reflow is preferable to re-creating Preview or portal-remounting it. Ensure `Preview.fullscreen` still has accessible Exit/Back semantics and no duplicated controls.

**P1** owns seam/topbar/background/tool surfaces. **P2** owns maximizing the TV and moving controls underneath. **P3** independently packages/deploys the qualified latest code FIRST and then tests real staging with the **Codex browser** using the attached visual reference; it may perform at most two directly observed narrow correction/redeploy loops with exact new hashes and valid grants.

## High-fidelity acceptance criteria

- Sidebar seam: no decorative gap; secondary rail begins exactly at primary sidebar edge and aligns correctly below header. Topbar/rail/stage share a crisp unified geometry.
- Editor looks gray/charcoal like New Page, **not brown**. Selected actions retain restrained warm accent, not every surface. Same panel design language at different widths.
- Canyon image is not visible anywhere in the normal Channel workspace (including at topbar-edge gutters), while unaffected routes keep existing aesthetic.
- Entire TV visible inside largest fitting borderless 16:9 upper-right region. Avoid wasted top/side padding and unnecessary space above TV.
- Draft/interactive metadata and Full Screen action **below** TV in a coherent utility row. Remote at lower right **below**, with no overlap on TV and no hidden controls.
- Existing c8-ui2 FULLSCREEN LEFT drawer still works: same mounted TV, remote, editor; hover/touch/keyboard edge access, focused/dirty hold, distinct Back/Exit; do not replace it with bottom dock.
- All P8B Hero/Grid/Rows, image/text sections, rights, draft persistence, Publish/Export and installed-client compatibility guards remain intact.
- Source, native Vega rendering, database schema14, public release #1 and isolated worker **unchanged** by visual layout patch.
- Real staging acceptance compares screenshots and computed layout against the attached mockup at desktop sizes and checks tablet/phone; JS DOM unit tests alone do not qualify final visual geometry.

This is a creator **UI polish correction**, not whole Phase 8, P8B native static-layout requalification, new native build, a content publication or Amazon submission.

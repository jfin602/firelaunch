# Page Layout & Full-Screen Preview — Human-First Design Contract

**Decision:** Owner-approved design direction, 2026-10-21, **Phase 8 Wave 2 (proposed continuation `p8b`)**. **Design specification only: NOT IMPLEMENTED / NOT QUALIFIED.** Wave 1 [P5](../tasks/p8/wave1-closeout.md) is GREEN/DEPLOYED at its tested 0.8.4 milestone; overall Phase 8 stays OPEN. See [Desert Heat baseline](studio-visual-baseline.md), [product model](../PRODUCT-MODEL.md), [architecture](../ARCHITECTURE.md), and [Wave 2 README](../tasks/p8b/README.md).

## What a creator is trying to do

> "Make my channel look good, put these videos on the right pages, and let me see the actual television experience."

The user should succeed without knowing `ChannelSpec`, `Module`, `Content ID`, TV focus order, CSS, native toolchains or publication schemas. **Default to a good-looking result; expose more control only in context.**

**Two modes, not two editors:** Normal flow is **Choose layout → Select content → Preview**. Controls for section appearance are progressive disclosure inside the same workspace; **no giant configuration dashboard, unrestricted drag-and-drop canvas, HTML/CSS editing or second preview renderer**. Advanced Source in Export remains independent for users who deliberately want code.

## The creator journey

### A. Create a new page (two essential decisions)

1. From **Channel → Pages & Layout**, select **New page**. Open a short accessible creation dialog/sheet, focus Page name; provide a useful example ("Movies", "Documentaries", "About").
2. Show three visually distinct **16:9 mini-previews with visible labels and plain-language descriptions**, selectable by click, keyboard and screen reader. **Hero** = a featured title and a content shelf; **Grid** = compact browse-all tiles; **Rows** = category shelves. No cryptic "Layout #1", blank identical cards or details-before-selection.
3. Default **Home to Hero** when a new channel is initialized; for a subsequent new page propose **Rows** by default (creator may choose either other option). Show a "You can change this later" reassurance without trapping the user in a wizard. The creator can proceed with just name + default choice.
4. **Create page** applies a single validated mutation/transaction that creates an actual page and its named starter sections, sets stable IDs, adds it to navigation, focuses the new page and shows the central preview. No blank page that immediately asks for low-level modules. Do not invent rights-cleared sample videos on hosted accounts: placeholders visibly say "Choose a video" and must not become published content.
5. Failed save states retain the entered name/selection and show a focused actionable error; no duplicate page after retry. Escape/cancel closes without creating anything and returns focus to New page.

### B. First edit: content-first, not options-first

On the newly created page, the **largest central surface is the page preview**. One obvious call to action appears on an unpopulated section: **Choose content**, **Add image**, or **Write text**. Existing owned, rights-cleared content is selectable from Library; never imply private files can be published until approval. Selection shows a human-readable title/artwork/status and a small confirmation, not raw IDs. Real edits update the single canonical ChannelSpec so Preview and Vega cannot diverge. Show an actual Save / Saved / Failed status; preserve edits across page changes. Avoid an accidental unsaved-loss path or fake autosave.

### C. Return to improve it

**Channel → Pages & Layout** includes a compact page list on the left (Home, Movies, About…), large editable page composition in the center, and a **contextual inspector only after selecting something**. Default state uses full available width. Select a page or section by clicking the actual visual or its labeled item in a sections list. The selected section is visibly outlined and has a small local action menu:

- **Edit content** / **Choose content**, for media sections
- **Edit text** / **Change image**, for static sections
- **Move up / Move down**, keyboard-operable alternatives to optional drag-reordering
- **Customize**, a collapsed collection of safe appearance choices
- **Remove section**, with warning when it would discard authored text/layout (remove only the section, not shared Library content)

The inspector shows only controls for the selected section and a clear Close control; Escape closes it where appropriate and restores focus. Switching projects clears transient selection and never leaks selected items into another owner's workspace.

## Three layout templates are starting compositions

| Creator-facing choice | Initial safe composition | Result after creation |
| --- | --- | --- |
| **Hero** (Home default) | Featured Hero + one Content Row | Spacious landing page; choose featured content later |
| **Grid** | Content Grid, optionally a small introduction heading | Browse page that feels complete with catalog content |
| **Rows** (new-page default) | Two content shelves with approachable names ("Featured", "More to explore") | Streaming-like browsing with clear groupings |

The template is **not a permanent `page.type` straitjacket**. Ordinary sections remain in the ordered page module sequence; the initial template choice can be recorded as provenance only if useful, never as another contradictory layout source. Empty slots are honest editor placeholders and cannot silently become TV media entries. If a creator later chooses **Change starting layout**, show a side-by-side preview/diff of what will change and what is retained. Do not delete populated modules or creator-written text automatically; either preserve their sections or require explicit acknowledgement of each destructive impact. Prefer "Add section" over frequent template replacement.

## Six bounded section types

| Human label | Existing model basis | Normal controls | Optional Customize |
| --- | --- | --- | --- |
| **Featured Hero** | `hero` (max 1 content ID) | Choose featured title, artwork from owned content | Artwork crop, text position, comfortable/compact |
| **Content Row** | `rail` | Heading, choose/reorder owned content or collection | Card size, spacing |
| **Content Grid** | `grid` | Heading, choose/reorder content or collection | Density, number of columns from TV-safe presets |
| **Image Banner** | New static artwork section | Select rights-allowed image, optional overlay headline | Crop, overlay alignment/background |
| **Text Area** | `text` | Heading, body copy, clear empty-state prompt | Text alignment, max line width/background |
| **Image + Text** | New bounded split section | Select image, title, copy | Left/right image and spacing |

For initial implementation, prefer real existing primitives wherever sufficient, **without inventing an entire generic rendering engine**. Image Banner and Image + Text will require **explicitly validated schema changes**, TV projection and Vega native renderer support, persistence/publication compatibility and backward-compatible handling of existing saved channels. An informational image/text section is not automatically selectable in the 10-foot interface. No arbitrary image URLs bypassing existing rights/ownership controls, no user-authored executable HTML/JS/CSS.

Keep settings deliberately small. Show **Content** by default and **Customize** collapsed. Prefer human names ("Card size: Comfortable / Compact", "Image side: Left / Right") to "padding: 24px", "align-items", "schema". Inputs should offer sensible default and short tooltips/help only where genuinely unclear. Use ~44px touch targets where relevant, visible keyboard focus, adequate TV contrast and safe overscan/text readability. Avoid a permanent orange outline on every control; Desert Heat orange remains an accent for selected/primary actions, not media artwork recoloring.

## Page list and ordering

- Page selection is separate from page publication: **edit private draft** is not **Publish live**.
- Show Home clearly first, other named pages below; easy New page, Rename and Change layout. Use non-destructive confirmation for deleting a page (last-page protection stays).
- Section order is top-to-bottom in the editor **and exactly the order in TV Preview/Vega**; keyboard move buttons are first-class. Optional drag handles can be enhancement, not the only movement method.
- Show names and content counts, not module UUIDs. An empty section should say exactly what to do next and should not force creators to know whether it is a hero/rail/grid module.
- Reordering must preserve stable IDs, saved content links, editorial copy, focus restoration and coherent catalog references.

## Preview: embedded and full screen, one state

**A visible "View full screen" control is persistent in the Channel toolbar**, independent of any selected section and available from other logical Preview access points. It enlarges **the same interactive Preview component and current TV state**, not a second TV renderer, screenshot, or editing canvas. Standard entry: editor -> full-screen 16:9 TV view -> exit -> same editor, selected page/section and scroll.

- Native browser Fullscreen API is appropriate where supported and directly invoked from a user action; if unavailable or disallowed, provide a viewport-filling accessible modal fallback without pretending that the browser entered native fullscreen.
- Preserve the current page, current remote focus, ongoing playback and navigation context on entry/exit. Avoid remounting Preview in a way that resets playback or D-pad focus.
- Full-screen shows only the creator's TV interface plus minimal overlay controls (Exit full screen, optional virtual remote/help); no permanent Studio sidebar/inspector.
- **Keyboard collision:** embedded Escape may mean TV Back. In full-screen, provide explicit accessible Exit and distinct reliable TV Back control/key (e.g. Backspace or visible remote) while defining Escape behavior consistently; do not trap the user in fullscreen. Document keyboard help inline or on request. Browser-native Escape may exit fullscreen before React receives it, so maintain focus/state after `fullscreenchange`.
- Maintain aspect ratio at desktop, tablet and mobile; fill viewport sensibly without cropping navigation or controls. Restore keyboard focus to the Full-screen trigger, preserve scroll position, respect reduced motion. Do not hide touch-accessible Back/Exit on mobile.

## What "preview parity" really means

**One semantic state, multiple projections** remains mandatory. Existing `packages/contracts` `Module` is a union of hero/rail/grid/text; `packages/tv` projects it, `apps/studio/src/Preview.tsx` renders it, and `templates/vega-channel/src/App.js` renders the installed app. The same section ordering, content binding, typography/background/crop presets, and interactive focus semantics must be either supported or clearly marked unsupported for the target published app. Static section copy must be sanitized and noninteractive. Invalid IDs, missing media, old specs and partially edited draft must fail safely.

**Phase 9 compatibility gate:** Existing already-installed native apps can accept only approved manifest changes within their supported section/rendering capability. Any new static layout type not understood by an installed Vega runtime must be classified **Requires App Update / Blocked**, not pushed as a "Publish Now" data-only change. Avoid unsafe unrestricted OTA native code, silent schema bumps or unreviewed new public rights.

The tested C7 R4 VirtualDevice and P8 Wave 1 GREEN/staging evidence can be reused for unaffected paths, but cannot establish parity for newly introduced sections. Require focused Studio Preview + generated Vega device evidence for the changed section behavior, with one bounded genuine device qualification rather than repeating the entire prior C7 worker/ZIP/media history.

## Human-first definition of done

The implementation should demonstrate these user outcomes, not just unit tests:

1. A first-time creator creates a Home Hero page with **no manual module configuration** and can locate the first content selection instantly.
2. The same creator creates a Grid or Rows page through a clearly labeled, keyboard-accessible choice; no blank unexplained canvas.
3. Editing text, changing an image, moving a section and renaming a page uses recognizable labels and visible save/undo/error states; no hidden technical terminology.
4. A casual creator can stop after choosing template and content; an advanced creator can discover customization without overwhelming the normal flow.
5. Preview and generated Vega agree on section order, content, static text/artwork, focus and supported style choices; media ownership and approvals stay intact.
6. Full-screen preview opens and exits with keyboard/touch, preserves the TV selection/playback and editor location, and offers explicit TV Back distinct from closing fullscreen.
7. Wide desktop, tablet and phone spot checks remain usable with no empty permanent right rail, horizontal clipping, inaccessible controls or focus traps.
8. Existing ChannelSpecs load and maintain their content; any format expansion uses deliberate compatibility rules and does not silently mutate live manifests.
9. Creator actions take the minimum practical number of steps and do not show fictional success, media rights or publication.
10. Wave 2 qualification uses a short end-to-end creator walkthrough, focused tests, and protected staging deployment only with appropriate scope and rollback.

**Out of scope:** pixel-level freeform canvas, arbitrary layout coordinates, custom widgets/plugins, live HTML/CSS scripting, new AI agent/chat implementation, templated website builder, automatic creator publication, new paid entitlements, unsafe public media access or physical Fire TV/Appstore claims.

## Evidence, progress and handoff

This specification is the **design contract** for subsequent `/prompt-ass + /prompt-plan + /prompt-write p8b`, not an executable prompt or a claim of production compatibility. The Wave 1 P5 prompt remains unchanged. After Wave 2 qualification/staging, report actual human friction and select further Phase 8 improvements before a separate final phase closeout.

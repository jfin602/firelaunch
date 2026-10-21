# FireLaunch Creator Studio: Desert Heat Visual Baseline

**Status:** Owner-approved visual direction (2026-10-17 UTC); **NOT IMPLEMENTED OR QUALIFIED**.
**Scope:** Authenticated FireLaunch creator Studio, application shell, project dashboard, catalog and editor. Not creator-owned Vega channel brand/theme.
**Visual authority:** The user-approved screenshot named `trailers.png` (1672 x 941 px; SHA-256 `cc664b2e717ca69368d7807644332f213a7ab115fb9b7ea06d04cfb8ba1ef590`), discussed and accepted in the FireLaunch project conversation on 2026-10-17. It contains a darkened sandstone slot canyon, charcoal dashboard, orange/red CTAs, left/top/right application rails, and three genre-diverse film thumbnails. See [reference provenance](references/README.md). Its fake names, metrics, navigation labels and images are **illustrative**, not live product evidence.

## 1. Design principles and visual mood

**Desert Heat — Dark Cinematic:** premium, cinematic, comfortable to work in. Use deep charcoal and warm brown-black surfaces with sandstone red environmental detail; vibrant but restrained ember orange-to-red on high-value actions; off-white headline copy; subtle elevated translucent panels; and varied, faithful movie artwork that does **not** adopt the shell's branding colors. Avoid persistent neon, orange input borders, low-contrast text, generic AI dashboard motifs, or arbitrary new controls merely to imitate artwork.

### Initial color tokens

| Role | Proposed token | Hex | Intended usage |
| --- | --- | --- | --- |
| App background | `--fl-bg` | `#0E0B0D` | viewport/root fallback |
| Sidebar/topbar | `--fl-nav` | `#191315` | stable dark navigation |
| Raised panel | `--fl-surface` | `#261A1B` | cards, inspector, forms |
| Canyon red | `--fl-canyon-red` | `#A52D1C` | backdrop/art direction |
| Warm red | `--fl-fire-red` | `#E94728` | gradient endpoint |
| CTA orange | `--fl-orange` | `#FF7A1A` | principal CTA, active states |
| Warm gold | `--fl-amber` | `#FFB15C` | rare headline highlights |
| Primary type | `--fl-text` | `#F7F3F0` | core copy |
| Muted type | `--fl-muted` | `#BAAAA7` | secondary copy, audit contrast |
| Fine border | `--fl-border` | `#59413F` | subtle dividers |

These hexes are a proposed starting palette, *not* exact sampled screenshot values or verified accessibility combinations. Calibrate the actual rendered UI at desktop and mobile sizes; semantic success, warning, destructive, disabled and focus colors must remain distinguishable from cosmetic accents. **Never apply Studio theme tokens to creator `ChannelSpec.brand`.**

## 2. Full-bleed shell and layout

- **Edge-to-edge:** App content spans 100% viewport width and at least its height. There is **no external black border/matte, floating mockup frame, centered page-width application card, or outer rounded desktop outline**. The reference image includes an outer display frame only as presentation. Internal functional gutters remain.
- **Left vertical nav:** FireLaunch identity, real project switcher, supported route navigation, clear selected state and accessible account/help controls. Starting desktop width around 240–270px; size responsively.
- **Topbar:** Persistent project/workspace title, current task/breadcrumb, truthful save/processing status, real creator account/actions. Do not invent screenshot search, notification or profile capabilities that are not implemented.
- **Central content:** Flexible primary work area. An atmospheric canyon-backed hero is appropriate for dashboard/onboarding; data-dense catalog import, upload and editing should prioritize actual forms/content rather than a permanently tall decorative hero.
- **Right inspector — contextual only (Phase 8 owner approval, 2026-10-21):** Hidden and taking **zero reserved width** by default. Open on a real selected page/shelf/tile/appearance property that has applicable editing controls; clear selection or dismiss to restore full workspace width. No fake status widgets, permanently docked empty rail or full workflow squeezed into the inspector. Preserve a discoverable 16:9 **TV Preview** toolbar action and usable Preview alongside selected Channel editing.
- **Content rows:** Work cards and recent media items in readable responsive grids/rails; sensible minimum card width, consistent gutters, overflow and scroll boundaries. Avoid fixed screenshot-width positioning.
- **Desktop through phone:** Wide layout defaults to sidebar + flexible main, with a third contextual inspector **only when a real editing selection exists**. Library, Publish and Export have spacious main workspaces; the existing Add Video modal/sheet is unchanged. Intermediate tablet can stack contextual controls or use an accessible drawer; mobile retains full-width forms and accessible upload, rights and TV Preview. Selection/dismiss and keyboard focus return must work. Adapt from actual content; historic ~1200px/~690px CSS breakpoints are inspection points, not fixed law.

## 3. Canyon background asset and layering

- Prepare a separable, optimized, owned/appropriately licensed high-quality **dark red slot-canyon** background with a narrow warm light opening. The approved **dashboard composite is not itself a deployable CSS background**, and no interface pixels, baked text or cards belong in the background asset.
- Place canyon in central workspace/hero layers behind all interaction. Use auburn/black gradient overlays; begin around **60–75% local darkening** where important text/cards overlap bright rock, then adjust according to actual contrast. Strong canyon brightness must not bury foreground copy.
- Sidebar/topbar near-opaque charcoal; elevated work cards mostly opaque or softly translucent dark warm charcoal. Fine warm neutral outlines and subtle depth shadows. Avoid excessive global glass blur or full-page GPU-heavy filters.
- Static background by default, no unrequested parallax or perpetual animation. Fallback to coherent solid dark surface if asset unavailable; honor reduced motion, bandwidth, weak devices. Optimize variants/source sizes and prevent content layout shifts.

## 4. Type, controls, elevation and rhythm

- Modern sans-serif with legible off-white titles, restrained warm highlight in hero headings, clear secondary gray metadata, small label/eyebrow hierarchy, consistent capitalization, readable field/helper/error text.
- Primary CTA uses controlled orange-to-red gradient and clear contrast; subtle glow reserved for actual high-value actions such as New Project, Upload or Approve where enabled, **not every button**.
- Secondary buttons, inputs, selects, tabs and utility actions are neutral charcoal with dim borders and softer hover/focus treatment. No permanent orange outlines around every input. Keyboard focus must still be clearly visible and distinct from hover/selection.
- Selected navigation is warm ember-filled with contained glow; inactive is neutral. Icons consistent weight, legible with labels.
- Cards: starting radius ~10–16px, 1px neutral/warm stroke, restrained shadow, aligned interior padding. Rhythm derived from 4/8px spacing, ~20–32px desktop gutters subject to actual density. Use consistent components for upload dropzones, errors, rights controls, dialogs and inspectors—not merely the homepage.
- Status chips/progress indicators must communicate real pending, upload complete, private verified, processing ready, rights denied/revoked, published and blocked states in text/icon/shape as well as color; never fabricate percentages or successful publication evidence.

## 5. Media / thumbnail independence

- Use actual **owner-authorized creator** covers/art when accessible, with rights-safe fictional or repository-owned fixtures for demos. Do not scrape unlicensed material or treat the screenshot's imaginary movies as creator catalog data.
- Preserve genre-specific color grading: blue icy science fiction, teal detective thriller, violet fantasy, natural documentary, saturated animation, etc. **Do not recolor thumbnails or gradient-wash their art into FireLaunch orange/red.**
- Keep 16:9 film tiles where appropriate, native poster/square album ratios for other content, stable `object-fit: cover` crops, consistent thumbnail height, text backdrop/overlay, accessible alt/labels, skeleton and fallback for missing artwork. Show truthful title/type/rights/status; artwork never implies TV playback rights or publication approval.

## Owner-approved Phase 8 navigation (2026-10-21; target only)

Five creator-facing primary destinations: **Home, Library, Channel, Publish, Export**. Channel subviews reuse **AI Assistant, Appearance, Pages & Shelves**. Export preserves **Advanced > Source** plus actual Build & Download. Publish is content approval and remote immutable release, not native binary/Appstore submission. The existing eight-surface navigation is historical source behavior until the new Phase 8 prompts execute. Preserve Desert Heat palette, full-bleed layout, creator artwork's independent colors, and rights/state truth.

## 6. Product alignment and strict separation

The canonical Studio surfaces today include **Catalog, Create/Agent, Design, Content, Code, Build, Publish**, and an interactive **16:9 TV Preview** with directional focus/Back/playback semantics. Reconcile the visual dashboard with those real routes. The screenshot's fictitious Templates, Analytics, Community, generic AI features, sample projects/account, percentage bars and marketing copy are **not** new requirements.

Maintain the creator-owned catalog workflow: authenticated project and scoped source permissions; reviewed imports, Collections, rights-sensitive media uploads; separately asserted TV display/playback rights; verified processing of private media; TV-safe channel generation; interactive Preview/edits; code/build handoff; creator approval of immutable public manifests. Do not change owner/CSRF/media/security state machines under a visual work ticket.

**Creator Vega outputs keep their own brand, colors, type, art, focus rules and publication data.** Studio theme is an authoring chrome, not the viewer app's default brand.

## 7. Accessibility, failure states and performance

- Measure foreground readability **over the brightest and darkest areas** of canyon and without an image. Aim for WCAG-normal text contrast >=4.5:1, large text >=3:1, and discernible focus/control boundaries, including on tinted/transparent surfaces.
- Keyboard/tab order, visible focus rings, semantic menus/dialogs/drawers, accessible error announcements, usable touch target sizes (aim >=44 CSSpx where practical), reduced motion and meaningful alternative labels are required.
- Qualify empty/zero catalog, pending upload, verification, encoding queue/failure, bad source, rights unknown/revoked, disabled publication, no access, connection loss, retry and success views. No silent/inaccessible hidden controls.
- Audit image transfer, loading behavior, layout shift, rendering responsiveness, text wrapping and Preview usability on weaker/mobile browsers.

## 8. Planned implementation and qualification

**Proposed `c6-desert-heat-studio` bounded correction**, design docs approved but **not activated**. Suggested work slices: (1) tokens/full-bleed shell/optimized separate canyon; (2) authentic dashboard/media/artwork and Catalog/Upload; (3) editor/Preview/inspector/mobile/a11y; (4) independent real-browser closeout. Do not create a version bump, deploy, paid AWS operation or fictional functionality merely by documenting direction.

Qualify via:
1. Visual side-by-side desktop/tablet/mobile browser captures against the *exact approved screenshot*, with viewport-edge shell.
2. Readable darkened canyon and separate functional solid fallback; consistent cards/type/actions.
3. Vivid *independent-color* rights-safe media fixtures, real creator art where allowed, fallback/crop testing.
4. Real auth and project switch, catalog, rights and uploaded MP4 flow, processing progress, channel Preview/edit and Publish readiness without owner isolation or data loss regressions.
5. Keyboard/touch, responsive, failure/loading/empty states, contrast and performance evidence.
6. Explicit qualification status: visual/browser closeout cannot prove AWS/MediaConvert, P5/c5 installed Vega, physical Fire TV/Appstore or prior unresolved S1-S6/P0/P4 gates.

**Historical closeouts and active hosted deployment/code remain unchanged.** This is a visual target, not evidence the new theme is live.

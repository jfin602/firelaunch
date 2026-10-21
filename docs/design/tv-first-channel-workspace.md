# TV-First Channel Workspace — Phase 8 UI Contract

**Owner-approved /docs-review, 2026-10-21; DESIGN TARGET ONLY, NOT IMPLEMENTED OR QUALIFIED.** This contract supersedes the earlier Phase 8/P8B proposal to display a narrow TV Preview beside a tall right-side page editor. Implement as [c8-ui](../tasks/c8-ui/README.md) **AFTER the already-executed local P8B work**, preserving existing Hero/Grid/Rows templates, section editing, native Vega compatibility and fullscreen behavior. The pushed GitHub `main` now confirms P8B P1–P6 at coherent root/lock `0.8.10`, followed by a committed P7 **NOT GREEN / NOT DEPLOYED** report. This correction uses unchanged `0.8.10` and must preserve its finished page editor, new static modules, rights and fullscreen logic. The staging host remained at Wave 1 `0.8.4` at the P7 dated readback, which is not the same as source. See [Desert Heat baseline](studio-visual-baseline.md) and [human-first layout design](page-layout-human-first.md).

## The immediate failure to fix

The owner screenshot shows: small television view alongside a long programming form; AI Assistant/Appearance/Pages & Shelves displayed as small unstyled buttons above; a **Close TV Preview** button even though Preview is the purpose of Channel; large scenic gaps; and document scrolling to reach controls. This is not an acceptable normal Channel default. Channel must always start with its real interactive preview. Creating/showing/hiding TV and navigating into a separate form are not prerequisites to editing.

## Canonical desktop composition

Within the existing authenticated Studio shell/sidebar/topbar:

1. **TOP:** Full-available-width **TV stage**, showing the actual interactive `Preview` at exactly **16:9**, letterboxed/centered if needed, NEVER stretched/cropped. Preview frame may scale to the largest dimensions that fit without depriving the bottom dock of usable height. No separate `Preview` copy. No `Close TV Preview`; ordinary Channel always shows it.
2. **BOTTOM, immediately adjacent:** A horizontal **editing dock** butted against the stage, with a subtle divider and **ZERO ornamental gap**. Tabs in the dock header replace the tiny unstyled page-top buttons. Only **Pages & Layout** and **Appearance** are creator-facing Channel tabs; remove **AI Assistant** and stale agent redirects from this UI, without ripping out the agent backend or changing unrelated feature contracts.
3. **HEIGHT FIRST:** Size against available **viewport height under the existing Studio topbar**. Start near 60–65% of usable height for the TV stage and 35–40% for the dock (not immutable CSS percentages); enforce practical dock min-height ~240–280px desktop, with optional controlled resize/persistence later. Fit the TV inside the stage by `min(stageWidth, stageHeight * 16/9)`. At short heights, allow **contained dock scrolling** rather than shrinking controls beyond accessibility. Whole Channel document should avoid vertical scrolling at normal desktop heights. Do not force TV at full available width if that would consume every vertical pixel.
4. **WIDTH FIRST IN DOCK:** Pages, Sections and Context Controls make horizontal use of available space. Compact labeled page buttons/list, section list/actions, selected-section properties. When no section selected, show page/template/Add Section actions or helpful guidance rather than a blank permanent inspector. Use the ALREADY IMPLEMENTED P8B Hero/Grid/Rows dialog, six section types and real page/section editor inside a compact dock. Do not downgrade the interface or invent a new editor.
5. **SCROLL:** Prefer no whole-page scroll at 1440×900 / ~1280×720 and common laptop sizes; keep each panel/form independently scrollable if genuinely long (many pages, catalog, long text). Never trap scroll/clicks inside TV navigation; do not hide Save, Add, Remove or form errors below an inaccessible fold.
6. **VISUAL:** Dark restrained Desert Heat panels; media art retains its own palette; warm orange reserved for primary selected/action states. Dock tabs look like real, labeled, accessible tabs with distinct selected/focus states. Avoid decorative empty black rails, permanent orange outlines and unnecessary text-form chrome.

### Bottom dock tabs

- **Pages & Layout** (formerly Pages & Shelves): navigable pages, sections, page creation and creator-friendly editing controls. Existing `Content` and `ChannelSpec` mutations and ALREADY IMPLEMENTED P8B Hero/Grid/Rows templates and six bounded sections must remain reachable; no parallel renderer.
- **Appearance:** channel title, brand, image, color and typography controls, grouped horizontally with truthful save/dirty state. Reuse existing `Design` and approved contextual inspector semantics; do not render an additional side rail that compresses the preview.
- **AI Assistant:** REMOVE the creator-facing tab and shortcuts that would open it. Replace any current "AI Assistant" navigation fallbacks with Pages & Layout or an actual supported Library action. Retain backend/provider code unless separate authority requests decommissioning.

### Standard vs fullscreen interaction

**Standard Channel mode**: preview on top, dock always below, one **Full Screen** toggle near the stage heading. No close/show Preview toggle. Clicking/interacting with TV behaves as TV, **not** section selection; edit a section in the dock to avoid accidental play/navigation.

**True fullscreen app view**: enter browser Fullscreen API through a deliberate gesture on an element encompassing **both TV Preview and its editing overlay**, so the dock remains renderable over fullscreen content. TV fills the available viewport at valid ratio with safe letterboxing and no Studio sidebar/topbar. The dock becomes an overlay that **slides upward from the bottom** when mouse/pointer enters a roughly 32–40px bottom activation edge; remains visible while hovered, while keyboard focus or edit/unsaved input is present, and hides after a short nonintrusive delay when idle. Overlay should not permanently steal TV vertical space or reset TV state. Its tabs and forms are the **same dock instance/content**, not a second React editor with stale draft state.

**Touch + keyboard:** no hover dependence. Touch handle / edge swipe / explicit visible reveal; keyboard reachable dock control/shortcut and visible focus. Escape exits browser fullscreen, while TV Back is a separately labeled virtual-remote action or Backspace with documented exceptions, using `fullscreenchange` to restore focus. When a form has focus, key presses edit the form, not control the TV. Respect reduced motion and avoid focus trap.

**Fallback:** On Fullscreen API rejection/absence, show an accessible viewport-filling overlay with the same TV + edge-reveal dock, truthful fullscreen status and normal exit. Preserve selected page, `TvState`, playback, focus, scroll, ongoing unsaved edits across enter/exit; no remount of `Preview` or duplicate player. Restore focus to Full Screen toggle on exit. Resize/orientation changes may reflow safely.

### Responsive behavior

- Wide desktop: TV stage + 3-column horizontal dock.
- Tablet/narrow desktop: TV scales down, dock uses compact columns or inner tab switching. Stay readable; don't cram three tiny controls.
- Phone: TV remains 16:9; dock becomes a usable bottom sheet or focused dock subpanel with independently scrollable content and touch access. The TV must stay visible when reasonable; no forced tall desktop split, accidental cropping, permanent bottom overlay that blocks video or inaccessible actions.

## Source integration / ordering

The **older Wave 1 screenshot/source** used `apps/studio/src/App.tsx` `ChannelView = 'AI Assistant' | 'Appearance' | 'Pages & Shelves'`, conditional `Preview` and `.channel-preview-split`. **P8B has now been pushed to GitHub main at 0.8.10**. Source inspection confirms an already implemented Pages & Layout editor with selected-only layout inspector, template creation and fullscreen native/fallback; Channel STILL defaults to AI, conditional Preview and split layout. Adapt these existing components rather than the old baseline. The correction adapts the actual completed P8B Channel shell into a TV-first stage+dock **without replacing existing Page Layout, templates, module/rights logic, full-screen functionality or Vega parity**.

**Execution order is P8B already ran → c8-ui correction.** Preserve P8B P1–P6 runner commits and P7 evidence (if any). Do not modify or rerun P8B prompts. Check actual local HEAD/version/dirty work; if the completed P8B source is at `0.8.10`, use c8-ui's unchanged `0.8.10` runner. P8B P7 did not apply 0.8.11. The committed source version is 0.8.10; if additional local edits/version changes exist, reconcile safely before starting rather than changing historical implementation.

The correction must retain P8B templates, static image/text sections, page saving, rendering, native compatibility and fullscreen state while replacing the surrounding presentation with **top TV + bottom horizontal dock**. Existing fullscreen code is a repair seam, not a greenfield request. After completion, independently qualify c8-ui; do not confuse UI acceptance with the still-open P8B P7 signed-in candidate/native-layout evidence. Deploy only through existing authorized staging rollout with exact source hash. No version reordering or baseline downgrade.

## Acceptance / fail-closed conditions

- Default Channel opens with **visible, working TV**, 16:9, and full-width bottom dock; no Close TV Preview, no user-facing AI Assistant, no tiny floating top tabs.
- Desktop short and tall viewports: usable dock, clear Save/Add/Select, no avoidable whole-document scroll; large lists can scroll inside bounded regions.
- TV focus, D-pad, playback, rights and private draft distinction unchanged; no second Preview instance or scrolling interception.
- Fullscreen: true browser mode or truthful accessible fallback, TV + dock one fullscreen surface; bottom hover/reveal with mouse, touch and keyboard access; overlays stay visible on active edit; Exit distinct from TV Back.
- Unselected page/section doesn't create empty permanent side inspector; selection edits persist and focus/dirty warnings remain intact.
- Release tests cover real signed-in Desktop Channel and a short tablet/phone spot check; no cosmetic test passes without functional evidence. No new public publication, native worker build, AWS action, schema or version transition in correction. Wave 2 and overall Phase 8 remain OPEN.

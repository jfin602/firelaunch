# P9-005 — Compact Channel layout editor, icon controls and animated drag reorder

**Phase:** 9 — MVP Polish  
**Priority:** P1 / deadline-required editor usability  
**Status:** Reported; implementation not started  
**Reported:** 2026-10-22 12:52 UTC  
**Surface:** Creator Studio > **Channel** > **Pages & Layout**, left secondary editor rail; selected page's ordered section cards and add-section controls  
**Evidence:** User-provided screenshot in Phase 9 issue-collection conversation (2026-10-22): left global sidebar; page list of **Featured / Series / Home / Movies / New page**; selected **Featured** page; **Draft Page Layout** header; **Edit page** button; expanded section cards **1 · Featured Hero**, **2 · Text Area**, **3 · Content Row**, each with bordered **Edit section**, **Move up**, **Move down**, **Remove section** controls; interactive Vega Preview on right. Screenshot retained in conversation, not committed to repository.

## Owner report

> "Theres a few issues with the current editor panel. first off, the page layout section buttons could be replaced with simple icons, without button borders. This would make it all alot cleaner and tighter. we should also allow drag and drop repositioning with a nice lift up and dynamically updating placement animation. this should be confirmed clean.
>
> Next issue, the New Page button needs to look differently than the page buttons so it stands out. currently its hard to see.
>
> Remove the edit page button, and move the add section form to the top. The add section form should be much more condensed and also stylized like our chosen desert heat style. It needs to save space so we can fit as many layout cards on screen as possible without being unusably crampt"

## Observed problems and target

### A. Bloated repeated section controls

Every section card spends a full horizontal row on outlined **Move up / Move down / Remove section** buttons, plus a large **Edit section** button on the header. This reduces how many section cards are visible and makes the narrow editor rail crowded.

**Expected:** Replace these actions with **compact recognizable icon-only controls** (e.g., pencil, arrows/drag handle, trash), **without persistent button borders or heavyweight boxes**. Keep muted neutral styling by default, restrained orange for selected/action emphasis, and muted danger treatment only on removal. Show helpful hover tooltips, meaningful accessible labels and visible keyboard focus. Maintain usable pointer/touch targets even when the icons are visually small. Avoid turning all actions into orange affordances. The existing Edit Section capability still needs to be discoverable and functional.

### B. Section drag-and-drop, with high-quality animation

Currently section ordering appears dependent on repeated Move up/down clicks.

**Expected:** Each **section card** is reorderable by pointer drag-and-drop within the selected page. Use an intentional grab handle / obvious reorder affordance to avoid interfering with text selection, editing and vertical scroll.

Drag experience:
1. On lift/grab, the selected card raises slightly with subtle elevation and a clear active state.
2. While dragging, nearby cards **smoothly and dynamically move to show the prospective insertion position**, with a stable placeholder or drop indicator; don't merely teleport items after release.
3. On drop, animate the card into its final slot, persist the **actual section order** in the existing page layout model, and immediately update the interactive Vega preview to match.
4. On cancel, Escape, invalid drop or persistence failure, restore the source order with clear recoverable feedback; never lose content or silently save a different order.
5. Respect reduced-motion preferences (a clear functional reorder without decorative animation), constrain work to the selected page and preserve sections' IDs, data and settings.
6. Keep a keyboard-accessible alternative for reorder (compact icon actions, accessible move commands or an equivalent keyboard pattern). Drag is an **additional interaction**, not the only way to reorder.
7. Verify touch/pointer interaction, scroll behavior in the narrow rail, correct drop indices at beginning/middle/end, and no accidental drag when clicking edit/remove.

**Scope interpretation:** This request is for rearranging **section cards within a page**, not necessarily reordering pages across the top of the Vega app. Do not silently broaden to page reordering.

### C. Distinct New Page action

In the screenshot, **New page** looks like another selectable page item, so creators can overlook it.

**Expected:** Visually separate it from existing pages: a compact **+ New Page** action with a distinct neutral/secondary affordance, spacing or placement clearly signaling *create* rather than *select*. An intentional orange plus/accent may be appropriate, but don't use a large competing orange card or reduce discoverability. Keep page-selection items visually consistent with one another and maintain accessible focus.

### D. Remove Edit Page button

The selected page's **Draft Page Layout** header currently includes an **Edit page** button that adds an unnecessary step/visual burden.

**Expected:** Remove that standalone button from the normal layout. Preserve genuinely needed page editing (such as name/details) through a direct contextual control, inline edit or selected-page affordance if that capability currently relies on the button; avoid leaving functionality unreachable or changing the page schema. This is **not** an instruction to delete page-edit data or APIs.

### E. Move and compact Add Section

The **Add Section** form currently sits lower in the page editor, requiring creators to scroll past existing sections and taking more space than necessary.

**Expected:** Move **Add Section** to the **top of the selected page's layout section**, directly before the ordered section cards (after the compact page heading/context). Redesign it as a small Desert Heat–styled creation control rather than a large multi-row form:

- A compact section-type picker with clear options, and an **Add** primary affordance, or a similarly small inline/expand-on-demand treatment.
- Preserve all supported section types and their existing creation defaults.
- Use the existing dark/charcoal neutral panels, subtle dividers, warm orange accent only on primary action, consistent radii, legible labels; don't introduce a white native-looking control or orange borders everywhere.
- Keep the selected page and insertion semantics explicit: creating a section adds to that page and its cards/preview update immediately.
- Minimize persistent vertical chrome so **more real section cards fit on screen** without clipping names, media previews, focus rings, action hit areas or form labels.

## Overall layout quality target

The narrow left editor rail should read as:
**Pages list** -> **distinct + New Page** -> **selected page title/context** -> **compact Add Section** -> **dense but legible ordered section cards with subtle icon actions and drag handles**.

No full editor redesign or change to the existing right-hand interactive TV component. The app should feel noticeably calmer, more scannable and space-efficient.

## Acceptance tests

1. All existing pages remain selectable. **+ New Page** is visually and semantically distinct from them and creates/selects a page correctly.
2. The standalone **Edit page** button is absent; any essential page title/settings editing remains accessible.
3. **Add Section** appears above the section list. User can add every supported section type to the selected page without scrolling to the bottom of a long list; new section appears in the list and interactive TV preview.
4. Repeated outlined **Edit section / Move up / Move down / Remove section** button rows have been replaced by a minimal, visually borderless icon/action treatment. Each action works, with label/tooltips, keyboard focus and touch-sized hit target. Removing remains safe (confirm/undo as existing contract requires).
5. Pointer drag reorders at least first->last, last->first and middle->middle, showing **lift, shifting neighboring cards and settled drop animation**; layout persistently matches new order after refresh and reopen.
6. Cancel drag (Escape or invalid drop) leaves section order unchanged; server/save failure restores or clearly flags unsaved order; keyboard-based reorder works without drag.
7. Same-page and other-page section data stay intact; selecting a different page while a drag was in progress cannot cross-contaminate ordering.
8. Interactive Vega preview updates to the new section order and reflects the same saved ordering across refresh, fullscreen and newly exported layouts where supported.
9. Run an **authenticated staging Codex-browser visual acceptance** on at least desktop + narrower viewport, verifying no rail scroll hijack, missing buttons, overflow, layout shift or impossible hit targets. Check reduced-motion mode and basic touch emulation. Evidence should include visual before/after plus tests; never claim clean merely from compiling.
10. Existing left rail / right borderless 16:9 interactive Preview, fullscreen/Clean View controls, TV remote, rights and protected export workflows still work.

## Boundaries / implementation notes

- Reuse actual final P8C editor/source and saved layout state; **P8C P3** already has editor usability/navigation scope and may overlap. Reconcile first and avoid editing during ongoing Phase 8 work.
- Keep focused implementation: one clean compact rail and deterministic layout reorder, no new giant design system, TV renderer rewrite, page-type expansion, schema migration or new public publishing pipeline.
- Avoid premature assumption about drag library; inspect current components and choose the smallest robust accessible approach that fits current tech.
- Preserve existing stable section IDs, settings, ownership/permission and save conflict behavior.
- Do not equate a visually reordered draft with a deployed live Fire TV change. Reuse prior native export parity checks only if the underlying serialized layout contract remains compatible.
- Documentation-only intake. **No code change, staging deployment, version change or qualification** has been performed by this issue record.

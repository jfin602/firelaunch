# P9-007 — Standardize every Studio popup on the New Page dialog design

**Phase:** 9 — MVP Polish  
**Priority:** P1 / required global visual consistency  
**Status:** Reported; implementation not started  
**Reported:** 2026-10-22 13:07 UTC  
**Surface:** ALL user-facing Creator Studio modal dialogs/popups, especially every media creation/editing flow and all uploads  
**Evidence:** Owner-provided screenshot in the 2026-10-22 Phase 9 collection conversation showing **Channel > New Page > "Create a page"** dialog over dimmed Channel editor and TV Preview. It is the **visual target**, not evidence that other dialogs already match. Screenshot remains in the conversation; no binary is committed to this docs branch.

## Owner report (verbatim)

> "the new page popup style is our target popup style. every other popup in the entire app should look like this. and even have similar graphics when appropriate. this should apply to every media workflow and every upload workflow"

This is a **cross-application visual and interaction standard**, not only a request to change one page. Existing popups, especially media/upload flows, currently present inconsistent layouts, sizing, control styling and/or insufficient visual explanations. The creator should experience one coherent Desert Heat interface throughout the app.

## Approved visual reference: "Create a page" screenshot

The owner explicitly designates this exact currently deployed popup as the baseline. Preserve its distinguishing traits:

- **Centered dark charcoal dialog** of comfortable medium/wide width, slightly rounded corners, subtle neutral-gray border, generous but disciplined internal spacing; clearly separated from the background.
- **Uniform dim/scrim overlay** over the Studio and Channel Preview. Modal stays readable and foregrounded without harsh glow, glossy effects, excessive orange outlines or distracting backgrounds.
- **Strong white heading** (screenshot: "Create a page") with a **single concise muted-gray helper line** beneath it. Avoid long paragraphs of technical explanations or rights/status caveats.
- **Clear labeled form inputs** with restrained dark almost-black surfaces and fine neutral outlines. Field focus/validation is legible without heavy bright-orange borders.
- **Graphical option cards where useful:** the screenshot's Hero / Grid / Rows choices each have a schematic illustration above a short bold name and one-line description. Selected option uses a **restrained warm orange outline / faint warm-tinted surface**; unselected options are charcoal with neutral borders. Graphics should actually explain the choice, not be generic decorations.
- **Bottom-aligned compact actions:** quiet dark Cancel and a clearly prominent **orange Create page** primary action. Primary/secondary hierarchy is consistent.
- **Deliberate typography hierarchy and alignment**, using existing Desert Heat fonts and warm palette, consistent radio/select affordances, modest spacing, and accessible hit areas.
- Reference shape: dialog visually occupies a reasonable part of a desktop screen and does **not** force fullscreen; adapt width and layout naturally to media forms and narrow screens instead of hard-coding the captured screenshot's pixels.

## Scope: every modal and popup in Studio

Audit the current popup/dialog entry points across **Home, Library, Channel (Pages & Layout and Appearance), Export and supported Publish-adjacent surfaces**. Consolidate their visual language onto this design. Priority implementation coverage:

1. **Every supported media workflow** — Add Video, edit/review video, media selection, supported metadata and any other currently working media forms. The term "every" means all modal steps belonging to those workflows, not only the initial dialog.
2. **Every upload workflow** — video upload, poster/thumbnail/artwork upload, channel logo, app background, page section images (the latter introduced by P9-006). Upload picker/dialog states, progress, error, retry and confirmation should all use the same shell/layout/visual treatment.
3. **Page creation and editing** — keep the existing New Page popup as the visual baseline; do not regress its graphics, selected style or information density.
4. **Other dialogs** — confirmations, media/collection management and any currently retained actual MVP modal flows should match in header/body/footer, spacing, controls and overlay. Small simple confirmations can use a proportionally smaller variant instead of stretching to a giant full form.
5. **Menus, tooltips and nonmodal anchored popovers** should be harmonized where appropriate **without** incorrectly turning them all into centered modal dialogs. Fullscreen TV controls/remote must not be trapped beneath an unrelated modal.

### Illustrations and graphical choices

- Where a dialog asks the creator to select between **visually meaningful alternatives**, present compact **illustrated choice cards analogous to the New Page Hero/Grid/Rows diagram cards** when feasible.
- Examples: choosing upload/media type (only genuinely supported types), choosing a section image placement or appearance treatment, selecting a media display/collection pattern. Keep each label short and make the illustrated geometry reasonably representative of the actual result.
- Do **not** require graphics on ordinary text fields, simple yes/no confirmations, file progress or errors. A static screenshot of a graphic is not a required implementation; SVG/CSS schematic thumbnails are acceptable if crisp and consistent.
- Never display attractive clickable media types or actions that aren't actually functional in the MVP. For deferred feature mentions, apply the Phase 9 rule to hide rather than tease or fake them.

## Reuse and functional safety

- Prefer a **shared modal shell and a small reusable option-card pattern**, with variants for simple confirmation, form, and media/upload flows. Reuse existing project components if suitable; avoid converting every dialog to wholly new bespoke markup or introducing a heavyweight UI library solely for this.
- Preserve the **actual workflow behavior** for every modal: upload/file selection, metadata edits, status/progress, validation, permission, cancel, retry, save, navigation and persistence. This is a visual/interaction refinement, not a replacement of the underlying upload/rights pipeline.
- Real asynchronous states must remain visible and unambiguous: Uploading, Processing, Saved/Complete, Failed/retry. Don't delete necessary feedback in the name of cleanliness.
- Preserve P9-004 **one-time media rights attestation** in its right place. Do not import every old repeat-rights warning into the restyled dialogues.
- The new image-upload modal introduced by P9-006 should **follow this standard from the start**, rather than styling first and restyling again.
- The compact Add Section UI from P9-005 may be inline, while any modal it opens follows the same style. Do not make every tiny interaction trigger a modal.
- Do not replace the New Page modal with a visibly different generic style as a side effect of building a shared component. Treat owner-provided New Page screenshot as the regression baseline.

## Responsive, accessibility and quality requirements

- Desktop: dialog remains visually centered over a consistent scrim, with legible information hierarchy and no surprise layout jump.
- Narrow/mobile: cards wrap/stack, footer actions remain reachable, dialog fits the viewport with internal scrolling only if content requires it, without giant horizontal overflow or clipping.
- Full keyboard focus management and correct modal semantics (`role=dialog`, title/description associations, focus trap for real modals, Escape/cancel with unsaved-change safety, focus returned to initiating control). Click-outside behavior should respect destructive/unsaved state; no accidental data loss.
- Provide obvious focus states and control labels, contrast adequate for dark mode and reasonable touch targets even with compact visual treatment; respect reduced-motion settings.
- Dialog open/close animation can be subtle and consistent; never require elaborate transitions or slow operations.
- Normal browser and Channel TV input must resume when modal closes; modal traps must not hijack keyboard TV navigation after dismiss.
- Keep identity consistent with broader Desert Heat (charcoal overlays and warm/orange CTA), while avoiding excessive orange borders and bright utility buttons.

## Acceptance matrix

1. Open **New Page** and capture it as a visual comparison reference; confirm its original schematic choices, labels, selected state and footer are unchanged except intentional shared fixes.
2. Open every **currently supported Add/Edit Media** and **Upload** popup from the owner-authenticated hosted Studio. The dialog structure, visual hierarchy, inputs, actions and overlay visibly match the baseline; choice cards have meaningful diagrams wherever a visual choice actually benefits.
3. Test **P9-006 logo/background/section image upload popup** in the same design and ensure upload progress, errors, retry and Save/Cancel remain functional.
4. Exercise remaining MVP dialogs (e.g., collections/confirmations) and record a short audit checklist of each modal name, whether migrated, and any explicitly excluded nonmodal component.
5. Test at desktop and at least one narrow viewport; no clipped text, offscreen buttons, disjoint overlay, distorted illustrations or permanently blocked scrolling.
6. Test keyboard Tab/Shift+Tab, Escape, Cancel, save/reopen, focus restoration and TV remote interaction after modal closes.
7. Verify media upload/playback readiness, channel editing, one-time rights confirmation, image/metadata persistence and protected export show **no regressions**.
8. Require authenticated **Codex-browser staging screenshots and direct visual comparison**, not typecheck alone, for qualifying the shared design.

## Dependencies / implementation notes

- **P9-006**: formal image-upload dialogs should use the P9-007 shared modal from their first implementation.
- **P9-005**: consistent compact styling of section editor; preserve the New Page visual reference.
- **P9-004**: simplify repeated rights UX before or alongside standardizing media dialogs, not afterward.
- **P9-003**: Add Media should use supported Library workflows and their new consistent dialogs.
- Coordinate with Phase 8 P8C's ongoing creator/editor UI changes; implement only after checking actual final source and accepted staging state to avoid stomping active work.
- Do not expand the deadline MVP to implement unsupported audio/books solely to demonstrate modal choices.
- **Documentation-only report**: not fixed, deployed or qualified as of capture.

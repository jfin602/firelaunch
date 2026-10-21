# Channel Secondary Editor Rail — c8-ui2 Visual and Interaction Contract

**Owner-approved review 2026-10-21; target only, not yet implemented.** This supersedes the former [TV-first bottom dock design](tv-first-channel-workspace.md) for the Channel workspace, without rewriting that correction's historical qualification. Reference: owner-approved mockup after the 2026-10-21 Channel screenshot; use existing [Desert Heat](studio-visual-baseline.md), [human-first page layout](page-layout-human-first.md) and actual working [c8-ui closeout](../tasks/c8-ui/closeout.md). New [c8-ui2](../tasks/c8-ui2/README.md) repairs presentation, not ChannelSpec, native output, publication, video or permissions.

## Standard Channel: primary sidebar + secondary editor rail + right TV preview

Preserve the existing FireLaunch persistent global sidebar at the far left and the Studio topbar. The **secondary Channel editor is a fixed adjacent LEFT RAIL** that begins immediately at the global sidebar's right edge and extends to roughly the center of the remaining screen. The remaining RIGHT column is the one interactive 16:9 TV Preview. **No bottom editing dock.**

- Left secondary panel: exactly two styled tabs, **Pages & Layout** and **Appearance**, at its top. Below: page list, Add page, selected page/section controls, Add section, Edit page/section, and all saved/unsaved feedback. It is vertically scrollable **within its own bounds** if content is long, not a whole-page scroll. Preserve existing Hero/Grid/Rows dialog, Image Banner/Image + Text, selected-context inspector and page/section mutations. The inspector appears **inside the secondary rail**, not as another column cutting into TV width. When no selection, the rail remains useful with page/section choices.
- Right preview workspace: the SAME actual TV Preview, undistorted aspect ratio **16:9**, scaled to the available right-column width/height (fit/letterbox; no crop/stretch), with the **View full screen** action near the upper right. The extra space BELOW the TV is reserved for the existing **Virtual remote**, anchored comfortably at the lower right. It is not floating over TV content. A compact draft/interactive label remains clearly visible.
- Desktop sizing: editor rail approximately 36–43% of workspace width (not the whole browser, since the primary sidebar remains); TV column gets the remainder. Use safe min/max widths and allow controlled CSS grid fractions to maintain readable tools and a meaningful TV. At ~1280px browser width or smaller desktops, prioritize minimum comfortable editor content and a fitted 16:9 preview, not a fixed 50/50 split that produces a tiny TV. Test ~1440×900 and ~1280×720. Do not invent absolute pixel coordinates or over-resize the editor.
- Responsive: at tablet sizes, adapt secondary rail/preview arrangement without unreadable skinny forms (e.g. collapsible editor rail or one-at-a-time switch); on phones, a reachable editor sheet/drawer with 16:9 preview and working remote. Respect keyboard, reduced motion and scroll containment.

## Visual controls: match the existing Studio rather than default browser buttons

The current UI has large styled surfaces but some **white or unstyled browser-default controls**. All visible Channel controls must use the existing Desert Heat tokenized button primitives:
- Neutral secondary actions: dark/charcoal, subtle warm border, consistent radius/height/type, obvious hover/focus/disabled, never plain white default HTML button.
- Primary action and active tabs: limited warm orange/sandstone emphasis, not orange on every action.
- Destructive controls: restrained warning/destructive styling with explicit label; cannot be confused with ordinary neutral actions.
- Shared hierarchy: Tabs, New page, Edit page, Edit section, Move up/down, Add section, Remove section, Full screen, editor Close/Back and virtual remote are visually coherent. Buttons are correctly labeled, minimum useful touch target where feasible, keyboard-focus-visible, accessible contrast, and focus does not rely on color alone.
- Do **not** modify creator-owned artwork colors, ChannelSpec.brand, media thumbnails or the native TV app theme to match the Studio shell. Avoid blanket CSS selectors that recolor published TV Preview buttons or unrelated dialogs/Export.

## Fullscreen: left-edge editor overlay, not bottom edge

Entering fullscreen uses the existing P8B/c8-ui `previewFullscreen` API/fallback, single Preview instance, current page/focus/playback and SAME editor component. The fullscreen root includes TV + editor rail, but the rail is overlaid **from the LEFT** rather than occupying fixed normal-mode width.

- Closed: fullscreen TV is the immersive focus, with only a slim accessible left-edge reveal handle; no permanent full-width bottom dock.
- Reveal: desktop pointer enters ~32–40px LEFT activation strip, or clicks the handle. Overlay slides right from left, over TV stage; modest shadow/translucent charcoal and restrained animation. It stays open while hovered/focused, during unsaved edits or modal/picker interaction; only hides on safe idle. Leaving the rail does not instantly discard drafts.
- Accessibility: touch tap/swipe from the left/handle and keyboard-accessible labeled toggle or shortcut (reuse existing Alt+E where practical), without hover dependence. Escape exits fullscreen; TV Back remains a separate virtual remote/Backspace action outside editable inputs. Focus returns to Full screen trigger when exiting. Reduced-motion disables animation.
- Preserve mount/state: no duplicate editor/Preview, no remounting form and losing unsaved edits, no resetting TV navigation/video when changing modes. Browser fullscreen parent must contain the overlay (browser top-layer rule). Fallback modal/inert handling must leave the overlay controls interactive.
- Virtual remote: in normal mode beneath the TV in lower right dead space. In fullscreen it may be a compact floating controller on the right, separated from the left overlay and not covering important video, with full accessible Back/D-pad functions.

## Functional acceptance

1. No horizontal bottom editing dock in normal Channel. Global sidebar → secondary editor rail → right 16:9 TV with lower-right virtual remote. Sidebar and topbar remain normal Studio navigation.
2. All editor controls share Desert Heat styling. No plain white browser-default buttons, broken keyboard focus or unreadable disabled actions.
3. Pages & Layout, Appearance, Hero/Grid/Rows creation, static image/text section editing, safe publication warnings, save/error status and page selection remain functional.
4. True browser fullscreen when available or truthful fallback; **left-side editor overlay** appears via edge hover, touch and keyboard, remains open during editing, restores state on exit; bottom reveal behavior is removed.
5. No duplicate TV/editor, rights changes, native Vega changes, public publication or schema changes.
6. Real desktop and tablet/phone visual checks, honest staged browser evidence and protected rollback if deployed.

**Version policy:** Owner approved this as a new correction `c8-ui2` after `c8-ui`. The latest evidenced root and both top-level lock fields are `0.8.10`. No automatic version bump, no phase closeout, no rerunning prior correction/P8B stacks.

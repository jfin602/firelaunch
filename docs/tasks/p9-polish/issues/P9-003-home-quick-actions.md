# P9-003 — Correct Home quick actions: Edit Channel, Add Media, View Fullscreen

**Phase:** 9 — MVP Polish  
**Priority:** P1 / required usability  
**Status:** Reported; implementation not started  
**Reported:** 2026-10-22 12:29 UTC  
**Surface:** Hosted Creator Studio > Home > upper-right **Quick actions** panel  
**Evidence:** Owner-provided 2026-10-22 Home screenshot showing current selected channel, Desert Heat backdrop and **Quick actions** (orange Add Video first; dark Edit channel second; dark TV Preview third). Screenshot retained in the issue-collection conversation, not copied into repository.

## Observed problem

On the channel Home dashboard, the top-right **Quick actions** panel currently presents:

1. **Add Video** — bright orange primary CTA.
2. **Edit channel** — secondary button.
3. **TV Preview** — secondary button.

This overemphasizes just video uploading rather than core channel creation/editing, and sends users toward a video-specific path instead of the Library's broader media workflows. **TV Preview** is also ambiguous: it suggests an intermediate preview page instead of opening the actual Vega app in fullscreen.

## Owner-approved layout and exact behavior

Keep the existing Quick actions panel in the same Home position, but use this **ordered three-button layout**:

| Position | Exact label | Emphasis | Click behavior |
| --- | --- | --- | --- |
| **1 (top)** | **Edit Channel** | **Orange primary CTA** (current Add Video orange-button treatment) | Go directly to the **Channel Editor** for the currently selected channel. |
| **2 (middle)** | **Add Media** | Neutral secondary button | Navigate to **Library** for the currently selected channel, at its media-type selection/add workflow. The creator can select **Video**, **Audio**, or **Book** and proceed through the appropriate existing media workflow. |
| **3 (bottom)** | **View fullscreen** | Neutral secondary button | **Immediately open the current channel's actual interactive Vega app in fullscreen mode**, without an extra Channel/TV Preview screen, intermediate button or additional click. |

Button copy should match the requested labels, not the previous "Add Video", "Edit channel" or "TV Preview". **Only the first button** is orange; the others retain neutral Desert Heat styling.

### Before / after

**Before:** Orange Add Video -> Edit channel -> TV Preview; actions optimize for a single upload type and a not-necessarily-fullscreen preview.

**After:** **Orange Edit Channel** -> Add Media (Library -> Video / Audio / Book) -> View fullscreen (one-click into running interactive app).

## Behavior and integration constraints

- Resolve the **currently selected channel/project** for all three actions. Do not silently switch to another project; preserve selection across navigation and fullscreen entry.
- **Edit Channel:** open the same working Channel Editor surface used by the left-hand Channel nav; don't invent a second editor flow.
- **Add Media:** route to the existing Library, not straight to the video-upload wizard. Expose / retain the appropriate Video, Audio and Book workflows through the Library as supported; avoid inventing fake completion for not-yet-implemented media types. Keep P9-002's *private by default* upload/inclusion model consistent.
- **View fullscreen:** invoke the same **interactive Vega preview/runtime state and fullscreen feature** the Channel workspace already uses (or its supported fallback when the browser denies native fullscreen), not a static screenshot, a different app or a page that requires another click. Preserve existing navigation, selection, playback capabilities and accessible exit/recovery controls.
- Ensure a clean route from Home even if the preview component is not already mounted: initialize selected channel preview without user-visible extra steps. Surface a clear recoverable error if the app cannot open; do not silently do nothing.
- Keep the panel's general layout, spacing, responsive behavior, keyboard accessibility and visual identity intact. No new backend upload, native video pipeline, publishing or deployment behavior is authorized by this item.
- Do not confuse **View fullscreen** with Amazon app publication, a production installation or exported package.

## Acceptance criteria

1. On the Home dashboard, three buttons appear in the exact order **Edit Channel / Add Media / View fullscreen**.
2. **Edit Channel** alone is the orange primary button. The other two are neutral, with consistent focus and hover affordances.
3. Clicking **Edit Channel** opens the currently selected channel in its existing Channel Editor in one action.
4. Clicking **Add Media** lands in the channel-scoped Library where the user can choose **Video, Audio or Book** and enter the applicable media workflow, without being forced into Video.
5. Clicking **View fullscreen** from Home goes straight into the **interactive current-channel Vega app in fullscreen** with no Channel navigation or second click; users can exit safely to the previous Studio context.
6. Test after refresh and with two different selected channels to confirm the actions use the right project. Test fullscreen with keyboard/remote recovery and when the browser fullscreen API is denied.
7. No regressions in the existing Channel preview/editor, Library media state or export. No live deployment/remote publishing side effect.

## Dependencies and batching notes

- Reuse the final Phase 8 P8C Channel Editor and existing fullscreen preview implementation; avoid reimplementing the preview state as a new screen.
- Coordinate **Add Media** wording with P9-002 private video pool and per-video Publish/Remove. This issue adjusts *entry points*, not the deeper content inclusion contract.
- The screenshot is a user-provided visual reference from the issue report; **it is not stored as a binary asset in this branch**.
- Documentation-only report: **not fixed, not deployed, not qualified**.

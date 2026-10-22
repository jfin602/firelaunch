# P9-008 — No image clipping in Vega Preview; aspect-safe content artwork at any ratio

**Phase:** 9 — MVP Polish  
**Priority:** P1 / required TV presentation quality  
**Status:** Reported; implementation not started  
**Reported:** 2026-10-22 13:39 UTC  
**Surface:** Channel > interactive Vega Preview / View fullscreen; native Vega page layouts and freshly exported package  
**Evidence:** Owner screenshot `clipping.png` supplied in the Phase 9 issue-collection conversation on 2026-10-22. Screenshot is retained in the conversation, **not copied to this Git branch**. It shows a 16:9-ish full-screen Vega feature/detail view for **“1893 Chicago’s Columbian Exposition”**: a large artwork panel on the left and metadata/play button on the right. Text embedded in the image is visibly truncated against the **left side of the image container**; the app's layout otherwise remains split with large margins and a bottom-right virtual remote.

## Owner report

> "Image clipping in the preview page. we need to be more supportive of non 16:9 images without breaking page layouts. clipping should not happen"

This is distinct from adding image-upload controls in P9-006. Existing foreground artwork must not be arbitrarily cropped simply to force it into a fixed 16:9 or card-sized frame. Important information, titles and logos may be part of an image and can be lost when `cover`-style scaling is used.

## Core rendering rule: foreground content artwork must remain whole

- **Do not crop or stretch informational/media artwork by default** in the actual Vega app, its interactive Studio Preview, fullscreen and exported/native runtime. This includes the **featured/hero artwork in the screenshot**, detail-screen poster/art, video thumbnails and page **image sections** where the image itself is content rather than a decorative background.
- Use **aspect-preserving `contain` fitting** or equivalent native-image layout when the full image is meant to be visible. Keep intrinsic aspect ratio. Center the image in a well-bounded visual region. Unused space is intentional and may be filled with a subtle matched dark surface, blur-free neutral backdrop or similar restrained treatment; never stretch to eliminate the space.
- **Do not assume all source images are 16:9**. Accommodate portrait, square, 4:3, ultra-wide and common widescreen landscape images with a consistent bounded visual system.
- Keep **TV/page composition stable**: artwork fits within its allotted panel/section while adjacent title/description/action remain readable and correctly positioned. Do **not** expand an image until it pushes the play button or the row below the bottom of the native TV viewport. Do not introduce overflow scroll or layout jumps merely to expose a full image.
- Make the containing frame responsive to the TV layout (image max inline size/height, safe margins, natural constraints) without tying the entire split screen or page height to the source aspect ratio.
- Preserve focus navigation, keyboard/remote interactions and media activation; correcting image fit should not place transparent overlays over Play or reorder TV focus.

## Scope distinctions; reconcile with P9-006 rather than applying one global fit rule

| Usage | Expected fit | Why |
| --- | --- | --- |
| **Featured, detail, poster, thumbnail, informational image/section artwork** | **Contain by default; no cropping** | Full source image, including embedded text/art, must be visible |
| **Channel logo** | **Contain; no cropping** | Branding must remain legible and uncut |
| **Decorative app background** | **Cover (aspect-preserving, crop allowed)** | Fills entire TV canvas and supersedes color per P9-006 |
| **Explicit future creator-selected decorative crop treatment** | Only when clearly chosen and previewable | Do not silently introduce cropping for existing content |

**P9-006 initially allowed cover for decorative Image Banners. P9-008 clarifies the MVP default:** if an image banner is content-bearing, show the **whole** image; default to no crop unless a specifically supported, deliberate decorative background mode is chosen. This resolves the apparent overlap without changing P9-006's *app background* cover requirement.

## Investigation and implementation notes

1. Inspect the actual saved art's dimensions, art role, CSS/native layout bounds, object-fit/image resize mode and any clipping/overflow rules. **Verify cause** before patching; the screenshot shows clipping but does not establish whether it happens in a CSS layer, an upstream thumbnail transform or in the source image itself. If the **source asset is already cropped**, show useful asset metadata or replacement guidance; a CSS fit change cannot restore missing pixels.
2. Keep the existing split hero/detail layout; change the image frame/fit behavior locally and use reusable fit rules for other foreground image placements. Do not globally override `object-fit: cover` for intentional decorative TV backgrounds.
3. Where the same image appears in a small content tile versus a full feature/detail surface, use appropriately bounded full-art display and verify title card text/readability. The whole image must be visible without microscopic rendering or awkward card height explosions.
4. Ensure Vega Preview and native/export renderer use equivalent semantics. Native Image resize mode and browser `object-fit` are not identical by default; test both.
5. Existing uploaded art and future uploads from P9-006 must use the same explicit fit behavior; do not fix only the sample image or only a browser stylesheet.
6. Preserve branding, colors, saved layout data, rights, ownership, HLS playback and previously protected deployed releases. No live app updates are authorized.

## Acceptance checklist

1. Reproduce the owner-reported **1893 Chicago’s Columbian Exposition** screenshot case using the original actual art; confirm its title/image edges are **entirely visible** in the featured/detail pane, not truncated at the left boundary.
2. Test **portrait (e.g. 2:3), square (1:1), 4:3, 16:9 and ultra-wide (e.g. 21:9)** assets in hero/featured and an applicable section or card. The content-art image is not cropped or stretched for any of them.
3. Inspect at typical 16:9 fullscreen TV resolutions and normal embedded Preview widths. The play button, text column, navigation and surrounding sections remain comfortably within the TV canvas; no new viewport scrollbars or horizontal overflow.
4. Verify unused space around narrower/taller artwork is handled intentionally (dark/neutral fill or matched background), not as white bars or arbitrary distortions. Transparent assets render sensibly.
5. Keep **background images** filling the screen through aspect-safe cover and **logos** wholly visible via contain, proving content fitting has not regressed P9-006.
6. Confirm current and adjacent featured/detail pages, content rows/grids and page image sections do not regress. Keyboard/virtual remote selection, Back, play/pause and full-screen exit still work.
7. Compare same selected channel/art across normal Studio Preview, fullscreen and a **newly exported actual Vega package/VirtualDevice**. If native device testing is unavailable, mark native parity explicitly unqualified—not GREEN by browser-only appearance.
8. Require real authenticated staged Codex-browser screenshots comparing before/after with multiple source ratios, plus focused rendering/layout tests. Save exact tested version/source and deployment evidence during implementation.
9. Reopen the channel after refresh and confirm saved image references/layouts still work; do not require reupload of assets to avoid clipping.

## Related issues / batching

- **P9-006:** image-upload and app-branding rules. Reuse fit semantics here but maintain decorative background cover as a separate exception.
- **P9-005:** editor/section layout cards; don't regress compact editor while changing TV image frames.
- **P9-002:** channel-included video should appear with correct art aspect ratio while preserving playback readiness/eligibility.
- **Phase 8 P8C:** potentially overlaps artwork sizing/native parity. Reconcile with **actual completed** P8C implementation before editing.
- This is a **presentation/preview/export parity fix**, not a media transcoding change, image editor feature or global TV renderer rewrite.

**Documentation-only intake:** no product code changed, no staging deployment, no version bump, no qualification from writing this file.

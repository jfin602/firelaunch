# P9-006 — Native image upload for channel logo, app background and image sections

**Phase:** 9 — MVP Polish  
**Priority:** P1 / required creator workflow  
**Status:** Reported; implementation not started  
**Reported:** 2026-10-22 13:00 UTC  
**Surface:** Channel > Appearance / app branding (logo and background), Pages & Layout > image-based section editing; interactive Vega Preview and exported Vega application  
**Evidence:** Owner report during the 2026-10-22 Phase 9 issue collection at `https://firelaunch.jfin.dev/` (no accompanying screenshot for this issue).

## Owner report / observed problem

> "Currently theres no formal way to upload logos and background images thats for the app itself. It just asks for a url. this needs to be changed and a formal upload popup needs to be made for this. background images should resize without stretching to fill the screen. it should take the place of the color if set. the logo should take the place of the app title.
>
> the same needs to be done to the image section layout option"

Branding and image sections currently expect an image URL, rather than presenting an obvious local-file upload flow. This forces ordinary creators to host images somewhere else and paste URLs, unlike the media upload experience. It also leaves unclear what a logo/background will look like inside the actual Vega app.

## Required creator experience

### A. Formal reusable image-upload popup

- Replace URL-only entry as the default for all three contexts: **Channel Logo**, **App Background**, and **image-based page sections** (Image Banner, Image + Text, and other existing relevant section image fields).
- A clear **Upload image** (or **Choose image**) button opens a properly styled Desert Heat modal/dialog. It supports local file selection, a thumbnail preview, upload progress/status, validation errors and explicit **Use image / Save**; provide **Replace image** and **Remove image** where an image is already selected.
- Use **one shared image-upload component and asset-handling workflow**, parameterized for branding vs section, rather than three unrelated implementations. Preserve focus trapping/restoration, Escape/cancel behavior, keyboard access, screen-reader labels and small viewport usability. Cancel must not mutate the saved selection.
- Present concise recommended dimensions/aspect guidance appropriate to the selected role, but do not require users to know raw URLs or manually crop/resize their file before upload.
- Accept only genuinely supported, safely decoded static image types/formats (e.g. JPEG, PNG and WebP if supported end-to-end). Validate MIME/signature, file size, dimensions and decode errors and reject unsupported or dangerous content (e.g. unsanitized SVG/scripts) without crashing. Exact limits follow existing media pipeline/native Vega support; don't invent false compatibility.
- Persist the uploaded asset as an **owned private/restricted Studio image** (reuse the existing secure storage model where practical); save an asset reference, **not** an arbitrary client-supplied external URL, as the durable canonical link. Resolve it safely into preview/export.
- For pre-existing channels with URL-based image fields, preserve currently working images and compatible configuration until intentionally replaced; do not delete old assets or silently lose branding. The new user experience must not require a URL.

### B. App background: image replaces background color

- In **Appearance**, provide **Background image** with Upload/Replace/Remove.
- **When a background image is set, it visually takes precedence over the configured app background color.** Treat the saved background color as an intentional fallback while the image loads, if removed, or if it is unavailable.
- Image fills the actual Vega app backdrop **without distortion or stretching**. Default to aspect-preserving **cover** scaling with centered cropping / appropriate focal position across 16:9 TV resolutions and responsive previews. Never apply mismatched independent X/Y scaling.
- Verify against markedly different source ratios (square, portrait, landscape, ultra-wide), edge-to-edge background, title/foreground readability and safe overlays. Avoid unexpected white bands, tiling, letterboxing or body-level Studio background bleed. It must be the **Vega app's background**, not the Studio's global Desert Heat canyon background.
- If supported cleanly, simple focal positioning can be offered later; the MVP does not require a full crop editor or artistic effects.

### B1. Page-specific backgrounds and channel-wide application — owner amendment 2026-10-22 13:45 UTC

**Additional owner request (verbatim):**
> "be sure to update the background image option as a per page setting. you could choose to set it on every page, or set individual images per page"

**Required controls / mental model:**

- A **channel-wide default background image** remains available in **Appearance**, optionally applied throughout the TV app. New pages and pages without custom overrides inherit it automatically.
- Each selected page exposes a **Background** setting in the page's contextual Appearance/settings editor. Creators can choose **Use channel default**, **Custom image for this page**, or **Color only** (explicitly suppresses inheritance on that page). Reuse the formal P9-006 image-upload popup, visually standardized by P9-007.
- Provide a clear, intentional **Apply to all pages** action so a creator can make a selected background image the same across **every existing page** (and set it as channel default for new pages). If some pages already have custom images/opt-outs, warn that the bulk action will replace their background settings and require explicit confirmation before overwriting. Bulk action may instead use an equivalent safe inheritance model as long as all existing pages visibly match and future default is unambiguous.
- **Per-page change must not affect other pages.** Reverting one page to "Use channel default" removes only its custom override; removing the channel default falls back to that page's saved color or channel color without deleting custom per-page images. "Color only" remains meaningful even when a channel default image exists.
- The creator should be able to tell at a glance whether the current page is **inheriting**, **overriding**, or **suppressing** the image. Avoid complex multi-level settings or hidden implicit overrides.

**Deterministic rendering priority for page P:**

1. If P has a saved **custom background image**, render that image.
2. If P explicitly chooses **Color only**, render P's configured color if such a page color exists, otherwise the channel's selected background color.
3. If P is set to **Use channel default**, render the channel-wide default background image when present; otherwise the configured color fallback.

The active image always replaces the visible color on that page, but the saved color is retained as fallback. **All image backgrounds remain aspect-preserving `cover`, without stretching**, even for square/portrait source art; cropping of decorative backgrounds is permitted. This does **not** change P9-008's `contain` requirement for content artwork.

**Data/runtime:** Use a channel-scoped default background asset reference plus optional **stable page-ID-scoped** override/mode; prefer existing page/appearance contracts. Preserve existing channels' global color and image configuration on upgrade; treat legacy channel background image as the inherited default unless evidence requires migration. Save page override independently. Changing selected page in Studio's interactive TV Preview and navigating between pages in fullscreen/exported Vega must immediately display the correct resolved background. Do not bake only one channel-wide bitmap into every view or depend on an authenticated Studio URL from the native package.

**Acceptance for amendment:**

1. Set a channel default background and create a new page: the new page inherits it; all existing non-overridden pages show it.
2. Change only Page B to image B: Page A still shows the default; Page B shows image B. Reload/relogin and confirm the distinction remains.
3. Set Page C to Color only while a channel default exists: it displays color without an image. Revert to Use channel default: image returns.
4. Apply a chosen background to every existing page: all TV pages display it, including those previously overridden **only after explicit overwrite confirmation**. Future new pages inherit the same default.
5. Remove one page's override: it reverts to the channel default, not an unrelated image or blank background. Remove the global image: non-overridden pages use the saved color; custom-page images remain intact.
6. Verify aspect-safe filling, readable foreground, refresh/session persistence and page-to-page navigation across normal/fullscreen Preview and freshly exported native Vega package/VirtualDevice. No page uses the Studio's canyon image unintentionally.
7. Retain previous page IDs, titles, ordering, sections and image assets. Avoid altering video/media publishing, native channel releases or other creators' pages.

### C. Channel logo replaces visible app title

- In **Appearance**, provide **Channel Logo** with Upload/Replace/Remove.
- When a channel logo is configured, the actual Vega app's visible heading/title area should **render that logo instead of the textual channel title** (not show both side by side unless explicitly designed later).
- The logo preserves its aspect ratio using **contain** scaling within a sensible reserved header/logo area; no stretch, distortion, clipped logo or oversized header pushing content below the fold. Transparent PNG-style logos should render correctly.
- When no logo exists, removing it, or while an image is unavailable, fall back to the existing channel title text so the app never has a blank identity.
- Retain the **channel title string as metadata and accessible name** for navigation, assistive technology and package metadata; only replace the *visible visual title*, not its identity in data contracts.

### D. Page image sections: upload rather than paste URL

- Apply the same modal/upload experience to existing **Image Banner**, **Image + Text**, and any other genuinely image-backed **section layout** image controls. Place the trigger inside the relevant section inspector/editor, not in a separate Library workflow.
- After a successful image selection, show an in-editor thumbnail, allow replacement/removal and immediately update the same interactive Vega Preview state once saved.
- Fit images according to the section's intent without distortion: banner/bleed regions can use aspect-preserving **cover** with cropping; content/image+text regions use proportional **contain** or a suitable existing bounded crop based on the section preset. Do not force a universal stretch rule or rewrite section layouts.
- Changing the picture of one section must not unexpectedly change the global background, logo, another section's asset or unrelated pages.

## Persistence, runtime and export requirements

- Assets/branding/section references survive Save, reload, relogin, and service restart, scoped to the owning creator/channel and existing section identifiers.
- The **same saved logo/background/section images** appear in normal interactive Vega Preview, fullscreen/Clean View, and a newly exported Vega package. The package must resolve/bundle/serve the referenced images through its **supported native asset pipeline**, not depend on an inaccessible authenticated Studio URL or an arbitrary remote host.
- Avoid storing giant base64 images inside channel/page JSON, unbounded uploads, anonymous public reads or broken references. Implement reasonable content hashing/cache invalidation when replacing an asset.
- Preserve existing secure upload/storage, ownership, asset rights, app preview rendering and export contracts. Do not rebuild the whole rendering pipeline or touch the protected existing public release.
- If image rights attestation is necessary for the actual asset use, reuse **P9-004 one-time persisted confirmation** instead of another recurring rights questionnaire.
- Image upload must remain separate from P9-002's private video pool / one-click video inclusion, though shared secure upload infrastructure may be reused.

## Acceptance tests / visual gates

1. On a new or existing channel, creator can **choose a logo image from local disk in a popup**, preview, save, reload and see it in place of text title in interactive/fullscreen Vega UI; removing it restores the channel title.
2. Creator can upload a **background image** in Appearance. The channel-wide default and each page-specific override behave according to **B1** (inherit / custom / color only / Apply to all pages); removing images restores saved color fallbacks. Portrait/square/wide backgrounds fill a **16:9 TV preview without stretch** (center crop where needed) and do not introduce white bars or unreadable overlays.
3. Creator can upload/replace/remove an image for **Image Banner** and **Image + Text** sections, with preview and correct section-targeted persistence. The workflow never *requires* a pasted URL.
4. Unsupported/oversized/malformed file produces a clear recoverable error. Cancel, failed upload and retry do not corrupt the previously saved image.
5. Assets remain scoped to creator/channel, survive reload and service restart and cannot be fetched/attached by a different creator without proper authorization.
6. Generate a **fresh Vega export** from the changed channel, verify included/bundled logo/background/section artwork renders in the supported Vega runtime/virtual device; a browser-only success isn't export qualification.
7. Confirm old channels with legacy image URLs still display existing art until the creator replaces it; no destructive migration.
8. Verify no clipping, stretching or surprise blank headers at native TV-style sizes (at minimum 16:9, and representative image aspect ratios). Check clear focus/keyboard use, responsive modal sizing and errors in real authenticated staging browser.
9. Do not imply an already-deployed Vega app has been remotely updated; this is **new draft/preview/export** behavior only.

## Dependencies, batching and limits

- Coordinate with **P9-005**: Add Section remains compact, while each image-based section's existing Edit Section control launches the shared image upload dialog. Do not make the entire editor rail taller or duplicate large permanent forms.
- Coordinate with **P9-004** on a one-time asset rights confirmation and with Phase 8 P8C artwork/media work; inspect current source to avoid overwriting what Phase 8 has already fixed.
- Keep **logo / channel-default background / per-page background / section-image** semantics distinctly scoped and preserve fallback states. Coordinate page settings placement with P9-005.
- High-priority MVP implementation, but avoid scope creep into a full art editor, AI image generation, media CDN overhaul, global layout rearchitecture, or installed-app hot updates.
- **Documentation only:** not implemented, deployed or qualified.

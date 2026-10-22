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
2. Creator can upload a **background image** in Appearance. It replaces the displayed app background color; remove returns the saved color. Portrait/square/wide source images fill a **16:9 TV preview without stretch** (center crop where needed) and do not introduce white bars or unreadable overlays.
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
- Keep **logo / app background / section-image** semantics distinctly scoped and preserve fallback states.
- High-priority MVP implementation, but avoid scope creep into a full art editor, AI image generation, media CDN overhaul, global layout rearchitecture, or installed-app hot updates.
- **Documentation only:** not implemented, deployed or qualified.

# P9-010 — Formalize the Library as a multi-media and reusable-asset workspace after P8D

**Phase:** 9 — MVP Polish  
**Priority:** P1 / required navigation and clarity after multimedia baseline  
**Status:** Reported; dependent on completion/reconciliation of Phase 8 `p8d` multimedia implementation  
**Reported:** 2026-10-22 13:55 UTC  
**Surface:** Creator Studio > **Library**; Home > Add Media entry; related upload/edit dialogs and channel-content selection

## Owner report

> "after the multimedia p8d update is finished, we'll need to formalize the library page. this should include sections for audio files book files, and even just media that isnt \"content\" like logos, background images, etc."

The provided 2026-10-22 screenshot of the **current Library** shows a video-first interface with heading "Build your channel library", a large "Your video library" plus "Add Video" button, a collapsed "Import or enter other catalog content" entry, and a dense series of thumbnail cards mixing technical rights/readiness copy. At its present state, neither supported multimedia types nor brand/design assets have an obvious first-class home.

The **P8D multimedia update is explicitly a prerequisite** according to the owner. Do not treat audio/book support as implemented merely because a new Library tab or mockup exists. Inspect the actual completed P8D source, media types and ownership/storage contracts first, then adapt the UI to what was genuinely shipped.

## Product model — two distinct jobs in one Library

1. **Content media**: creator-owned **Videos**, **Audio**, and **Books** with their appropriate metadata, files and supported playback/reading/discovery behaviors from P8D. A file being in the Library does **not** necessarily mean it's included in the Vega app.
2. **Design assets**: **Logos**, **background images**, **section images/banners**, thumbnails/posters and similar media used to create the app's appearance. These are managed reusable assets, **not** standalone channel content; uploading an image must never cause an image card to appear as a playable title in the TV app.

Avoid a misleading one-size-fits-all media type model. Treat category as a first-class property but avoid building a new content backend or duplicating storage already provided by P8D/P9-006.

## Proposed Library information architecture

A clean, compact main Library with:
- **All** overview (useful summary/counts and a prominent **Add Media** action).
- **Videos**: existing video files, readiness, optional channel inclusion, metadata/artwork and Add Video workflow.
- **Audio**: supported audio files, display artwork, audio-specific metadata and the P8D-provided preview/playback/channel behavior.
- **Books**: supported book files/formats, cover image, title/author and P8D's actual supported book/open/read behavior.
- **Assets** (or **Branding & Images**): channel logo(s), global/per-page background images, section artwork, covers/posters and other reusable uploaded graphics.

These may be tabs, a clearly separated section selector, or a small category rail depending on existing Library layout. Favor a **single scannable Library destination** rather than five new global sidebar routes. Keep the current selected channel/creator context and avoid needless nested setup screens.

### Entry points and interactions

- **Add Media** from Home (P9-003) opens the Library's clear type choice. Provide only genuinely functional **Video / Audio / Book** import/upload actions after P8D. Asset upload is independently available through **Add Asset** / contextual image-selection dialogs; make it discoverable from Library's Assets category.
- Each category provides its own sensible add/import operation, cards appropriate to its actual media type, and appropriate *Open/Edit/Preview* actions. Do not show video playback controls on books or images; avoid describing book listings as playable video.
- Cards show **useful creator labels** (title/name, type, meaningful state, contextual action), not technical stacked rights strings. P9-004 defines the single rights attestation; hide repeated display/playback/right-delivery chatter. Actual unready/failed records still get concise actionable exceptions.
- Separate **private Library storage** from **In Channel / Remove from Channel** state for eligible content per P9-002. The available inclusion/display behavior for Audio/Books must follow the real P8D contract, not be fabricated. Do not show design assets in TV content browse rows unless a creator explicitly references them through an appropriate image/background/logo/section field.
- Provide contextual asset use from P9-006: `Choose existing image` or `Upload image` from logo, background, and section-image dialogs. An asset can be reused by multiple pages/sections without re-uploading duplicate bytes; confirm/represent current use when removing an asset.
- Cards for the same asset type should be visually consistent with existing Desert Heat identity and polished P9-007 modal design; responsive grid, clear empty states, reasonable visual density, and accessible keyboard/touch operations.

## Design-assets lifecycle

- Upload to a private owned asset pool, save a stable asset reference and descriptive filename/label; optionally classify role such as logo/background/section image without physically duplicating it.
- Choose an existing owned asset when editing Appearance or image sections. For the current channel, clearly indicate whether an asset is a global logo, channel default background, per-page override or section image **as appropriate to referenced uses**.
- **Remove asset from use** (detach from page/appearance) is different from **Delete asset from Library**. Deletion should not break actively referenced pages, published media artworks or the exported package; use reference awareness/confirmation and a safe deny/detach path.
- Honor owner/tenant isolation and existing private storage, upload validation and processed media rules. Do not expose unauthenticated Studio originals.
- Avoid automatic classification that treats posters and artwork as distinct media programs when they are simply supporting files.

## Acceptance criteria

1. After the confirmed P8D baseline, Library visibly separates **Videos, Audio, Books, and Assets** and provides a useful All overview; each type has honest available actions.
2. From Home > **Add Media**, the user lands in Library and can begin each **actually supported** Video/Audio/Book workflow without hunting through generic import instructions.
3. Video, audio and book records have tailored card content and appropriate editing/previews; old owned video data still shows without corruption or cross-channel bleed.
4. Upload/choose a logo or background from **Assets**, apply it to the current channel/page through P9-006 Appearance, then reopen the Library and reuse it without reuploading.
5. An uploaded background/logo/section image **does not become a channel-content item** automatically or appear as a bogus TV video tile.
6. One-click content inclusion/exclusion remains coherent with P9-002; stored private asset doesn't automatically publish. Don't imply remote Amazon or installed-app publishing.
7. Library records and reused assets survive refresh/relogin/service restart, with ownership tests and reference-safe removal.
8. Video and other eligible content still render in preview/new export according to supported P8D contracts; global/per-page backgrounds and logos render through P9-006.
9. On real authenticated staging browser, inspect desktop and narrow layout, category navigation, uploads/dialogs, empty states, error and retry flows, focus and accessible names. A short visual checklist documents that Library actually looks like one finished cohesive product.
10. Cleanup obsolete video-only instructions (e.g. "Your video library", generic "other catalog content" teaser where inappropriate) and reduce repeated rights or unsupported-media promises. Preserve truly functional import paths in a suitable category.

## Dependencies and implementation sequencing

- **Blocker: finish P8D multimedia** first. This issue is the polish integration layer, **not** permission to reimplement P8D or fake audio/book support. Reconcile exact resulting types, flows, contracts and deployment status.
- **P9-003** Add Media landing; **P9-002** private vs included content; **P9-004** one-time rights confirmation; **P9-006** image uploads/reuse/page backgrounds; **P9-007** modal visual standard.
- Avoid expanding to marketplaces, public catalog syncing, a new book reader or audio streaming architecture if P8D hasn't implemented those. Fix missing supported controls, but distinguish polish from new features.
- Respect deadline: prioritize discoverable, truthful workflows and avoid large backend restructuring; no changes to protected public channel release, schemas or deployment as part of issue intake.
- **Documentation only**: not implemented, deployed or qualified.

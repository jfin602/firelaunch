# P9-011 — Mixed-media selection and playback in Channel Editor sections

**Phase:** 9 — MVP Polish
**Priority:** P0 / core multimedia channel workflow
**Status:** Owner-reported; correction plan and manual prompt authored, not implemented or qualified
**Reported:** 2026-10-22 21:10 America/Chicago (2026-10-23 02:10 UTC)
**Approved documentation review:** 2026-10-22 21:12 America/Chicago
**Surface:** Channel > Pages & Layout > Edit Section > Choose content; Content Row, Content Grid, Featured Hero and additional content rows; interactive Studio TV Preview, fullscreen and freshly exported Vega app.
**Screenshot:** Owner-provided Android browser screenshot in the issue conversation, showing a Content Row "Choose content" checkbox list containing video-only titles ("AV Test In HD", "The Lone Survivor", "Q1 Owned Synthetic Video 2026-10-18") while the adjacent TV Preview already has a selected hero and video tiles. The screenshot is held in the conversation and not committed to Git.

## Owner request

> "There's currently no way to add audio and books to the app thru the editor toolbar. They need to also appear in this list and be displayed properly in the content row. And also in grid and other page rows. And behave like how video content does. Having a watch patch and a more info path."

The "watch patch" phrasing is interpreted as the media's appropriate primary action/path, NOT a requirement to label every type "Watch". The user requested this as a distinct docs-reviewed correction, `c9-multimedia-editor`, after Phase 8 P8D.

## Root of visible gap / inspected source (2026-10-22 GitHub main at 0.9.0)

- `apps/studio/src/App.tsx` `ModuleEditor` renders checkboxes from the `items` prop, passed as `spec.content` by `Content`; it does not itself enumerate all owned multimedia catalog records.
- `apps/studio/src/AudioWorkspace.tsx` and `BookWorkspace.tsx` store owned Library media in the catalog; those records are not necessarily included in `ChannelSpec.content`.
- `apps/server/src/catalog-projection.ts` maps `CatalogItem.kind=video|audio|book` into presentation `video|audio|information`, but rejects missing rights or playable delivery where required. `apps/server/src/catalog-composition.ts` can generate audio and writing/book rows; it is not a substitute for explicit editor section selection.
- Shared `packages/contracts/src/index.ts` already supports `ContentItem.presentation` and book `audiobook`, and `hero|rail|grid` content IDs. `packages/tv/src/runtime.ts` already resolves mixed items, detail/focus and playable vs informational states. `apps/studio/src/Preview.tsx` has a shared audio player, VideoPlayer and owner-only book-preview audio resolution. Avoid a second renderer or duplicated media catalog.
- The visible gap is primarily **catalog/eligible item discovery → explicit ChannelSpec draft binding → type-aware selection**, while preview/native contracts and authorization must remain aligned. Verify this diagnosis against execution-time source.

## Expected creator UX

1. The "Choose content from Library" selector shows **Videos, Audio and Books** with honest labels/type, ideally compact type groupings or a small type filter. All owned supported items should be *discoverable* here, including entries not yet deliverable: ineligible entries are clearly disabled with a short specific reason, not silently omitted.
2. A creator can explicitly check a rights-eligible item to put it into **the currently edited** Featured Hero, Content Row, Content Grid or additional authored Row, and uncheck to remove it **from that section only**. This must not delete its private Library asset or mutate unrelated pages/channels. Hero stays max one item; row/grid preserve checked order/stable identities and existing constraints.
3. Reuse existing stable catalog→content ID mapping / validated projection/binding and owner/project isolation. A saved module reference must resolve to the same real catalog item in `ChannelSpec.content`; do not add invalid/orphan content IDs, synthesize fake playback URLs, materialize raw private S3 URLs, or silently turn every private upload into a channel item.
4. The app's rows/grids/hero are **mixed-media**; no new per-medium section component, duplicate audio item for a book with audiobook, or forced template conversion. Selected items display suitable art: landscape video, square audio, portrait book, proportional and uncut.
5. Every card has an accessible **More info** detail path. Type-correct primary actions on detail/hero where playable: Video **Watch** (existing video player); Audio **Listen** (shared audio player); Book-only **More info / Explore** (title, author, synopsis, no Play); Book with eligible attached MP3 **Listen to Audiobook** (same shared audio player, returns to book detail on Back). A card's Select may open detail first, preserving the existing remote interaction model. Focus-only changes must update selected Hero art/metadata without autoplay.
6. Existing creator pages/section contents, custom ordering, navigation, saved names, private draft and existing video playback remain intact.
7. Playback/status is truthful: a private owner Studio preview may use an existing authenticated transient preview resolver, but the **persistent spec / public native export cannot contain an owner-only URL or bearer capability**. If audio delivery isn't qualified for native/export, show it in Library/selection with precise warning and block public export/play instead of inventing a link.
8. Do not update an installed application, approve a public release, or invoke deferred P10 publishing. P9's Publish/Remove contract is private draft inclusion/fresh export only; this issue is about selecting supported content into the authored sections.

## Acceptance matrix

| Fixture | Selector / section | Browse/detail action | Playback |
| --- | --- | --- | --- |
| Owned eligible Video | Visible/selectable in Hero, Row, Grid; retains current order | More info, Watch | Existing video player; focus/Back/seek preserved |
| Owned Audio MP3 | Visible with Audio label; selectable when valid for chosen draft/preview | More info, Listen | Same P8D audio player; no pretend video poster/player |
| Owned Book without audiobook | Visible with Book label; selectable; portrait art | More info, author/synopsis | **No Play/Watch** |
| Owned Book with attached eligible MP3 | One Book tile with audiobook indicator | More info, Listen to Audiobook | Same audio player, Back to book detail |
| Owner-held but unready/uncleared or missing delivery | Visible but clearly gated with reason | Informational Library/edit navigation only when safe | Never fake playable or export-ready |
| Foreign/revoked/deleted item | Never exposed as playable or bindable | Accurate denial / cleanup if prior selection | No leak, no stale private access |

## Explicit acceptance tests

- One real owner-owned test channel includes all four fixture types in **both Content Row and Content Grid**, plus a mixed Hero/selector row. Type-specific artwork, title/author/artist and fit remain readable at 16:9 and narrow Studio view.
- Check/uncheck/reorder and edit multiple pages; save, refresh/reopen, change selected channel and return. Confirm stable ordered IDs, no duplicate book/audiobook entries, no lost video content.
- Focus D-pad through mixed items: hero changes without autoplay; Select/More info opens correct detail; Watch/Listen or book-only description behaves by type; Back returns to the appropriate previous focus/detail.
- Preserve unsupported-content / audio delivery / rights / owner boundary fail-closed behavior; do not expose authenticated Studio media URLs in exportable `ChannelSpec`, generated package or immutable public manifests.
- Verify the exact **staging deployed source** in authenticated connected Codex browser after protected deployment (desktop and mobile screenshot/console/network). Where native contract/export changes, independently check a newly exported real Vega package/VirtualDevice. Native proof missing = NOT GREEN for that gate, never browser-only native GREEN.
- Test existing video-only authored channel remains unchanged and currently supported 0.9.x migration remains compatible.

## Dependencies and prompt routing

- **Related, not duplicate:** P9-010 Library organization and P9-002 private-vs-included video membership. This issue repairs the missing **editor selection and cross-media authored-channel projection**, independently of Library IA.
- Respect P9-004 one-time rights confirmation and P9-008 aspect-safe art rules, and the completed P8D design (Audio Listen; Book Showcase; no TV reader).
- Use a **dedicated, single-issue, manually run correction `docs/tasks/c9-multimedia-editor/`** before final Phase 9 P11 closeout. Preserve existing P1–P11 filenames and previously accepted results. The correction may be scheduled earlier if required for functional multimedia acceptance.
- **No implementation was performed by writing this file**; no version bump, stage deployment, native qualification or published update.

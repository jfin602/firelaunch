# P9-002 — One-click video Publish / Remove for the Vega channel

**Phase:** 9 — MVP Polish  
**Priority:** P0 / critical user journey  
**Status:** Reported; implementation not started  
**Reported:** 2026-10-22 12:16 UTC  
**Surfaces:** Library > private video workspace > Publish (page 4/4); Channel > interactive Vega Preview; exported Vega app/package  
**Evidence:** Two owner-provided screenshots in the 2026-10-22 issue-collection conversation: (1) video workspace **"Page 4 of 4 / Publish"** with live-channel-review warnings; (2) TV Preview showing a separate **"Private video drafts · artwork preview only"** section. The screenshots remain in that conversation, not copied into this repository.

## Observed problem

The video editor's fourth page calls itself **"Publish"** yet shows content such as:

- "Video added to the private channel preview. Review all channel content before publishing."
- "Private draft · this video is not in the current live release."
- "Publishing replaces the whole live channel, not just this video."
- "Hide live review", "Live channel review", "Refresh readiness".
- "This channel needs a live publishing setup. Open the main Publish workspace..."

That describes a larger, deferred **live-channel/Amazon distribution workflow** rather than the immediate MVP task of selecting which already-uploaded videos appear in the Vega app. It confuses testers, makes an individual video action depend on a complex global approval flow, and obscures the actual result.

The TV Preview separately shows **"Private video drafts · artwork preview only"** with an unpublished poster/card. This lets videos appear on screen before the creator has chosen to include them. Unpublished private library assets should not appear in the TV app at all, even as art-only previews.

## Owner-approved MVP content model

- **Private video pool** = all uploaded/owned videos stored in the Studio Library; private by default. Upload completion is **not** channel inclusion.
- **Included/published video** = a private Library asset intentionally selected for the current channel's playable content. This is editorial inclusion in the **channel draft/Vega content model**, not remote delivery to an already-installed Vega app.
- **Remove from Channel** = reverse inclusion only. It does **not** delete the Library video, HLS asset, video metadata, artwork, rights record or upload.
- A newly generated/exported Vega package should represent the included content at export time. Existing installed packages are **not** remotely updated by this feature.

The broader prior Phase 9 **Live Publishing & App Updates** plan is postponed until after the 2026-10-23 MVP deadline. Do **not** re-enable its remote distribution/setup/replacement workflows or overwrite a protected live release as a shortcut.

## Required behavior

1. **Upload:** Save new video into the private video pool with ordinary processing/metadata. It must not become visible anywhere in the Vega channel app or preview merely because it was uploaded.
2. **Publish (one click):** For an eligible processed, playable, rights-cleared video, clicking **Publish** includes it in the current channel's content and TV Preview without a global live-review wizard or multi-step release approval. Preserve explicit shelf/collection placement when already configured; use a reasonable existing default listing only if needed.
3. **Remove from Channel (one click):** From Library/video editor (and any existing suitable channel-content management entry point), remove that video's inclusion in the current channel. It disappears from TV Preview and the next export while remaining safely available in the private video pool for republishing.
4. **Visibility:** Only explicitly included videos render on the TV app's browse/home/detail pages. Remove the entire **"Private video drafts · artwork preview only"** section rather than hiding just its title.
5. **Video workspace UX:** Replace the page-4 global live review/readiness/release setup copy and unnecessary approval controls with a clear per-video status (**Private** vs **In Channel**) plus the direct **Publish** or **Remove from Channel** action. Processing/readiness and rights errors may still explain why a particular video is ineligible.
6. **Persistence:** Channel-specific inclusion survives refresh, session changes and service restart. Publishing/removing one item must not rewrite another channel's membership or drop other channel items.
7. **Export parity:** The Studio's interactive Vega Preview and the newly exported native channel package must draw from the same included-video selection; verify actual behavior, not only UI labels.

## Critical boundaries

- Preserve server-side ownership/authorization, rights checks, HLS readiness and source privacy; no public playback for unready or unauthorized assets.
- Never equate this one-click local channel action with MediaConvert pipeline approval, CloudFront publication, Amazon submission or installed-app hot updates.
- Do not alter/delete the protected existing FREE public release or unrelated live distribution controls as an implementation side effect.
- Assess existing channels and current inclusion records before migration: avoid unintentionally publishing all private drafts or silently removing already-intentionally-included content.
- Changes should be focused on one video's channel membership, not implicitly replacing the entire live channel.

## Acceptance matrix

| Action | Private Library | TV Preview / new Vega export |
| --- | --- | --- |
| Upload new video | Video saved, private | **Absent** |
| Publish eligible video | Video remains saved | **Present and playable** |
| Remove included video | Video remains saved | **Absent** |
| Publish ineligible/unready video | Remains private with explanation | **Absent**, no broken playable tile |
| Refresh/relogin/restart | Records persist | Inclusion exactly matches |
| Export after edits | Assets preserved | Package reflects current included-video list |

Additional smoke: exercise at least two videos and more than one channel, validate absent unpublished art-only cards on home/browse pages, confirm previous included video's playback and rights boundaries, and ensure no live deployment or Amazon publishing API was called.

## Related P9-011 — Mixed-media section selection

[**P9-011**](P9-011-mixed-media-sections.md) independently makes owned Video, MP3 Audio and Books discoverable/selectable into existing Hero/Rows/Grids with type-correct detail/player actions. **P9-002 remains the private Library vs channel-inclusion contract for videos**, not a requirement to rebuild the section editor or to automatically include every owned Audio/Book. Both issues must use a coherent explicit draft membership model and enforce real rights and public export readiness. If either correction has already changed the relevant catalog/ChannelSpec bindings, reconcile its committed source and evidence before modifying the same files. Neither action triggers Phase 10 immutable live publication.

## Dependencies / batching notes

- High-priority Phase 9 MVP behavior; coordinate with P8C media/artwork clarity changes and native export parity.
- Resolve naming conflicts with the global Studio **Publish** navigation without misrepresenting the action as updating deployed apps.
- Documentation-only report: **not fixed, not deployed, not qualified**.

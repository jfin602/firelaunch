# c6-supporting-media — Prompt assessment

Date: 2026-10-19. Status: owner-approved design, NOT executed. Root version 0.6.7 unchanged.

## Current source evidence and actual problems

- VideoUpload.tsx extracts a JPEG still using a video canvas or accepts a 1 MB custom JPEG/PNG and persists it to the existing owner-scoped private-object store as a separate artwork MediaAsset. It may not persist until the rest of upload validation has progressed.
- Home.tsx and Catalog.tsx render safeArtwork(item), which only reads creatorOverrides/source metadata HTTPS artworkUrl. Stored MediaAsset.location=private_object is ignored and therefore displays as a fallback. Studio's TV Preview currently reads ChannelSpec artwork; a private object capability must NEVER be inserted into public/exportable ChannelSpec to make a draft image appear.
- Existing private-objects.ts and API expose authenticated owner-scoped 60-second download capability + content response behind a required header. Use fetch -> Blob -> object URL and cleanup; never include capability in <img src> query or log, and guard response races on account/project change.
- Publication requires deliveryEligible artwork with cleared display rights and location.type=https. projectApprovedManifest's addAsset and CatalogProjection enforce stable public HTTPS; LivePublication lists only eligible public artwork. Existing publication repository has a managed HLS resolver/promoter seam to reuse for an approved artwork resolver. The HLS publisher handles .m3u8/.ts but no image bytes/path handling.
- CloudFront Foundation FreeDeliveryPathFunction, DeliveryPathFunction and ApprovedFreeDeliveryPrefix are currently tuned to a single exact HLS delivery prefix and video extensions. A JPEG suffix toggle alone would either stay blocked or dangerously widen access. Need approved exact owned poster paths and a reviewable change-set/denial tests.
- Catalog MediaAsset kinds currently video/audio/artwork; PublishedManifest v1 media kinds and bindings are strict. There is NO subtitle-track contract or native Vega caption rendering; do not add a new required field or pretend TV subtitles exist. Native template is separate from Studio.
- Existing Q2 free release #1 and video outputs must remain available and immutable; current Q2 F7 PARTIAL/NOT GREEN and Q3 UNSTARTED cannot be changed by this work.

## Architecture decisions

1. No additional bucket: use existing private-object storage and same publisher-only delivery bucket; group logically by creator/project/video and separate assets/version IDs. Preserve legacy opaque storage paths in place.
2. Two visibility channels: private Studio preview (owner-authorized Blob URL) appears as early as local selection, while public approved poster is a separate immutable S3/CloudFront transition after rights/review.
3. Custom thumbnail > generated still > currently saved owned approved/legacy source artwork > placeholder; show in popup, processing and Home/Catalog/Preview, not just on READY. Preserve selected image when encoding long jobs; handle reloads, revocation and replacement.
4. Never silently rewrite current release, public URL, published manifest v1, catalog identity or TV rights; current owned server records/revisions decide eligibility.
5. Optional subtitle track: stored by stable parent-video ID, normalized BCP47 language, private UTF-8 WebVTT with bounded cue/size limits/hash, replace and delete/revoke semantics. No subtitle default requirement, no upload/encode/release blockers.
6. Work fits five bounded implementation prompts plus independent fast closeout. The public CloudFront policy implementation is read-only/proposal mode for this stack; any actual AWS change requires distinct operator consent and browser/device evidence.

## Risks and mitigation

- Premature public access: exact path allowlist/rights; don't serve private originals, don't automatically enable CloudFront, don't put capabilities in permanent URLs.
- Cross-project leakage: check active owner for private media, cancel stale async fetch, revoke object URLs and previous capabilities on account/project change where feasible.
- Orphan/corrupt thumbnail data: reuse current records and linkages, make replacement idempotent, avoid deleting referenced historical objects or previous published artwork.
- Publication transaction/storage partial copy: stage/checksum/MIME verify before approved promotion, prepare immutable object, compare candidate manifest URL before switching atomic release pointer; rollback/cleanup only with explicit operator approval.
- Unsupported caption manifest: keep WebVTT foundation private only and strict ChannelSpec/PublishedManifest v1 unchanged, no fake caption player.
- Deadline: P0 images first, P0 artwork server bridge second, P1 subtitles only in bounded scope, preserve existing c6-usability implementation and shipping priority.

## Work split

P1 immediate thumbnail private preview (High); P2 managed approved artwork publication seam (High); P3 scoped CloudFront policy dry-run/security evidence (High); P4 optional WebVTT private foundation (Medium); P5 UX and focused regressions (High); P6 manual independent creator UX and code closeout (High). No AWS charges, no need for full two-hour MediaConvert qualification.

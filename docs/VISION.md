# VegaLaunch Vision

## CURRENT DELIVERY SCOPE — Phase 8 closed; 0.9.0 Phase 9 polish (2026-10-22)

Owner closed Phase 8 at the product milestone level with historical NOT GREEN native/publication evidence exceptions explicitly retained ([closeout](tasks/p8/closeout.md)). The active near-term product aim is to make the existing creator channel journey understandable and testable: create channel → add licensed Video/MP3/Book Showcase → curate into ChannelSpec → focus-driven full-bleed one-row Hero → Studio TV Preview → approved NEW Vega Export. [Phase 9 MVP Polish](tasks/p9/README.md) and [ten issue specs](tasks/p9-polish/README.md) execute manually one issue at a time from clean `0.9.0` baseline. Full remote installed-client publishing/update is postponed to [Phase 10](tasks/p10/README.md), not implied by a P9 Publish action. Preserve individual Amazon creator ownership and approved FREE public release #1.

---


## Current P8D multi-media scope — owner approved 2026-10-22

Video creators keep the established Watch workflow. Audio creators receive a simple MP3 Add Audio form, albums/playlists and a dedicated TV listening player. Writers receive a **Book Showcase** (cover, author, synopsis, bookshelf) and may attach one optional audiobook MP3, playing through the **same** audio player while remaining a single book item. **No ebook/EPUB/PDF television reader.** These experiences share one branded ChannelSpec app and existing creator ownership, display/playback rights and publication approval. Implementation is P8D ([plan](tasks/p8d/README.md)) before Phase 9. The previously documented [P8C NOT GREEN](tasks/p8/closeout.md) native static-layout/hero evidence is owner-deferred **for P8D entry only**, not relabeled. No source features/qualification are asserted merely by this vision update.

---


## Problem and audience

Video, audio, and writing professionals who already sell work in the Amazon ecosystem want a branded television destination without learning Fire TV development, focus navigation, packaging, or Appstore submission.

## Product promise

**Your Amazon catalog. Your own Fire TV channel.**

VegaLaunch turns a creator's existing, authorized catalog and licensed media into a television-native channel. It offers AI-assisted generation, a visual TV editor and Preview, creator-owned Vega source and publishing guidance, and creator-approved remote channel updates and an independently exportable Vega package.

**Individual ownership is non-negotiable.** Each channel is a distinct branded application submitted and controlled through its creator's Amazon Developer account. VegaLaunch is the builder/management service, not a single viewer app aggregating creators. Creator assets, content, app identity, listing, code and release decisions remain independently owned and exportable.

## Default creator journey (post-P0 launch MVP)

1. Create an account and a channel project.
2. Supply an Amazon seller/author identity or URL as a discovery clue, or directly import a creator-controlled feed/file. Public identity is not proof of ownership and does not guarantee supported Amazon data access.
3. Review imported works, provenance and rights. Attach playable video/audio or other appropriate, licensed television material.
4. Generate a meaningful design tailored to video, audio or writing: films and trailers; albums, audio samples and episodes; or an author bookshelf with readings, interviews and companion media.
5. Customize and approve through the Studio, Preview or ChannelAgent. Prompt-first creation remains available as an alternate entry. The ordinary workflow does not require code.
6. Export/build a creator-specific Vega project, qualify it on television and submit through the creator's own Amazon Developer Console.
7. Explicitly publish an approved, versioned channel manifest. Installed apps may fetch compatible approved channel/layout changes without binary reinstall; external catalog sources are not automatically polled or synchronized.

A product listing is not a playback license. A sparse list of product cards is not a sufficient television experience. Separate rights, quality and integration-permission gates apply to every source.

## Product boundaries

- `ChannelSpec` remains canonical for TV layout and navigation; catalog/source/rights state is a separate, versioned domain.
- Vega is the launch target; exported source and direct code editing remain available for advanced creators.
- Only approved integrations may import/display Amazon data on TV. KDP, Audible, Seller Central and affiliate data are different ecosystems; no universal connector is promised.
- Publish is separate from drafts; content rolls out via immutable manifests with caching, compatibility checks, rollback and guarded creator overrides.
- New app permissions, native code or incompatible runtime changes still require a qualified new package and the applicable Appstore review.
- No shared VegaLaunch viewer app, team workspaces, multi-TV platform exports, viewer purchases or advertising in launch MVP.

## Current October 20 product scope

P7 provides actual downloadable ZIP with a creator-bound Vega release VPKG and independent VirtualDevice playback of approved HLS. P8 independently confirms the creative/video workflow, and P9 qualifies the MVP by October 23 noon Central. Automatic catalog synchronization and standalone SaaS billing/Console operations have been removed from the forward roadmap. Manual imports, explicit publication and refresh of approved manifests stay.

## Historical P0 hackathon scope

P0 demonstrated a prompt-first Wild Earth product concept built around **Prompt -> Product -> Real Television**. P7 closed NOT GREEN at version `0.0.7`: browser Preview and source output were tested, but live Vega VPKG/device execution and broad live Bedrock requests were not established. The active `c0-real-tv-qualification` correction owns that evidence gap and is separate from the new launch-MVP roadmap.

See [MVP roadmap](roadmap/mvp-roadmap.md).


## Current creator video delivery direction (ADR 0011 and ADR 0013, 2026-10-18)

The active hosted path starts with real authenticated private S3 uploads (staging UX GREEN), followed by an AWS Video on Demand on AWS Foundation / MediaConvert encoding service (offline LOCAL GREEN, real provider NOT QUALIFIED) and separately approved, verified private HLS. Only a creator-approved free-to-view video may be promoted to exact CloudFront delivery paths and an immutable channel release, subject to a separate CDN operator gate. Shared private encoding supports future protected `purchase`, `rental`, and `subscription` modes, but viewer entitlements/billing/signing are not implemented. See [current state](CURRENT-STATE.md) and [live VOD plan](tasks/p6-live-vod/README.md).

## Historical 2026-10-11 AWS creator-media delivery direction (superseded for encoding)

VegaLaunch should let creators provide independently owned/licensed video files and manage conversion to television-ready media without requiring a separate video-hosting vendor. Initial path: secure S3 upload of originals, independently operated FFmpeg, validated HLS renditions and Amazon CloudFront delivery; muffinos remains the Studio/API control plane. Approved media is associated with catalog entries, separately verified TV rights, and explicitly released to independently creator-owned channel applications. No creator must license Amazon Prime Video or grant VegaLaunch control of their Amazon Developer account to use this capability. A storefront URL is only a discovery clue, never permission to copy or restream its videos.

The first release is free-to-view streaming on Vega, with media delivery modeled for future Fire OS/Roku adapters. Paid subscriptions/IAP, DRM and cross-platform native parity remain separate later products and qualification work. See [ADR 0010](decisions/0010-aws-media-delivery.md). Existing P5 manifest delivery stays independently qualified; future P6 adds real AWS media.

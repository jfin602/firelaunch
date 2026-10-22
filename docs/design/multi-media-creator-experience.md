# P8D — Multi-Media Creator Experience (owner-approved design)

**Owner decision: 2026-10-22.** [P8D plan](../tasks/p8d/README.md). Implement a coherent multi-media creator workflow **after the tested P8C 0.8.13 source and before P9**. This is a forward design, not proof of implementation or readiness. P8C's [NOT GREEN closeout](../tasks/p8/closeout.md) is intentionally deferred for entry, never erased or relabeled.

## One Studio, three native content experiences

| Media | Creator entry | Catalog identity | TV display | Primary action |
| --- | --- | --- | --- | --- |
| **Video** | Existing Add Video (unchanged) | `CatalogItem.kind=video` | Video poster / film detail / full-screen video | Watch |
| **Audio** | **Add Audio**, following Add Video's simple modal flow | `CatalogItem.kind=audio` plus owned MP3 MediaAsset | Album/episode cover, details, tracks/playlists, dedicated remote-driven audio player | Listen |
| **Book** | **Add Book**, following Add Video's modal flow | `CatalogItem.kind=book` with optional **audio asset attached to same book** | Portrait-cover bookshelf, author/title/synopsis/series detail | Explore; optional **Listen to Audiobook** |

**NO TV READER:** no EPUB/PDF/manuscript upload, ebook rendering, chapters extracted from text, on-TV excerpt reading, pagination, font/page controls, Kindle/KDP APIs, retail scraping or unauthorized Amazon cover/media reuse. Book description/synopsis is informational, not a book excerpt reader. A book without an eligible audiobook **never** has a Play button. A book with one licensed/eligible MP3 opens the **same** player as standalone audio; Back returns to its book detail. A book and its audiobook remain **one** book CatalogItem and one bookshelf slot; do not make a duplicate audio CatalogItem.

## Creator-friendly add flows

**Add Audio:** pick MP3 (validate actual bytes/container, not extension only; sensible server-configured size/time budget), title, artist/creator, description, optional genre/album/episode/track sequence, square cover, album/playlist selection; detect duration when reliably available. Independently assert cover display and audio TV playback rights. Save private draft and upload progress with safe retry/reopen, no publication until separately approved.

**Add Book:** title, author, synopsis/description, optional ISBN/series/publication date, portrait cover, bookshelf; optional checkbox **Attach audiobook MP3** reveals file, narrator and playback rights. A standalone book can be saved, organized and previewed without any audio file. Adding/removing/replacing a book's MP3 never creates/rekeys the book. The audiovisual file is an `audio` MediaAsset linked to the same owned book; retain its provenance and revoke old delivery on replacement. The generic Catalog advanced source/feed tools remain available, but simple Add Audio/Add Book should be the creator happy path.

**Shared workspace:** keep existing global Home / Library / Channel / Publish / Export. Library gets obvious Add Video / Add Audio / Add Book controls and type-aware details. Channel keeps one ChannelSpec, same left editing rail, current 16:9 Preview, brand, Hero/Rows/Grid and six section kinds. Mixed channels may show films, albums/episodes, and bookshelves together without pretending everything is a video. Collection labels are type-correct; no auto-play placeholder for book-only items.

## Playback/rendering

- Standalone audio and attached book MP3 use **one** audio transport/UI component in Studio Preview and generated Vega output. Large square/cover art, title/creator, elapsed/remaining/progress, play/pause, seek and TV Back. Playback must survive sensible focus/detail changes and end/error cleanly; implement bounded resume only if appropriate to available storage and maintain owner/privacy boundaries. Don't assume HTML `<audio>` proves native Vega MP3 playback.
- Book detail uses its portrait artwork, readable 10-foot title/author/synopsis and metadata, and no playback for a book without eligible audio. Optional **Listen to Audiobook** launches the common player while retaining the book detail return target.
- New audio and book presentation must be projected through the existing shared contracts/TV engine and real native generator. TV focus/D-pad/Back and one-preview-instance semantics stay intact. New installed-client capability is **Requires App Update/Blocked** until supported by a qualified new VPKG; NEVER OTA-publish unsupported executable layout/player semantics.

## Safety and media delivery

Current catalog already has `video|audio|book|listing`, `MediaAsset.kind=audio`, `album|playlist|bookshelf`; current ChannelSpec has `presentation=video|audio|information`, but **information forbids mediaUrl/playback**. Extend contracts **additively** for an optional audiobook reference bound only to a book, with a corresponding optional independent audiobook MediaAsset binding and public manifest validation. Avoid making book presentation a second audio catalog item or relaxing all informational items. Preserve old books and video manifests byte-for-byte on read. Validate strict allowed fields and old-client negatives.

The existing generic private MP3 attachment is small/non-deliverable; not a full audio ingest path. Prefer the proven authenticated durable direct-private S3 upload pattern (resumable only if actually implemented), with content validation, owner/project/item binding and safe retention/cleanup. Playback delivery must have an explicit reviewed, byte-range-capable **device-reachable immutable release** URL behind valid audio rights and publication approval. Private S3 originals, temporary tokens, arbitrary creator URLs and speculative direct AWS exposure must NEVER enter public manifests or VPKGs. Audio MP3 should not be sent through video MediaConvert merely by analogy. Cloud/CDN policy or credential changes require separately authorized operator work; unavailable delivery remains honestly blocked, not simulated GREEN.

Book cover rights, independent MP3 playback rights, source permissions, versioned approval, foreign-owner denial, CSRF, revocation, stale/replaced media and rollback remain strict. No paid access/DRM/audiobook marketplace integration or external links presumed supported.

## Deferred predecessor qualification

The historical P8C [Phase 8 closeout](../tasks/p8/closeout.md) is **NOT GREEN** for missing Image Banner/Image + Text real Vega device parity and smaller-than-approved hero art. Owner authorizes **P8D implementation to start without those gates**; no rewriting P8C history. Record each as separate carried debt for later qualification/owner decision. Do not claim P8D is native-qualified without its own actual audio/book evidence.

## Acceptance

Minimum: private Add Audio and Add Book create/reopen; standalone audio and book-attached MP3 use the same working native audio player with remote seek/Back; informational book does not offer Play; book/album collections and mixed layout work in Studio and current generator; ownership, rights and unsupported-client publication safely deny; protected staging/browser/device evidence with exact source/artifact identities and no changes to approved FREE release #1. P8D P5 writes an independent GREEN/NOT GREEN closeout. Phase 9 still needs explicit owner authorization.

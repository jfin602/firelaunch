# P8D — Manual implementation plan: Audio + Book showcase + optional audiobook

**2026-10-22 /prompt-plan.** This plan authorizes executable **manual** P8D tasks; writing them does not implement product changes. Owner-approved [design](../../design/multi-media-creator-experience.md) and [assessment](prompt-assessment.md) apply. **P8C NOT GREEN does not block entry**, but remains an open, factual legacy qualification result.

## Checkpoints/version/validation ownership

| Step | Version | Main implementation boundary | Focused gate |
| --- | --- | --- | --- |
| P1 Contracts | **0.8.14** | Catalog typed optional metadata (artist/album/author/ISBN/narrator), book info + optional single audio media binding, manifest rights/capability compatibility and safe shared TV presentation contract | Contract/publication/channel-engine/generator parsing, old-record roundtrip, unsupported-client and rights negatives |
| P2 Audio | **0.8.15** | Add Audio modal and owner-bound MP3 ingestion, cover/rights, collections, shared TV audio-player transport + browser-fidelity | Studio/server private upload, size/content/MIME/auth, retry, selected collection/preview, staged owner browser |
| P3 Books | **0.8.16** | Add Book modal + book detail/portrait bookshelf, optional MP3 link to SAME book, shared audio player reuse, replacements | Book-no-audio vs book-with-audio, catalog identity/rights, browser save/reopen/book detail |
| P4 Mixed native | **0.8.17** | Native Vega audio and book semantics, mixed-media ChannelSpec projection, immutable compatible audio delivery path, publication/export | native source/package-focused tests, denies for old clients/foreign/stale/rights, staged owner UI; try bounded device test |
| P5 Manual closeout | **0.8.17 unchanged** | Final aggregate, protected staged owner journeys, real Vega VPKG install/play/audio/book/no-play, independent P8D disposition | `docs/tasks/p8d/closeout.md`, exact SHA/device/public release/limitations |

**Manual only:** every prompt must inspect actual local HEAD/dirty/origin and root package + BOTH lock top-level version fields, preserve parallel edits (no reset/stash/force), and **self-commit** focused source + version then a separate evidence/handoff when suitable. P1 changes `0.8.13→0.8.14`, P2 `→0.8.15`, P3 `→0.8.16`, P4 `→0.8.17`. Leave workspace versions untouched. P5 leaves `0.8.17`, commits final truthful closeout. Do **not** invoke runner or runner validator; manual prompts intentionally don't use that grammar. No `/activate`. If current source/version diverges, reconcile specific facts before editing; P8C NOT GREEN alone is NOT an entry divergence.

## P1 — schema, provenance, optional audiobook contract

Reuse existing `CatalogItem.kind=book` as ONE book. Build an additive book-specific optional audiobook reference to an `audio` MediaAsset owned by that book, preserving existing `presentation=information` with **no** ordinary `mediaUrl` for book-only. Explicit optional author/ISBN/narrator/artist metadata should be validated in existing domain; bound and escape text, don't treat ISBN as proof of rights or Amazon authorization. Extend `ChannelSpec` and manifest (if justified; avoid silent global major schema bump) with a narrow optional bookAudio slot/binding and require rights-cleared eligible immutable audio before remote delivery. Reject audiobook on arbitrary `information` items and all mismatched owner/project/book/asset IDs, blocked/revoked/unknown rights, stale revisions and unsupported installed-client capability. Keep old serialized video, audio, info book and published releases readable. Shape future playback and book-card view without duplicating UI state.

## P2 — audio creator happy path / private delivery

Add first-class **Add Audio** from Library using the existing modal/sheet and upload pattern. MP3 first; title/artist, optional episode/album/playlist, square artwork, rights confirmation and safe file validation. Upload large files via actual authenticated durable private path (not existing 1 MB generic form); status/progress, reopen, replace/retry, server-side size/range/content checks and owner-only read. A private MP3 is NOT publicly playable until later eligibility/publishing. Add one reusable audio player used by standalone audio and future books, with TV remote-select/pause/seek/back, progress, error handling, sound and optional resume. Studio Preview is scoped browser proof only; do not claim device success. P2 should not invent cloud origin/CDN access or relax publication to fake playable release.

## P3 — books and optional audiobook

Add first-class **Add Book** with title/author/synopsis, portrait cover, optional ISBN/series/date, bookshelf, owner rights for cover. Optional **Attach audiobook MP3** uses P2's existing durable MP3 upload/editor and *same audio player*, with narrator/independent playback rights. Book-only items are informative detail **without Play**. Book with eligible MP3 gets **Listen to Audiobook**, player Back returns to detail. Single book ID in Library, bookshelves and ChannelSpec, no duplicate Audio CatalogItem. Existing books remain valid, video/audio playback untouched. No reader/EPUB/PDF upload, excerpt pagination, Kindle/KDP integration or external asset scraping.

## P4 — real mixed output and safe publication

Project type-correct TV cards/rail/hero/selection, dedicated book detail and remote audio player through `packages/tv`, `templates/vega-channel`, generator/publication and Studio Preview. Test book-only no playback and book-audio live. Ensure native MP3 media APIs, lifecycle/pause/seek, return/focus, audio duration and proper error flow. Validate actual immutably released, device-reachable byte-range MP3 URL under creator rights and current release: private S3 originals never public, never in generated packages, no arbitrary signed URLs. New AWS/CloudFront policy requires separately authorized operator action and may be NOT GREEN if denied. Ensure old installed app is **Requires App Update / Blocked** for new book-audio/audio player capability; never silently publish unsupported layout. Maintain original free video release #1.

## P5 — independent end-to-end acceptance

Use the existing owner Google session on current protected `https://firelaunch.jfin.dev/` staging: new Audio with MP3 → owned cover/rights → album → reopen → Channel → Preview; new Book with cover → bookshelf → details **no Play**, then add permitted audiobook → Listen → common audio player; check mixed video/audio/book Channel editor and Publish vs Export. No unsolicited content publication. Use a separate rights-safe explicitly approved test fixture for native published path rather than mutating release #1.

One final `npm run test` on exact source (already builds/typechecks packages) and `git diff --check`; don't rerun all suites per implementation checkpoint. Native x86_64 Vega VirtualDevice should install/run a current provenance-bound package with one approved MP3 and both book variants, verify audio device output, pause/seek, D-pad, Back, restart and rights/old-client rejection; exact VPKG/device/log/image. Current `qemu:-1` is a known environment blocker; if still unavailable, **P8D NOT GREEN for native**, record actual evidence, never invent. Preserve separate P8C historic not green, with its two deferred items explicitly carried forward. P8D success is independently reported; no automatic Phase 9 activation or P8C rewrite.

## Protected staging contract

Owner-approved [standing sudoers runbook](../../../scripts/staging/README.md) grants `deploy` guarded release/rollback for matching tar/hash, not unrestricted production power. Each P2/P3/P4 deployed milestone: code must be committed/tested before build, verified archive SHA-256, retained hashed assets and visible-root smoke, guarded staging backup/schema14 compatibility/rollback, services and fresh owner signed-in browser asset identity, free release #1 pointer/hash unchanged. Do not execute ad hoc sudo/rsync or new root scripts; new schema migrations and cloud policies require explicit further authorization. Staging receipt is not Vega device proof.

## Budget and handoffs

Implementation prompts aim for bounded <=8-minute changed seams, 15-minute stop and precise handoff when blocked (cross-system external acceptance can run longer). Max two scoped observed repair cycles per step, no speculative redesign or duplicate builds. P1–P4 evidence files `docs/tasks/p8d/P1-evidence.md` through `P4-evidence.md`; P5 `docs/tasks/p8d/closeout.md`. Source version and commit IDs separate from evidence commits and deployments.

**Deadline:** October 23 noon America/Chicago was the earlier video-MVP target; P8D is additive pre-P9 scope. Do not hide a safety/real-device blocker solely to fit the old deadline.

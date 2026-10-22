# P8D — Prompt assessment: multi-media studio, native audio and book showcases

**2026-10-22 — owner-approved /prompt-ass.** [Design](../../design/multi-media-creator-experience.md), [plan](implementation-plan.md), [README](README.md). Five manual checkpoints; ready for independent Codex execution starting with P1. **P8C final NOT GREEN is expressly deferred as an entry gate**, never changed to GREEN.

## Evidence-first source assessment

Checked GitHub main `d0814e3ef739`: root and both top-level package-lock version fields `0.8.13`. [P8C final closeout](../p8/closeout.md) was committed, tested Studio staging and aggregate, but native static image/text Vega VirtualDevice failed to remain running, and hero art sizing didn't match earlier intent. These don't invalidate the clean source entry for **new P8D development**; preserve them as deferred acceptance debt. Never assert local checkout, owner browser, VPS or device state solely from a GitHub read.

Actual existing seams:
- `packages/contracts/src/catalog.ts` **already** models CatalogItem `video|audio|book|listing`, MediaAsset `video|audio|artwork`, private upload/https/managed HLS, and `album|playlist|bookshelf`. `apps/studio/src/Catalog.tsx` exposes advanced manual entries, but normal navigation/Library highlights only **Add Video**. Its generic MP3 attachment is limited and `deliveryEligible=false`; this is NOT production audio upload/delivery.
- `packages/contracts/src/index.ts` has presentation `video|audio|information`. `information` explicitly rejects `mediaUrl` and duration; `apps/studio/src/Preview.tsx` displays a basic HTML audio player and informational book detail. These are NOT proven native Vega audiobook semantics.
- `packages/contracts/src/publication.ts` enforces one-to-one CatalogItem bindings and prohibits `playbackAssetId` on informational book presentations; existing install compatibility blocks new unsupported layout features. P1 must extend *optional book audiobook binding* carefully without converting the book into a second audio entry or invalidating old informational books.
- Video upload, rights, provider processing, secure staging, owner return and revision persistence already exist: reuse the proven components/patterns but do not silently send MP3 into MediaConvert HLS or make S3 private objects public.
- Native generator/templates, Studio Preview and released manifest are different acceptance boundaries. A Studio mock/playback or static unit test is not native Vega device evidence; new media support on older installed apps requires **Requires App Update/Blocked** until a qualified compatible VPKG exists.

## Implementation risks and gates

1. **Book/data migration risk:** old video/info ChannelSpec and published manifests must continue to parse, and existing book-without-audio must stay non-playable. Add optional audiobook asset to **same book** with distinct owner/source/rights/release bindings; treat any new client capability as unknown/fail-closed. Don't attach an independent audio CatalogItem just to satisfy old `information` validation.
2. **Audio upload delivery:** the existing 1 MB generic private MP3 form is not a large durable MP3 path. Reuse authenticated server-side S3 private upload model, validate actual file bytes + media metadata/size, bound abuse and allow creator safe retry/replace/revoke; old/current release cannot leak private media or creator-scoped object IDs. Device playback needs range requests and immutable safe URLs after explicit rights/publication.
3. **TV semantics:** native Vega and Studio share player intent, D-pad/Back, seek/pause, artwork, audio lifecycle/end/error. Book showcase portrait cards + detail, optionally launches the same audio player. No EPUB/PDF reader.
4. **Publishing/installed apps:** no incompatible media/presentation pushed as compatible OTA to existing release #1; require capability-qualified VPKG. Public manifest/bindings must link approved/catalog-owned cover and optional MP3; fail foreign, revoked, stale, duplicate, mismatched artwork, unsupported client and CSRF.
5. **Operational/testing:** current standing staging deploy grant is privileged; work only through audited backup/hash/rollback path. Any AWS/CDN policy change needs separate approval. Real Vega VirtualDevice still had `qemu:-1`, so implementation can progress while device/launch claims stay unqualified.

## Execution decision

**Manual Codex browser sequence** rather than runner: P1 contracts, P2 audio, P3 books, P4 native/mixed; each agent owns version 0.8.14/15/16/17 plus code+evidence commits. P5 at unchanged 0.8.17 is the one independent closeout. No `npm run codex:stack -- p8d`, no runner-owned commits or `/activate`. P1 can run NOW from actual coherent `0.8.13`; the prior NOT GREEN needs no device repair first. P2/P3 use actual Codex browser/guarded staging; P4 uses real native test when available; P5 must report exact missing gates, not manufacture pass. Focused tests/typecheck P1–P4; one final aggregate P5. Respect existing owner deadline without claiming expanded scope is already delivered.

**Conclusion:** split is five prompts. Implementation of rights-bearing book audio attachment requires first a contract seam, then one reusable audio ingest/player, then book-only UI, then native/publish integration; putting all into one prompt would conflate safety and UX and repeat tests.

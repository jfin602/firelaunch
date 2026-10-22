# P8D — Multi-Media Creator Support

**Owner-approved 2026-10-22 — /docs-apply + /prompt-ass + /prompt-plan + /prompt-write AUTHORED, NOT EXECUTED.** **READY FOR MANUAL P1 ENTRY** from verified root/lock `0.8.13`. The owner explicitly **defers P8C's NOT GREEN requirements as entry gates**, without reclassifying or modifying [historical Phase 8 closeout](../p8/closeout.md). P8D starts now, before [Phase 9](../p9/README.md); no P9 source/version activation implied.

[Design contract](../../design/multi-media-creator-experience.md) · [Prompt assessment](prompt-assessment.md) · [Implementation plan](implementation-plan.md) · [Current state](../../CURRENT-STATE.md)

## Five sequential manual Codex prompts

| Prompt | Version | Responsibility | Execution |
| --- | --- | --- | --- |
| [P1 — Media contracts and compatibility](P1-media-contracts.txt) | **0.8.14** | Additive optional audiobook binding, type-safe author/audio metadata, rights/compatibility | Manual source commit, focused tests |
| [P2 — Audio upload and player](P2-audio-workflow.txt) | **0.8.15** | Add Audio modal, private durable MP3 upload, cover/rights, common audio player and provisional delivery | Manual Codex browser, protected staging |
| [P3 — Book showcase and optional audiobook](P3-book-showcase.txt) | **0.8.16** | Add Book modal, portrait bookshelf/detail, optional SAME audio asset/player, no reader | Manual Codex browser, protected staging |
| [P4 — Mixed-media native and publication integration](P4-native-mixed-media.txt) | **0.8.17** | Shared layouts, generated Vega semantics, native audio renderer, compatibility/immutable release delivery | Manual Codex browser, bounded native testing |
| [P5 — Independent multi-media closeout](P5-multimedia-closeout.txt) | **0.8.17 unchanged** | One final aggregate, signed-in creator/browser, actual device MP3/book playback/parity, P8D status | Manual Codex browser + real Vega VirtualDevice |

**Manual workflow selected:** P8D spans cloud audio delivery, Studio UI and new native presentation requiring browser/device debugging; all five prompt files are **manual**. Do **NOT** use `npm run codex:stack -- p8d` or its validator, nor `/activate`. Each P1–P4 running agent owns its scoped code/versions and Git commits, preserves uncommitted parallel work, and writes a dated handoff. P5 owns independent `docs/tasks/p8d/closeout.md` and commits it without a version bump. Only P1 begins now; the rest follow actual accepted predecessor evidence. The files being authored are not implementation/qualification.

**Version:** P1 `0.8.13 → 0.8.14`; P2 `0.8.14 → 0.8.15`; P3 `0.8.15 → 0.8.16`; P4 `0.8.16 → 0.8.17`; P5 unchanged `0.8.17`. Update only root `package.json.version`, `package-lock.json.version`, and lock `packages[""].version` together. No separate `0.8.14` entry-only bump. Leave workspace versions/schema 14 untouched unless a narrowly justified, separately authorized data migration is actually necessary; no unapproved schema upgrade.

## P8C disposition and immediate entry

[2026-10-22 P8C P4](../p8/closeout.md): overall **NOT GREEN**; tested `0.8.13` Studio source/staging and existing rights security passed in scope, but real Vega Image Banner/Image + Text couldn't be verified because the VirtualDevice stopped (`running:false`, `qemu:-1`), and TV hero image remains smaller than the historical approved composition. **Explicit owner decision:** defer those acceptance items, proceed with P8D now. They stay separate issues; P8D does not inherit their GREEN, automatically repair them, or rewrite the original document. A broken VirtualDevice does **not prevent P8D P1–P4 source work**; any external qualification that requires it stays NOT GREEN until actually observed.

At docs authoring, GitHub main source HEAD is `d0814e3ef739`, root and root-lock versions `0.8.13`. The P8C final aggregate passed kernel/server 174, Studio 85, runner 104, with 15 skipped; this is historical coverage of the `0.8.13` tree, **not** validation of P8D. P1 must recheck its actual local HEAD/status/lock versions and any later commits, not assume the host or laptop matches GitHub.

## Product scope

- **Video:** preserve Add Video and video HLS player exactly.
- **Audio:** simple first-class **Add Audio** using MP3, title, artist, cover, album/playlist; safe private upload/rights, accurate status and seekable device playback; shared player for any book audiobook.
- **Book:** simple first-class **Add Book** with portrait cover, title, author, synopsis, optional ISBN/series/published date/Bookshelf and an **optional audiobook MP3 attached to the SAME book**. No EPUB/PDF upload, reader, pages, chapter parsing or duplicate audio CatalogItem. Without eligible audio, the book has details only and NO Play.
- Mixed channels use one ChannelSpec, same six sections/TV editor, type-appropriate cards, and installed-app compatibility fail-closed. No automatic Amazon import, external cover scraping, paid entitlement, DRM or Appstore changes.

## Safety, staging and acceptance

P1 works locally on contracts/tests before UI; P2/P3 use real Codex browser debugging against signed-in **protected staging** on tested source and may deploy via current [standing staging runbook](../../../scripts/staging/README.md). The standing sudoers grant is **shared-host privileged**, not permission to run unreviewed scripts, expose private objects or change production/AWS/IAM. Reverify actual grant, exact archive hash, retained frontend assets, visible-root smoke, backup, schema14/rollback, public FREE release #1 preserved. If real CDN/release audio delivery needs new cloud permissions/policies, STOP that operation and report an explicit operator-approval handoff; never fabricate playable public audio.

P4 owns real native projection, playable delivery and protected publication negatives; P5 owns **one final build-backed `npm run test`**, one end-to-end signed-in creator journey for audio/book/mixed channels, x86_64 Vega device evidence, source hashes and independent P8D GREEN/NOT GREEN. Browser-only `<audio>` and local renderer tests are insufficient to claim Vega native playback.

**Deadline context:** owner delivery target Fri 2026-10-23 12:00 America/Chicago remains the earlier video-MVP milestone; P8D is an expanded scope and is not retroactively claimed complete within it. Prioritize high-signal forward progress and truthful qualification.

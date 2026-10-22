# P8D — Prompt assessment: runner-compatible multimedia checkpoint sequence

**2026-10-22. Owner-approved conversion to runner; first malformed browser metadata corrected.** P8D is a continuation D of Phase 8 with P1–P4 implementation and P5 manual closeout. [README](README.md), [implementation plan](implementation-plan.md), [design](../../design/multi-media-creator-experience.md) are authoritative. P8C Phase 8 NOT GREEN is **owner-deferred for new development entry only**, not rewritten or falsely qualified.

## Verified source seams and risks

At authoring, root `package.json` + both top-level lock versions are `0.8.13` on GitHub; this does not prove a clean laptop worktree or a live service. `packages/contracts/src/catalog.ts` already has `video|audio|book|listing`, Audio MediaAsset, `album|playlist|bookshelf`. `packages/contracts/src/index.ts` has `presentation=video|audio|information`, with informational items prohibiting ordinary playback URLs. Publication currently rejects playback on informational book; optional book-audiobook binding requires an additive, strict same-book asset contract. `apps/studio/src/Catalog.tsx` has a small private MP3 attachment but no first-class durable audio release workflow. `apps/studio/src/Preview.tsx` uses a basic HTML audio element, not native Vega evidence.

Non-negotiable contract: one Book catalog item with portrait cover/detail, optional licensed MP3 audiobook attached as Audio asset and played via SAME standalone Audio player. Book without audio is information-only with no Play. No EPUB/PDF/TV reader, duplicate audiobook Audio item, automatic media publication or Amazon scraping. Foreign owner/project, revoked/unknown rights, source approval, CSRF, private upload tokens, public immutable release and unsupported installed-client capability remain fail-closed.

P8C `docs/tasks/p8/closeout.md` at 0.8.13 is **NOT GREEN** due failed VirtualDevice availability for new static layouts and unresolved hero art scale; owner **waives only the requirement to fix them BEFORE P8D starts**. P8D P5 needs independent real Vega audio/book proof, must report blocked if device fails; prior historical results untouched.

## Runner grammar/behavior inspection

Read checked-in `scripts/codex-stack-core.mjs` and `scripts/codex-stack.mjs`. `p8d` is a pre-1.0 continuation with P1 assigned 0.8.14; version offset 13 requires metadata P1–P5 `0.8.14, 0.8.15, 0.8.16, 0.8.17, 0.8.18` respectively. P5 assigned `0.8.18` is a proposed metadata slot **only** and final product version remains `0.8.17`. Browser field must be precisely `- Browser required: yes.` or `no.`, no qualifiers or trailing explanation; one unambiguous final closeout.

**Execution boundary:** P1 browser=no and runner owns version/commit subject `0.8.14`; no agent self-commit. P2/P3/P4 browser=yes and **runner intentionally stops before each**. Run these manually with Codex browser, committing tested source+version with exact one-line subjects `0.8.15`, `0.8.16`, `0.8.17` respectively. The runner can then discover each completed prefix from history when re-invoked. The manual P5 browser=yes closeout is independently executed at root+lock 0.8.17 with an evidence-only commit. This preserves genuine browser debugging and runner reconciliation; forcing browser=no on P2–P4 would be unsafe and not provide the requested browser proof.

## Efficiency / current goal

P1 contracts-only focused tests/typechecks, no browser/cloud/device. P2 Audio MP3 upload/Studio player and real signed-in browser. P3 Book Showcase + same-book optional audiobook and browser. P4 native Vega/audio publishing and browser/device if available. P5 one final aggregate/browser/device closeout. If an external provider/device step is blocked, say NOT GREEN explicitly; don't manufacture exact version commit unless the product checkpoint actually passed its required implementation gate. The standing staging deployment is privileged and requires SHA/backup/schema/rollback/approved public release unchanged. No unnecessary replays of older C7/P8C qualification.

**Disposition:** P8D now structurally matches runner parsing and first run will execute P1 then stop at P2 for browser execution; it is NOT an all-automatic five-step terminal-run stack.

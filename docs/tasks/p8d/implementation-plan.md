# P8D — Runner plan with browser-required manual continuation

## P5 OWNER OVERRIDE — final Phase 8 staging-first qualification (2026-10-22)

[P5](P5-multimedia-closeout.txt) is an independently MANUALLY run, real-Codex-browser + native Vega **TRUE FINAL PHASE 8** closeout at actual unchanged `0.8.17` (metadata remains parser-assigned `0.8.18`). It **replaces the canonical `docs/tasks/p8/closeout.md` only after execution**, with a detailed P8D appendix at `docs/tasks/p8d/closeout.md`. Original P8C P4 `0.8.13` NOT GREEN evidence has already been copied verbatim to `docs/tasks/p8c/closeout-2026-10-22-not-green.md`. Do not rewrite that archive or relabel old status.

Execution order is strict: (1) source/rights/operator/integrity preflight and minimum release smoke; (2) **FRESH protected staging deployment** of tested exact committed `0.8.17` candidate (even if previous current version matches), backup/schema14/rollback/old release protections; (3) **ONLY THEN** real owner Codex browser + native device acceptance across ALL Phase 8 waves; (4) up to **EIGHT targeted observed correction cycles R1–R8**, EACH: diagnose → local patch + focused safety tests → commit unchanged `0.8.17` → new hashed archived package → guarded backup/redeploy → fresh active source/JS/CSS readback → **then** staging browser/native retest; (5) one final aggregate `npm run test` on exact final source, with any post-aggregate code fix requiring another counted redeploy/retest; (6) final canonical Phase 8 report with independent gate statuses and P9 handoff. If physical Vega device remains down or owner/rights gates cannot pass, final report is NOT GREEN rather than fabricated. Eight cycles are a CAP, not a quota, and do not expand credentials/production/AWS authority.

Earlier P5 language below describing just P8D's closeout or two repairs is superseded by this decision.

---


**2026-10-22.** Revised after the owner's explicit **convert-to-runner** decision. The prior plan's *all manual, no runner* instructions are superseded. [README](README.md) is the canonical execution guide, [design](../../design/multi-media-creator-experience.md) the functional contract and [assessment](prompt-assessment.md) the source/risk authority. P8C `docs/tasks/p8/closeout.md` stays historically NOT GREEN, but owner-deferred **for P8D entry**.

## Grammar and commit ownership

The exact parser in `scripts/codex-stack-core.mjs` accepts folder `p8d` as continuation D and calculates version offset **13** from P1 `0.8.14`. Each `.txt` must provide exactly one canonical `TASK: Phase 8 / Pn — title`, a recommended GPT-6 Sol configuration, canonical `- Browser required: yes.` or `no.`, and exactly one phrase `This prompt's assigned project version is `0.8.xx``. Exactly one filename/title pair contains `closeout` (P5).

| Step | Assigned version | Runtime boundary | Git owner / browser action |
| --- | --- | --- | --- |
| P1 Media contracts | 0.8.14 | additive optional same-book audiobook asset, metadata, old-record/installed app compatibility | **Runner-owned** commit subject `0.8.14`; browser **no** |
| P2 MP3 Audio | 0.8.15 | private durable MP3 upload, Add Audio modal, audio-player, Studio saved/owned browser | **Manual Codex** browser; exact commit subject `0.8.15` |
| P3 Book Showcase | 0.8.16 | Add Book, portrait bookshelf/detail, optional MP3 same book/shared player | **Manual Codex** browser; exact commit subject `0.8.16` |
| P4 Native & publish | 0.8.17 | mixed-media cards, native audio semantics, rights-safe immutable delivery, old-client block | **Manual Codex** browser/device; exact commit subject `0.8.17` |
| P5 TRUE Phase 8 closeout | 0.8.18 grammar only | mandatory staging-first, whole Phase 8 owner/browser+native, 8 correction/redeploy cycles maximum | **MANUAL**, canonical `docs/tasks/p8/closeout.md`, actual product **0.8.17 unchanged** |

The runner auto-commits P1 and detects subsequent manual completions by the exact single-line Git commit subjects above. For manually executed P2–P4 use `git commit -m '0.8.15'`, etc., for the product+root version checkpoint, not a descriptive subject. Evidence commits can follow with a different descriptive subject and must not overwrite exact source identity. Re-run runner between manual tasks to advance the prefix; it always stops again at the next browser=yes prompt. P5 writes the authoritative `docs/tasks/p8/closeout.md` at actual unchanged 0.8.17, plus `docs/tasks/p8d/closeout.md` as detailed media appendix, preserving the prior P8C result in its dated archive. **Do not run `--closeout` automatically**, since browser required=yes stops it.

## Preflight and P8C deferment

At prompt authoring, GitHub main root `package.json` and both `package-lock.json` root version fields are **0.8.13**. Do a fresh local HEAD/dirty/untracked/origin check and avoid reset/force/stash; runner uses `git add -A` for P1, so an untracked unrelated secret is unsafe. P8C final NOT GREEN was a **separately executed** 0.8.13 stage + aggregate with unqualified native Image Banner/Image+Text (`qemu:-1`) and smaller hero art. The owner explicitly defers those acceptance blockers, not security validation and not P8D's native device requirement. Don't rewrite P8C results.

## Ownership of tests and external proof

**P1:** contracts/catalog, ChannelSpec information vs book optional audio, publication bindings and client compatibility; old video/info/audio book fixtures must still load. Only affected tests and package typechecks; runner owns post-task Git diff, version/commit verification. No self-commit, push, browser or staging.

**P2:** video-derived secure large-file private MP3 flow, proper metadata and audio/cover rights. Add Audio UI, common listening component, owner-only private preview; Focused Studio/server/package tests, signed-in browser on staged 0.8.15. Commit exact 0.8.15 before protected rollout.

**P3:** Book Showcase no reader and no Play without audio, add optional same-book MP3 to common player; labels/rights/replacement, type-correct portrait bookshelf, owner browser save/reopen. Commit exact 0.8.16 before rollout.

**P4:** real Vega generator audio/book/film projection and one common native audio-player semantics (D-pad/Back/seek/lifecycle), matching owner/rights-approved immutable byte-range MP3, installed app Requires App Update if unsupported, no unauthorized private/CDN delivery. Commit exact 0.8.17 before rollout. Actual device proof may remain BLOCKED if current VVD fails; don't pretend local native tests replace it.

**P5:** first deploy exact committed source into protected staging (after minimum security/integrity preflight), then real owner/browser tests across Video/Export, P8B layouts, P8C editor/artwork, P8D audio/books/mixed media and real Vega device; up to EIGHT bounded diagnosed correction cycles with source commit + new SHA-verified protected redeploy BEFORE every changed-source live retest. One final aggregate `npm run test` on settled source, repeat if post-test source changes, then canonical final `docs/tasks/p8/closeout.md` and P8D appendix; preserve prior P8C historical NOT GREEN. Missing required native/security proof stays NOT GREEN; no P9 auto-entry.

## Operating guardrails

P2–P4 self-commit only because runner refuses to start a browser-required implementation; this is **not** license to self-commit P1. Each implementation changes ONLY root `package.json.version`, `package-lock.json.version` and `package-lock.json.packages[""].version` as milestone, with workspace versions unchanged. Don't repeat root full aggregate on each step; no public media without verified creator rights, no production/AWS policy/ad hoc sudo/schema15 without explicit approval. Existing standing `muffinos` deploy grant is shared-host privileged: exact source-archive SHA, retained JS/CSS smoke, encrypted backup/schema14/rollback, real owner browser, free release #1 unchanged.

The next actual command after safely syncing docs is `npm run codex:stack:validate -- p8d`, then `npm run codex:stack -- p8d`. Do not run P2 through terminal runner expecting browser execution.

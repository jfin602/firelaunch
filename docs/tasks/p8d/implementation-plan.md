# P8D — Runner plan with browser-required manual continuation

**2026-10-22.** Revised after the owner's explicit **convert-to-runner** decision. The prior plan's *all manual, no runner* instructions are superseded. [README](README.md) is the canonical execution guide, [design](../../design/multi-media-creator-experience.md) the functional contract and [assessment](prompt-assessment.md) the source/risk authority. P8C `docs/tasks/p8/closeout.md` stays historically NOT GREEN, but owner-deferred **for P8D entry**.

## Grammar and commit ownership

The exact parser in `scripts/codex-stack-core.mjs` accepts folder `p8d` as continuation D and calculates version offset **13** from P1 `0.8.14`. Each `.txt` must provide exactly one canonical `TASK: Phase 8 / Pn — title`, a recommended GPT-6 Sol configuration, canonical `- Browser required: yes.` or `no.`, and exactly one phrase `This prompt's assigned project version is `0.8.xx``. Exactly one filename/title pair contains `closeout` (P5).

| Step | Assigned version | Runtime boundary | Git owner / browser action |
| --- | --- | --- | --- |
| P1 Media contracts | 0.8.14 | additive optional same-book audiobook asset, metadata, old-record/installed app compatibility | **Runner-owned** commit subject `0.8.14`; browser **no** |
| P2 MP3 Audio | 0.8.15 | private durable MP3 upload, Add Audio modal, audio-player, Studio saved/owned browser | **Manual Codex** browser; exact commit subject `0.8.15` |
| P3 Book Showcase | 0.8.16 | Add Book, portrait bookshelf/detail, optional MP3 same book/shared player | **Manual Codex** browser; exact commit subject `0.8.16` |
| P4 Native & publish | 0.8.17 | mixed-media cards, native audio semantics, rights-safe immutable delivery, old-client block | **Manual Codex** browser/device; exact commit subject `0.8.17` |
| P5 closeout | 0.8.18 assigned only | one final aggregate + owner browser + real Vega audio/book | **MANUAL** closeout, actual project version **0.8.17 unchanged** |

The runner auto-commits P1 and detects subsequent manual completions by the exact single-line Git commit subjects above. For manually executed P2–P4 use `git commit -m '0.8.15'`, etc., for the product+root version checkpoint, not a descriptive subject. Evidence commits can follow with a different descriptive subject and must not overwrite exact source identity. Re-run runner between manual tasks to advance the prefix; it always stops again at the next browser=yes prompt. P5 writes `docs/tasks/p8d/closeout.md` at unchanged 0.8.17. **Do not run `--closeout` automatically**, since browser required=yes stops it.

## Preflight and P8C deferment

At prompt authoring, GitHub main root `package.json` and both `package-lock.json` root version fields are **0.8.13**. Do a fresh local HEAD/dirty/untracked/origin check and avoid reset/force/stash; runner uses `git add -A` for P1, so an untracked unrelated secret is unsafe. P8C final NOT GREEN was a **separately executed** 0.8.13 stage + aggregate with unqualified native Image Banner/Image+Text (`qemu:-1`) and smaller hero art. The owner explicitly defers those acceptance blockers, not security validation and not P8D's native device requirement. Don't rewrite P8C results.

## Ownership of tests and external proof

**P1:** contracts/catalog, ChannelSpec information vs book optional audio, publication bindings and client compatibility; old video/info/audio book fixtures must still load. Only affected tests and package typechecks; runner owns post-task Git diff, version/commit verification. No self-commit, push, browser or staging.

**P2:** video-derived secure large-file private MP3 flow, proper metadata and audio/cover rights. Add Audio UI, common listening component, owner-only private preview; Focused Studio/server/package tests, signed-in browser on staged 0.8.15. Commit exact 0.8.15 before protected rollout.

**P3:** Book Showcase no reader and no Play without audio, add optional same-book MP3 to common player; labels/rights/replacement, type-correct portrait bookshelf, owner browser save/reopen. Commit exact 0.8.16 before rollout.

**P4:** real Vega generator audio/book/film projection and one common native audio-player semantics (D-pad/Back/seek/lifecycle), matching owner/rights-approved immutable byte-range MP3, installed app Requires App Update if unsupported, no unauthorized private/CDN delivery. Commit exact 0.8.17 before rollout. Actual device proof may remain BLOCKED if current VVD fails; don't pretend local native tests replace it.

**P5:** one `npm run test` (already builds/typechecks), final active committed source vs stage, one real owner audio/book/mixed-media journey, actual rights-safe Vega package/audio+book device screenshot/log/audible seek and Back, original public release #1 unchanged and exact external statuses. Record GREEN/NOT GREEN, separate deferred P8C debts without requalifying them. No Phase 9 auto-entry.

## Operating guardrails

P2–P4 self-commit only because runner refuses to start a browser-required implementation; this is **not** license to self-commit P1. Each implementation changes ONLY root `package.json.version`, `package-lock.json.version` and `package-lock.json.packages[""].version` as milestone, with workspace versions unchanged. Don't repeat root full aggregate on each step; no public media without verified creator rights, no production/AWS policy/ad hoc sudo/schema15 without explicit approval. Existing standing `muffinos` deploy grant is shared-host privileged: exact source-archive SHA, retained JS/CSS smoke, encrypted backup/schema14/rollback, real owner browser, free release #1 unchanged.

The next actual command after safely syncing docs is `npm run codex:stack:validate -- p8d`, then `npm run codex:stack -- p8d`. Do not run P2 through terminal runner expecting browser execution.

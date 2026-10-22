# P8D — Multi-Media Creator Support

**2026-10-22 — RUNNER-COMPATIBLE PROMPTS AUTHORED, PRODUCT WORK NOT STARTED.** Owner converted P8D from the originally authored all-manual stack to the checked-in FireLaunch runner workflow. **P1 can start now from a coherent, clean root/lock 0.8.13 checkout**. [P8C historical closeout](../p8/closeout.md) remains **NOT GREEN**, but the owner explicitly DEFERS its Vega static-layout and hero artwork acceptance as P8D ENTRY gates; do not erase it or claim the failures passed.

[Multi-media design](../../design/multi-media-creator-experience.md) · [Assessment](prompt-assessment.md) · [Implementation plan](implementation-plan.md) · [Current state](../../CURRENT-STATE.md)

## Runner plan and manual browser handoffs

| Prompt | Assigned grammar version | Browser metadata | Actual execution/commit owner |
| --- | --- | --- | --- |
| [P1 — Contracts](P1-media-contracts.txt) | **0.8.14** | **no.** | **RUNNER** executes + commits subject `0.8.14` |
| [P2 — Audio](P2-audio-workflow.txt) | **0.8.15** | **yes.** | Runner **STOPS**; manual Codex browser implements + commits exact subject `0.8.15` |
| [P3 — Books](P3-book-showcase.txt) | **0.8.16** | **yes.** | Runner **STOPS**; manual Codex browser implements + commits exact subject `0.8.16` |
| [P4 — Mixed Native](P4-native-mixed-media.txt) | **0.8.17** | **yes.** | Runner **STOPS**; manual Codex browser implements + commits exact subject `0.8.17` |
| [P5 — Independent closeout](P5-multimedia-closeout.txt) | **0.8.18 proposed metadata ONLY** | **yes.** | MANUAL browser/device closeout at **unchanged actual 0.8.17**; commits evidence only |

**Why P5 has 0.8.18 metadata:** the checked-in continuation parser requires P1–P5 assigned versions to increase sequentially. Like P8B's independently executed closeout, the final prompt's assigned grammar slot **does not authorize a product version bump**; P5 records exact accepted 0.8.17 source and leaves root/lock unchanged.

### How to execute

1. Safely synchronize checked-in prompt updates, inspect real `git status --short`, HEAD/origin and root `package.json.version` plus two root `package-lock.json` version fields; require coherent 0.8.13. P8C NOT GREEN is intentionally **not a blocker**. Do not reset/stash/force-overwrite unrelated work.
2. Execute **`npm run codex:stack:validate -- p8d`** followed by **`npm run codex:stack -- p8d`**. The CLI runs **P1 only**, validates the 0.8.14 source, then automatically commits P1 with subject `0.8.14`. **P1 must not self-commit, push, deploy or run a browser.** Runner's commit staging is `git add -A`, so do not leave secrets/unrelated files untracked.
3. The runner next reports **P2 browser execution required**. This is an INTENDED safe stop, not another grammar failure. Invoke [P2](P2-audio-workflow.txt) manually in Codex with its real connected browser. Its agent self-commits the accepted SOURCE and 0.8.15 package/lock version with **exact Git subject `0.8.15`** (and may add a separate descriptive evidence commit). Do not use a different source commit subject or the runner will not recognize it.
4. Rerun **`npm run codex:stack -- p8d`** after P2's exact subject is reachable and root+lock are at 0.8.15. It recognizes P1/P2 as previously completed and **stops at P3**. Manually run P3, self-commit exact `0.8.16`, repeat runner for P4, manually run P4, self-commit exact `0.8.17`, then rerun runner for completed-prefix/handoff.
5. P5 is the **only manual final closeout**. Run P5 independently using real browser + Vega VirtualDevice; report `docs/tasks/p8d/closeout.md` GREEN/NOT GREEN and make a descriptive evidence-only commit. Do not bump to 0.8.18 or activate P9; do not use `--closeout` as a substitute for its required browser.

If P2/P3/P4 is NOT GREEN, source/target version is inconsistent, staged candidate unqualified, or expected version marker absent, **STOP with an accurate handoff** instead of manufacturing a marker to advance runner. The runner can resume only from genuine Git-proven completion.

## Product scope

- **Video Watch:** preserve existing working Add Video / HLS.
- **Audio Listen:** first-class Add Audio MP3 upload, artist/album or playlist, rights/cover, one common audio-player transport in Studio/native.
- **Book Showcase:** Add Book with portrait cover, title/author/synopsis/bookshelf and **optional MP3 audiobook attached to the SAME book CatalogItem**. No separate audiobook catalog entry; no Play for book-only. Optional Listen launches the SAME shared audio player. No EPUB/PDF/TV reader.
- **Mixed Channel:** one ChannelSpec and TV engine, type-aware native cards/details, protected immutable release, compatibility guard so old installed applications **Requires App Update / Blocked** for unsupported new audio/book capability.

## Safety, evidence and acceptance

P1 gets only affected source tests/typechecks, not the full root aggregate. P2–P4 use Codex browser debugging for actual signed-in `https://firelaunch.jfin.dev/` after guarded staging deployment as needed. The [standing staging runbook](../../../scripts/staging/README.md) requires source commit, exact SHA-256, protected backup/schema14/rollback and preserved FREE release #1; no automatic AWS/IAM/CDN policy or production changes. Missing privileges/device/approved media mean NOT QUALIFIED, never workaround permissions.

P5 owns ONE final `npm run test`, real signed-in creator workflow and **actual native Vega VirtualDevice** audio/book proof, separate scoped GREEN/NOT GREEN, historical P8C deferred debt recorded unchanged. A browser-preview MP3 is not native Vega playback proof.

**Deadline context:** Oct 23 noon America/Chicago was the previous video-MVP target. P8D is expanded scope and not retroactively declared delivered.

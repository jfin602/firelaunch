# C8-UI — TV-First Channel Workspace Correction AFTER P8B

**Owner correction 2026-10-21: P8B ALREADY RAN LOCALLY.** This fixed-version correction repairs the **completed P8B Channel UI**, rather than modifying, restarting, or inserting work before P8B. [TV-first design](../../design/tv-first-channel-workspace.md) is the new target; [assessment](prompt-assessment.md) and [implementation plan](implementation-plan.md) bind execution. **OPTIMIZED AGAINST THE PUSHED SOURCE; NOT YET IMPLEMENTED OR QUALIFIED.** Overall Phase 8 remains OPEN.

## Verified source/version and P8B disposition

**GitHub main at assessment: `be91bb8`, root and both top-level lockfile versions `0.8.10` — VERIFIED.** P8B P1–P6 commits are present. [P8B P7 Wave 2 closeout](../p8b/wave2-closeout.md) is **NOT GREEN / NOT DEPLOYED**: disposable local UI tests and full aggregate passed, but the owner-authenticated candidate, new static-layout Vega device proof and protected staging rollout remain unqualified. **Staging still ran Wave 1 `0.8.4` at that dated inspection**, not 0.8.10.

**c8-ui is a correction of the pushed 0.8.10 UI**, not a rewrite of P8B or a new version. Inspect the current local git status and reconcile any later dirty source safely before running; don't reset/stash/force-pull or overwrite P8B. All c8-ui prompts require unchanged 0.8.10. Do not rerun P8B P7's old native parity/authenticated workflow as a prerequisite for UI corrections.


## What the owner wants fixed

The owner's actual screenshot shows a small TV beside a long right editing form, unstyled top tabs, a Close TV Preview button, and excessive scrolling/unused space. Make the completed P8B Channel workspace **TV-first**:

- **Standard Channel:** The **same real interactive 16:9 Preview** fills the upper stage. An attached full-width, height-allocated **bottom editing dock** directly meets its edge with zero gap. Use height-first sizing (roughly 60–65% top and 35–40% dock where practical), preserving aspect without filling all vertical space. Use dock width for horizontal Pages, Sections and selected Properties with only contained panel scrolling on short screens.
- **Creator-facing dock tabs:** **Pages & Layout** and **Appearance** only. Remove AI Assistant and any stale shortcuts from Channel UI, without deleting agent backend. Remove Close TV Preview; the TV is ALWAYS ON. **Full Screen** is the sole Preview display toggle.
- **True Full Screen:** The SAME P8B Preview and dock instance go into the fullscreen element. Dock overlays the TV when pointer nears the bottom edge and slides up, stays visible while hovered/focused/editing, hides when idle, and works with touch handle/swipe plus keyboard control. Esc = Exit; TV Back is separate. No duplicated page editor/player, no P8B functional regression.
- **Preservation:** Keep already-implemented P8B Hero/Grid/Rows templates, human-first page creation and section editing, Image Banner/Image + Text, validated rights, native Vega/static compatibility and current fullscreen behavior. This correction is a **layout/interface repair**, not a new Page Layout feature stack or runtime rewrite.

## Four sequential prompts — verified source version `0.8.10`

| Prompt | Mode | Responsibility |
| --- | --- | --- |
| [P1 — Always-on Preview](P1-always-on-channel-preview.txt) | Sol Medium, runner | Correct actual post-P8B Channel mount/tabs; remove AI/Close Preview |
| [P2 — Horizontal dock](P2-horizontal-editing-dock.txt) | Sol Medium, runner | Compose actual finished P8B editor into attached bottom dock with usable scrolling |
| [P3 — Fullscreen edge dock](P3-fullscreen-edge-dock.txt) | Sol High, runner | Repair/extend existing P8B fullscreen, bottom-edge reveal, keyboard/touch |
| [P4 — Staging + combined Wave 2 closeout](P4-tv-first-closeout.txt) | Sol High, **manual browser** | One final aggregate, required protected staging rollout, final signed-in UI tests on staging, close outstanding P8B Wave 2 gates |

P1–P3 are runner-owned implementation commits. P4 is the **exactly one final closeout-type prompt**, browser-required/manual; evidence file `docs/tasks/c8-ui/closeout.md` only after observation. Correcting this UI does not close Phase 8.

## Safe execution

1. Fetch current GitHub main or safely reconcile the local checkout. Verify `git status --short`, HEAD and all three root/lock version fields **0.8.10**, with P8B implementation history intact. A dirty local tree needs explicit reconciliation; it is never reset, force-pulled or silently overwritten.
2. Run `npm run codex:stack:validate -- c8-ui` then `npm run codex:stack -- c8-ui`. The runner executes **P1–P3**, all keeping 0.8.10, and stops before P4 for independent browser acceptance. No `/activate`. Focused Studio tests/typecheck only in P1–P3, one aggregate and real browser in P4.
3. **P4 is the shared staging closeout.** After the correction passes predeploy tests, its next goal is a protected staging rollout with exact-hash operator approval, followed by final signed-in creator UI tests on THAT deployed release. It also seeks the outstanding P8B Wave 2 native static-section device evidence, reusing prior local passes. Report UI, DEPLOYED/NOT DEPLOYED and P8B Wave 2 separately; preserve historical P8B P7 NOT GREEN and issue a dated follow-on only for new proved results. No staging action without a reviewed exact-hash operator grant, backup and rollback.
4. P8B Hero/Grid/Rows, static sections, selected-page synchronization, draft persistence, owner rights, native renderer/compatibility guard and already-tested Preview fullscreen behavior remain protected. No changes to P8B prompt files or original Wave 1 P5.


**Owner deadline:** October 23, 2026 noon America/Chicago; preserve already implemented functionality above speculative redesign.

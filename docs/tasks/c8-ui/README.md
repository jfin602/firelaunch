# C8-UI — TV-First Channel Workspace Correction AFTER P8B

**Owner correction 2026-10-21: P8B ALREADY RAN LOCALLY.** This fixed-version correction repairs the **completed P8B Channel UI**, rather than modifying, restarting, or inserting work before P8B. [TV-first design](../../design/tv-first-channel-workspace.md) is the new target; [assessment](prompt-assessment.md) and [implementation plan](implementation-plan.md) bind execution. **AUTHORED ONLY / NOT IMPLEMENTED OR QUALIFIED.** Overall Phase 8 remains OPEN.

## Source/version reality

At documentation review, GitHub `main` still reported root/lock `0.8.4` and P8B prompts *authored*. **The owner explicitly states P8B has already executed on their local checkout.** The authored P8B P6 implementation targets `0.8.10`; therefore every c8-ui prompt declares **Required unchanged project version: `0.8.10`** as the **expected** post-P8B source version, not a claim verified against the laptop. Check actual `git status --short`, HEAD, P8B P1–P6 commit history, any P7 manual closeout, and root + two lockfile versions BEFORE RUNNING. If P8B actually ended at `0.8.11` or otherwise differs, **STOP, reconcile c8-ui fixed-version metadata with exact proven local state before starting**; don't downgrade, reset or overwrite any P8B work. Never make a separate version-entry bump for this correction.

## What the owner wants fixed

The owner's actual screenshot shows a small TV beside a long right editing form, unstyled top tabs, a Close TV Preview button, and excessive scrolling/unused space. Make the completed P8B Channel workspace **TV-first**:

- **Standard Channel:** The **same real interactive 16:9 Preview** fills the upper stage. An attached full-width, height-allocated **bottom editing dock** directly meets its edge with zero gap. Use height-first sizing (roughly 60–65% top and 35–40% dock where practical), preserving aspect without filling all vertical space. Use dock width for horizontal Pages, Sections and selected Properties with only contained panel scrolling on short screens.
- **Creator-facing dock tabs:** **Pages & Layout** and **Appearance** only. Remove AI Assistant and any stale shortcuts from Channel UI, without deleting agent backend. Remove Close TV Preview; the TV is ALWAYS ON. **Full Screen** is the sole Preview display toggle.
- **True Full Screen:** The SAME P8B Preview and dock instance go into the fullscreen element. Dock overlays the TV when pointer nears the bottom edge and slides up, stays visible while hovered/focused/editing, hides when idle, and works with touch handle/swipe plus keyboard control. Esc = Exit; TV Back is separate. No duplicated page editor/player, no P8B functional regression.
- **Preservation:** Keep already-implemented P8B Hero/Grid/Rows templates, human-first page creation and section editing, Image Banner/Image + Text, validated rights, native Vega/static compatibility and current fullscreen behavior. This correction is a **layout/interface repair**, not a new Page Layout feature stack or runtime rewrite.

## Four sequential prompts — unchanged expected `0.8.10`

| Prompt | Mode | Responsibility |
| --- | --- | --- |
| [P1 — Always-on Preview](P1-always-on-channel-preview.txt) | Sol Medium, runner | Correct actual post-P8B Channel mount/tabs; remove AI/Close Preview |
| [P2 — Horizontal dock](P2-horizontal-editing-dock.txt) | Sol Medium, runner | Compose actual finished P8B editor into attached bottom dock with usable scrolling |
| [P3 — Fullscreen edge dock](P3-fullscreen-edge-dock.txt) | Sol High, runner | Repair/extend existing P8B fullscreen, bottom-edge reveal, keyboard/touch |
| [P4 — Independent closeout](P4-tv-first-closeout.txt) | Sol High, **manual browser** | Real creator testing, one final aggregate, protected staged deployment if authorized |

P1–P3 are runner-owned implementation commits. P4 is the **exactly one final closeout-type prompt**, browser-required/manual; evidence file `docs/tasks/c8-ui/closeout.md` only after observation. Correcting this UI does not close Phase 8.

## Safe execution

1. Start from **owner's actual completed P8B source** and ensure pending P7/P8B edits are safe. GitHub's stale 0.8.4 HEAD cannot be pulled over completed local implementation without an explicit conflict-free sync. No resetting, forced pull, deleting, stashing without consent, reordering completed prompts or editing existing P8B files.
2. Verify root package and both lockfile version fields exactly equal **0.8.10** with completed P8B P6 commit prefix. If not, STOP; retarget this correction's required unchanged version to the actual proven baseline and revalidate. Do not use c8-ui to jump versions.
3. Run `npm run codex:stack:validate -- c8-ui`, then `npm run codex:stack -- c8-ui`. Runner handles P1–P3 and stops at browser P4. No `/activate`; P1–P3 run focused Studio tests/typecheck, P4 owns one aggregate and real browser.
4. Any protected staging deployment requires exact approved source archive, existing operator permissions, backup, retained hashed assets and rollback. No AWS/MediaConvert/public release changes for this UI correction. Reuse prior Wave 1 and C7 GREEN evidence for unchanged systems.

**Owner deadline:** October 23, 2026 noon America/Chicago; preserve already implemented functionality above speculative redesign.

# C8-UI — TV-First Channel Workspace Correction

**Status (2026-10-21): OWNER-APPROVED /docs-review APPLIED; ASSESSMENT, PLAN AND FOUR PROMPTS AUTHORED. NOT IMPLEMENTED OR QUALIFIED.** This is a **fixed-version 0.8.4 correction** to Wave 1's Channel shell, intended to run **BEFORE** the already-authored `p8b` (Phase 8 Wave 2) on a safely reconciled local checkout. Phase 8 remains OPEN; do not rewrite Wave 1 P5 or launch Phase 9.

## Owner-observed issue and canonical UX

[TV-first layout design contract](../../design/tv-first-channel-workspace.md) supersedes earlier side-by-side Preview/form layout suggestions. The owner screenshot shows a squashed TV next to a tall technical form, unstyled AI Assistant / Appearance / Pages & Shelves buttons, a Close TV Preview button, and avoidable document scrolling.

**Canonical Channel:** always-on **16:9 interactive TV stage ABOVE a full-width attached editing dock**, no gap. Stage height fits the viewport while leaving a usable bottom dock (about 60–65% stage / 35–40% dock when possible, explicit minimum and safe letterboxing). **Dock tabs:** Pages & Layout and Appearance, properly styled and keyboard accessible; no user-facing AI Assistant or Close TV Preview. Normal Channel uses only one control to enter **Full Screen**. Long controls can scroll **inside** the dock, but entire Channel should not normally scroll at desktop.

**True fullscreen:** same TV Preview instance; editing dock becomes a bottom-edge reveal overlay on hover near the bottom, with touch handle/gesture and keyboard access; remains open while focused/actively editing. Fullscreen element owns both TV and dock, preserving TV navigation/playback, unsaved form edits and return focus. Escape exits fullscreen while TV Back is a separate control. No new TV renderer or second editor.

## Correction stack

| Prompt | Model | Browser | Scope |
| --- | --- | --- | --- |
| [P1 always-on Preview](P1-always-on-channel-preview.txt) | GPT-6 Sol Medium | no | Show single TV by default, remove AI/Close Preview, preserve real Channel routes |
| [P2 horizontal dock](P2-horizontal-editing-dock.txt) | GPT-6 Sol Medium | no | Height-first top stage and attached two-tab, horizontally usable editor dock |
| [P3 fullscreen reveal](P3-fullscreen-edge-dock.txt) | GPT-6 Sol High | no | Same-instance fullscreen + pointer/touch/keyboard edge-reveal overlay |
| [P4 manual closeout](P4-tv-first-closeout.txt) | GPT-6 Sol High | **yes** | Real browser UX, one aggregate, optional protected staging if operator-authorized; evidence |

[Prompt assessment](prompt-assessment.md) and [implementation plan](implementation-plan.md) bind the scope. P1–P3 are runner-owned commits; P4 is exactly one final manual browser-required correction closeout. All P1–P4 declare **unchanged root/version 0.8.4**; no package or lockfile bump, no `/activate` step. `c8-ui` closes only its own correction, not P8.

## Safe execution ordering

1. Inspect **actual local** `git status --short`, HEAD, `package.json` + two top-level `package-lock.json` version fields, staged/dirty P5 changes and whether **p8b already started**. At authoring GitHub main was version 0.8.4, P8B prompts authored not run. That does not prove a local checkout.
2. **If local p8b has already committed P1 or advanced beyond 0.8.4, STOP**. Never reset/reorder finished sequential prompt stacks or run an older fixed-version correction over work. Instead plan a narrow correction against the newer actual HEAD.
3. On a clean, coherent 0.8.4 source checkout, run `npm run codex:stack:validate -- c8-ui` then `npm run codex:stack -- c8-ui`. Runner executes P1–P3 and stops at P4. Use focused Studio tests/one package typecheck per implementation; P4 owns one aggregate and independent browser smoke.
4. After c8-ui qualifies, `p8b` P1 (0.8.5) starts from the corrected **still-0.8.4** version and builds page templates/new static sections INTO this dock. P8B P2/P3/P6 must not reconstruct an obsolete side panel or second fullscreen preview.

**Safety:** Reuse Wave 1 GREEN/staging and C7 R4 native playback evidence for untouched paths; no new hosted publication, MediaConvert, native worker/ZIP, cloud privileges or schema14 change to fix Studio layout. Protected staging deploy requires specific live operator authority and rollback, never assumed. Keep deadline Friday Oct 23 noon America/Chicago.

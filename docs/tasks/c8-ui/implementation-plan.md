# C8-UI — Implementation plan: TV-first Channel composition

**Planning/authoring only, 2026-10-21.** [Design authority](../../design/tv-first-channel-workspace.md) and [assessment](prompt-assessment.md). **P8B already ran locally per owner; this is a follow-on correction.** The authored P8B P6 implementation ends at root/lock **0.8.10**, expected correction version. GitHub main still showed 0.8.4 at review, so actual local worktree, completed prompt history, root+two lockfile fields and hosted state must be independently verified before execution. No implementation/deployment/phase closure from this plan.

## Prompt and validation owners

| Prompt | Source boundary | Acceptance | Focused tests |
| --- | --- | --- | --- |
| [P1](P1-always-on-channel-preview.txt) | `apps/studio/src/App.tsx`, home/catalog redirects, Channel view and Preview mount | Default real 16:9 TV always visible; only Pages & Layout + Appearance tabs; no AI/Close Preview | Channel routing, single Preview and focus preservation |
| [P2](P2-horizontal-editing-dock.txt) | Channel composition, `style.css`, Content/Design presentation | Height-first top stage/bottom attached horizontal tabbed dock, compact usable scroll containment and editor form | Responsive DOM/dock/tab/focus/save |
| [P3](P3-fullscreen-edge-dock.txt) | Same Preview+Dock container, Fullscreen API/overlay, keyboard/touch | Fullscreen TV with edge-hover slide-up SAME dock and accessible touch/keyboard reveal; Back distinct from Exit | Fullscreen state, fallback, hover/focus, retained TV/playback |
| [P4](P4-tv-first-closeout.txt) | Independent actual browser and evidence; optionally protected staging | One creator journey, one final build-backed aggregate, truthful GREEN/NOT GREEN and rollout | Browser desktop plus brief tablet/mobile |

All prompts use correction **`0.8.10` unchanged** (expected after completed P8B P6; fail closed and reconcile if actual local version differs); **P1–P3 runner-owned commits**, **P4 manual browser closeout**, one closeout file `docs/tasks/c8-ui/closeout.md` only after evidence. A successful correction does **not** close Phase 8/Wave 2; `p8b` P1–P7 remains a future sequential continuation starting 0.8.5 only after a coherent completed correction and safe worktree.

## Entry and constraints

1. **P8B ALREADY RAN LOCALLY. Preserve it.** Inspect current `git status --short`, local HEAD, P8B P1–P6 runner implementation commits, any P7 manual changes, actual root+two lockfile versions and current App/Preview/Layout source. Older GitHub 0.8.4 snapshots are *not* the implementation target. The correction expects **unchanged 0.8.10** after P8B P6; if current version is 0.8.11 or otherwise differs, **STOP** and update c8-ui's fixed-version metadata only after confirming exact local version. Do not reset/rebase/stash/force-pull or overwrite P8B work.
2. Reuse the completed Page Layout editor, Hero/Grid/Rows, bounded static image/text modules, validated ownership, existing Fullscreen Preview and native parity. This correction **recomposes their UI** into top TV plus bottom dock, not a new page system, native renderer, or agent infrastructure rewrite. P8B prompt files and original Wave 1 P5 must remain untouched.
3. After the actual local version and provenance match correction metadata, run `npm run codex:stack:validate -- c8-ui` followed by `npm run codex:stack -- c8-ui`. Correction commits do **not** bump root version; runner stops before browser-required P4. No `/activate`.


## P1 — UI shell ownership

Inspect the **P8B-completed** Channel shell and adapt its existing Preview lifecycle: default TV visible always, remove any remaining Close TV Preview/TV Preview visibility control. Two creator-facing tabs **Pages & Layout** and **Appearance**, Pages & Layout default; remove residual AI Assistant tab/redirects. Preserve P8B template/page/module editor and fullscreen state; do not recreate them. Preserve Preview state on tab selection, project switch isolation, rights and virtual remote. Do not rewrite provider infrastructure or implement new p8b templates/static section types. P2 owns dock composition.

## P2 — Top TV and attached bottom dock

Use the P8B-completed Channel workspace and give it viewport-based height under topbar. TV stage uses 16:9 `min(stageWidth,stageHeight*16/9)`, at most approximately 60–65% height subject to dock minimum ~240–280px; leave no physical gap. Dock spans workspace width and owns tabs, accessible page/section/selected editor content in compact horizontal columns. Retain functional **completed P8B** page templates/static sections and Appearance controls, but reduce unnecessary vertical form stacking and keep tab content within contained scroll panels on short screens. No document-level scrolling on normal laptop desktop; on mobile use dock focused subpanels/bottom sheet. Avoid empty right rail. Page editing through dock not by clicking playable TV. Design tokens stay calm Desert Heat.

## P3 — True full screen + bottom-edge dock

**Repair/enhance the existing P8B fullscreen behavior** using the same mounted `Preview` and same dock component under one fullscreen parent, not a portal outside native fullscreen. `requestFullscreen` from user interaction, handle exit/fullscreenchange and rejection with accessible viewport-filling fallback. Overlay dock slides up when pointer approaches bottom ~32–40px, stays open while hovered/focused/editing, hides gently when idle, supports touch handle/swipe and keyboard reveal; no hover-only access. Escape exits fullscreen, while Backspace/virtual remote controls TV Back without eating textfield keys; restore focus/scroll and no remount/playback reset on transition. Respect prefers-reduced-motion and browser fullscreen constraints.

## P4 — Independent manual closeout

One actual signed-in creator journey (normal Channel TV and dock tabs, Pages editor + Appearance save, D-pad/Back, full screen entry and pointer/touch/keyboard edge reveal, exit returns intact) plus brief 1440/1280 desktop, tablet, phone spot checks for bounded scrolling. Focused tests for any fixes, then one root `npm run test` on exact final tree (already builds/typechecks packages), stack validation, diff. Reuse unchanged C7/Wave 1 proofs; no new native package or paid encode. Document specific blockers and screenshots only when captured. If separately valid authorization and protected staging release scripts accessible, may deploy only qualified exact SHA to existing VPS with backup, retained assets, signed-in fresh-tab smoke and safe rollback; otherwise mark NOT DEPLOYED without false GREEN. Record `docs/tasks/c8-ui/closeout.md` and hand off to p8b with unchanged 0.8.10.

## Stop conditions

Never weaken CSRF/ownership or display unapproved media. Preserve saved page/appearance drafts, published release #1, schema14, worker separation, backups, old app compatibility and the original P8 Wave 1 closeout. A native browser Preview visual pass is not native Vega or Amazon qualification. Maintain <=8 minute goal per implementation prompt, 15 minute stop, scoped tests; do not repeat global builds in P1–P3.
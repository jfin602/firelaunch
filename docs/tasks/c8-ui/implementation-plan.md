# C8-UI — Implementation plan: TV-first Channel composition

**Planning/authoring only, 2026-10-21.** [Design authority](../../design/tv-first-channel-workspace.md) and [assessment](prompt-assessment.md). Based on GitHub `main` root+two lockfields **0.8.4**; local worktree, runner history and hosted stage must be independently checked. No implementation/deployment/phase closure from this plan.

## Prompt and validation owners

| Prompt | Source boundary | Acceptance | Focused tests |
| --- | --- | --- | --- |
| [P1](P1-always-on-channel-preview.txt) | `apps/studio/src/App.tsx`, home/catalog redirects, Channel view and Preview mount | Default real 16:9 TV always visible; only Pages & Layout + Appearance tabs; no AI/Close Preview | Channel routing, single Preview and focus preservation |
| [P2](P2-horizontal-editing-dock.txt) | Channel composition, `style.css`, Content/Design presentation | Height-first top stage/bottom attached horizontal tabbed dock, compact usable scroll containment and editor form | Responsive DOM/dock/tab/focus/save |
| [P3](P3-fullscreen-edge-dock.txt) | Same Preview+Dock container, Fullscreen API/overlay, keyboard/touch | Fullscreen TV with edge-hover slide-up SAME dock and accessible touch/keyboard reveal; Back distinct from Exit | Fullscreen state, fallback, hover/focus, retained TV/playback |
| [P4](P4-tv-first-closeout.txt) | Independent actual browser and evidence; optionally protected staging | One creator journey, one final build-backed aggregate, truthful GREEN/NOT GREEN and rollout | Browser desktop plus brief tablet/mobile |

All prompts use correction `0.8.4` unchanged; **P1–P3 runner-owned commits**, **P4 manual browser closeout**, one closeout file `docs/tasks/c8-ui/closeout.md` only after evidence. A successful correction does **not** close Phase 8/Wave 2; `p8b` P1–P7 remains a future sequential continuation starting 0.8.5 only after a coherent completed correction and safe worktree.

## Entry and constraints

1. Inspect local `git status --short`, HEAD, root+two lockfile version fields and whether `p8b` has already executed. If >0.8.4, any conflicting dirty work or completed P8B stack: STOP, preserve data and hand off a new bounded correction plan; do not reset, reorder or overwrite.
2. Read the latest P8 Wave 1 closeout and its protected release, C7 R4 evidence and owner scope. Reuse real Preview, Style tokens, existing Content/Appearance business mutation logic, not another editor or renderer. `AI Assistant` removal is UI only, not backend deletion.
3. Validate grammar via `npm run codex:stack:validate -- c8-ui`, then `npm run codex:stack -- c8-ui`. Corrections commit WITHOUT version updates. Runner owns git/version and commit. Stop before P4 because Browser required yes.

## P1 — UI shell ownership

Always mount one `Preview` for Channel on initial navigation, not conditional on `previewOpen`; remove the Close TV Preview/TV Preview toggle. Restrict subview tabs to **Pages & Layout** and **Appearance**, default to Pages & Layout; change Home/Catalog/new-channel routes and in-app UI labels so no dead AI tab remains. Preserve Preview state on tab selection, project switch isolation, rights and virtual remote. Do not rewrite provider infrastructure or implement new p8b templates/static section types. P2 owns dock composition.

## P2 — Top TV and attached bottom dock

Give Channel workspace viewport-based height under topbar. TV stage uses 16:9 `min(stageWidth,stageHeight*16/9)`, at most approximately 60–65% height subject to dock minimum ~240–280px; leave no physical gap. Dock spans workspace width and owns tabs, accessible page/section/selected editor content in compact horizontal columns. Retain functional old modules and Appearance controls, but reduce unnecessary vertical form stacking and keep tab content within contained scroll panels on short screens. No document-level scrolling on normal laptop desktop; on mobile use dock focused subpanels/bottom sheet. Avoid empty right rail. Page editing through dock not by clicking playable TV. Design tokens stay calm Desert Heat.

## P3 — True full screen + bottom-edge dock

Use same mounted `Preview` and same dock component under one fullscreen parent, not a portal outside native fullscreen. `requestFullscreen` from user interaction, handle exit/fullscreenchange and rejection with accessible viewport-filling fallback. Overlay dock slides up when pointer approaches bottom ~32–40px, stays open while hovered/focused/editing, hides gently when idle, supports touch handle/swipe and keyboard reveal; no hover-only access. Escape exits fullscreen, while Backspace/virtual remote controls TV Back without eating textfield keys; restore focus/scroll and no remount/playback reset on transition. Respect prefers-reduced-motion and browser fullscreen constraints.

## P4 — Independent manual closeout

One actual signed-in creator journey (normal Channel TV and dock tabs, Pages editor + Appearance save, D-pad/Back, full screen entry and pointer/touch/keyboard edge reveal, exit returns intact) plus brief 1440/1280 desktop, tablet, phone spot checks for bounded scrolling. Focused tests for any fixes, then one root `npm run test` on exact final tree (already builds/typechecks packages), stack validation, diff. Reuse unchanged C7/Wave 1 proofs; no new native package or paid encode. Document specific blockers and screenshots only when captured. If separately valid authorization and protected staging release scripts accessible, may deploy only qualified exact SHA to existing VPS with backup, retained assets, signed-in fresh-tab smoke and safe rollback; otherwise mark NOT DEPLOYED without false GREEN. Record `docs/tasks/c8-ui/closeout.md` and hand off to p8b with unchanged 0.8.4.

## Stop conditions

Never weaken CSRF/ownership or display unapproved media. Preserve saved page/appearance drafts, published release #1, schema14, worker separation, backups, old app compatibility and the original P8 Wave 1 closeout. A native browser Preview visual pass is not native Vega or Amazon qualification. Maintain <=8 minute goal per implementation prompt, 15 minute stop, scoped tests; do not repeat global builds in P1–P3.
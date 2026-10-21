# C8-UI3 — Prompt Assessment: Seamless Gray Channel Shell and Borderless TV

**2026-10-21; documentation and prompt authoring ONLY.** New owner-approved [exact visual contract](../../design/channel-preview-final-composition.md). The latest mockup must be **attached by the owner to the relevant Codex implementation and closeout messages**; it is not an asset in the repo. The correction is on top of committed c8-ui2 P1–P3, not a rerun of prior runner stacks.

## Verified source and risk

- At review, GitHub `main` `8c49aae` holds the committed [c8-ui2 P3 fullscreen-left drawer] source; root `package.json` and both top-level `package-lock.json` version fields remain `0.8.10`. No committed `docs/tasks/c8-ui2/closeout.md` exists; c8-ui2 P4 has **not qualified/deployed** its work in GitHub history. Prior c8-ui P4 was staged/qualified in an earlier layout and remains historical.
- `apps/studio/src/App.tsx`: stable `channel-fullscreen-root`, secondary left editor `.channel-dock`, right `.channel-tv-stage`, `.channel-stage-action` with **View full screen** above Preview, one `Preview` component with selectedPageId, fullscreen and Back/Exit behavior. Avoid reparenting/mounting a second Preview/editor or disturbing P8B ChannelSpec/rights/Publish/Export.
- `apps/studio/src/Preview.tsx`: normal `.preview-heading` (Draft TV Preview + status) ABOVE the `.tv-frame`, `.remote-bar` after frame. Move normal-mode metadata BELOW via a stable under-TV utility row, retaining fullscreen-specific accessible Exit control and TV navigation.
- `apps/studio/src/style.css`: `.channel-workspace>.workspace-main` still has outer padding; `.channel-tv-stage .preview-wrap` reserves `padding:14px 12px 132px`, `.channel-tv-stage .tv-frame` has max-size calculation `100cqh - 190px`, a decorative border/shadow inherited from older frame rules, and `.channel-stage-action` is absolute at the top right. These consume room and create the mockup mismatch.
- The Channel editor styling is currently warm brown in some section backgrounds, whereas New Page modal uses a cooler neutral dark charcoal. We need a **Channel-only** neutral palette preserving selected orange and true TV brand colors; scenic canyon should be completely obscured by a solid near-black Channel backdrop. Do not change backgrounds on unrelated routes.
- Existing CSS includes multiple late/mobile breakpoints and fullscreen selectors. New rules must not accidentally shrink/crop `.tv-frame`, shift the Remote over TV, alter `fullscreenRoot` overlay clipping or collapse tablet/phone layouts. Designer-approved image is visual evidence only, not a source of pixel-perfect universal sizing.
- c8-ui2 P1–P3 implementation may have later local dirty changes despite GitHub HEAD; local git preflight before execution remains mandatory. c8-ui2 P4 is **superseded by c8-ui3 P4** for combined visual/staging acceptance (not retroactively qualified).
- Protected deployment: P4 must **deploy the latest qualified archive FIRST, then test in the Codex browser against staging**, including three fullscreen states. Source/production-bundle preflight still happens before deploy for safety. Exact archive checksum, operator grant, encrypted backup/schema14, previous-release rollback, actual served JS/CSS hash verification and owner login are required. On a defect, prepare a new candidate/archive and redeploy under valid scope, then RETEST staging. Do not mask missing permissions/browser evidence.

## Additional owner approval — true fullscreen and hide-all Clean View

The prior scope handled normal Preview composition and merely preserved existing fullscreen. **The owner now requires real immersive fullscreen:** fit the app itself to the viewport at exact 16:9, with no frame, padding, normal heading, reserved remote/footer or permanent Studio chrome. A 16:9 monitor must be filled; other aspect ratios get only necessary dark letterbox. Controls in fullscreen are OVERLAYS: Virtual remote **BOTTOM LEFT**, Exit fullscreen and Hide controls **TOP RIGHT**; c8-ui2's editor remains the LEFT slide-out drawer.

**Clean View must hide every overlay**, including the remote, Exit/Hide controls, editor panel and reveal handle, help/metadata/status and invisible click-blocking surfaces. Safe recovery is mandatory: H keyboard toggle outside text inputs, intentional top-right corner pointer/touch recovery, Alt+E to open editor and leave Clean View, and Escape to exit fullscreen from all modes. Regular pointer movement over the TV should NOT reveal controls. A hidden but focusable/inert inconsistency would be a significant accessibility defect. TV focus/video/player/unsaved-editor state must never be re-created across modes, and browser-native Fullscreen API denial must be identified as fallback rather than passed as native success.

**Source ownership:** P1 normal shell and P2 normal TV under-controls are unchanged, protecting any locally completed runner steps. New **P3** narrowly modifies the existing App.tsx fullscreen state/visibility, Preview.tsx remote/Exit presentation and fullscreen CSS; **P4** takes over manual protected-deployment-first staged Codex-browser qualification. The old P3 staging closeout must be removed, not retained as another closeout file. The hard part is Clean View recoverability and fully maximal TV, not building another viewer.

## Smallest safe prompt topology

| Step | Ownership | Focused testing / deferred work |
| --- | --- | --- |
| P1 — Seamless gray Channel shell | EXISTING scoped shell/background/editor palette prompt; unchanged | Affected Studio layout/style tests/typecheck |
| P2 — Borderless maximal TV and utility row | EXISTING normal-mode TV/metadata/remote prompt; unchanged | Focused Preview/shell tests/typecheck |
| **P3 — True fullscreen and Clean View** | Full-viewport 16:9, bottom-left remote and top-right Exit/Hide overlays, reversible app-only Clean View, preserve LEFT editor and same TV | Focused state/input/visibility/fullscreen tests/typecheck |
| **P4 — Deployment-first staging closeout** | One full aggregate, protected deploy exact candidate, then Codex browser REAL staged normal mockup and three fullscreen states | Owner-authenticated staging browser, device-independent visual/fullscreen evidence; no native Vega rebuild |

Three implementation checkpoints rather than overloading P2: the current P2 source sizing/controls affects NORMAL mode, while fullscreen clean-overlay visibility involves separate input state and accessibility. Each implementation targets <=8 minutes (15-minute stop). P4 is MANUAL independent browser closeout and requires actual operator/browser access; if blocked report NOT GREEN/NOT DEPLOYED.

## Runner/version semantics

- Folder `c8-ui3` matches the repository correction regex `c<phase>-<slug>`; every prompt must say `TASK: Correction 8 / Pn — ...` and exactly `- Required unchanged project version: `0.8.10`.` with no phase-style assigned-version field.
- P1/P2/P3 Browser required no; **P4 closeout Browser required yes**. Exactly one final `closeout` prompt, P4. Runner commits P1–P3 sequentially and stops before P4; no `/activate`, no version bump. Existing P1/P2 are preserved verbatim and may have already run in a local checkout; inspect actual runner prefix.
- On local machine validate `npm run codex:stack:validate -- c8-ui3` then `npm run codex:stack -- c8-ui3` after safe checkout/worktree reconciliation. Do not rerun c8-ui2 P1–P3 or its P4 and do not change their historical prompt files.
- Preserve owner rights, private artwork, CSRF, approved FREE release #1, native static section compatibility, worker separation, schema14 and rollback. Phase 8 remains OPEN. P8B Wave 2 native static-layout device proof stays open unless independently checked; this visual correction does not qualify it.

**Assessment disposition:** Three focused implementation prompts + one deployment-first/manual closeout are the fastest safe sequence for the expanded normal/fullscreen requirements.

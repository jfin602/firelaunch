# C8-UI3 — Prompt Assessment: Seamless Gray Channel Shell and Borderless TV

**2026-10-21; documentation and prompt authoring ONLY.** New owner-approved [exact visual contract](../../design/channel-preview-final-composition.md). The latest mockup must be **attached by the owner to the relevant Codex implementation and closeout messages**; it is not an asset in the repo. The correction is on top of committed c8-ui2 P1–P3, not a rerun of prior runner stacks.

## Verified source and risk

- At review, GitHub `main` `8c49aae` holds the committed [c8-ui2 P3 fullscreen-left drawer] source; root `package.json` and both top-level `package-lock.json` version fields remain `0.8.10`. No committed `docs/tasks/c8-ui2/closeout.md` exists; c8-ui2 P4 has **not qualified/deployed** its work in GitHub history. Prior c8-ui P4 was staged/qualified in an earlier layout and remains historical.
- `apps/studio/src/App.tsx`: stable `channel-fullscreen-root`, secondary left editor `.channel-dock`, right `.channel-tv-stage`, `.channel-stage-action` with **View full screen** above Preview, one `Preview` component with selectedPageId, fullscreen and Back/Exit behavior. Avoid reparenting/mounting a second Preview/editor or disturbing P8B ChannelSpec/rights/Publish/Export.
- `apps/studio/src/Preview.tsx`: normal `.preview-heading` (Draft TV Preview + status) ABOVE the `.tv-frame`, `.remote-bar` after frame. Move normal-mode metadata BELOW via a stable under-TV utility row, retaining fullscreen-specific accessible Exit control and TV navigation.
- `apps/studio/src/style.css`: `.channel-workspace>.workspace-main` still has outer padding; `.channel-tv-stage .preview-wrap` reserves `padding:14px 12px 132px`, `.channel-tv-stage .tv-frame` has max-size calculation `100cqh - 190px`, a decorative border/shadow inherited from older frame rules, and `.channel-stage-action` is absolute at the top right. These consume room and create the mockup mismatch.
- The Channel editor styling is currently warm brown in some section backgrounds, whereas New Page modal uses a cooler neutral dark charcoal. We need a **Channel-only** neutral palette preserving selected orange and true TV brand colors; scenic canyon should be completely obscured by a solid near-black Channel backdrop. Do not change backgrounds on unrelated routes.
- Existing CSS includes multiple late/mobile breakpoints and fullscreen selectors. New rules must not accidentally shrink/crop `.tv-frame`, shift the Remote over TV, alter `fullscreenRoot` overlay clipping or collapse tablet/phone layouts. Designer-approved image is visual evidence only, not a source of pixel-perfect universal sizing.
- c8-ui2 P1–P3 implementation may have later local dirty changes despite GitHub HEAD; local git preflight before execution remains mandatory. c8-ui2 P4 is **superseded by c8-ui3 P3** for combined visual/staging acceptance (not retroactively qualified).
- Protected deployment: P3 must **deploy the latest qualified archive FIRST, then test in the Codex browser against staging**. Source/production-bundle preflight still happens before deploy for safety. Exact archive checksum, operator grant, encrypted backup/schema14, previous-release rollback, actual served JS/CSS hash verification and owner login are required. On a defect, prepare a new candidate/archive and redeploy under valid scope, then RETEST staging. Do not mask missing permissions/browser evidence.

## Smallest safe prompt topology

| Step | Ownership | Focused testing / deferred work |
| --- | --- | --- |
| P1 — Seamless gray Channel shell | CSS/DOM wrapper padding + topbar alignment + main/secondary sidebar seam, neutral New Page style palette, whole Channel dark preview background and canyon exclusion | Only changed Studio layout/style tests and Studio package typecheck |
| P2 — Borderless maximal TV and utility row | Single TV Preview frame fit, remove decorative bezel, normal metadata + View Full Screen BELOW TV, Remote further down, preserve fullscreen left drawer and state | Focused Preview/shell/fullscreen tests + Studio package typecheck |
| P3 — Staging closeout | One final `npm run test` on exact source, protect/deploy one archive, then Codex browser signed-in visual comparison and scoped repair/redeploy | Actual staged UI at two desktop sizes + small viewport spots; no native Vega rebuild |

**Why two implementations:** P1 owns the entire shell background/rail seam; P2 owns the real interactive TV and utility relocation. Combining may cause a long cross-viewport repair loop; splitting further adds overhead and duplicate checks. Each implementation targets <=8 minutes (15 minute stop). P3 is a MANUAL independent browser closeout, not runner-owned. P3 may need actual operator/browser access and has explicit NOT GREEN outcomes if blocked.

## Runner/version semantics

- Folder `c8-ui3` matches the repository correction regex `c<phase>-<slug>`; every prompt must say `TASK: Correction 8 / Pn — ...` and exactly `- Required unchanged project version: `0.8.10`.` with no phase-style assigned-version field.
- P1/P2 Browser required no; P3 closeout Browser required yes. Exactly one unambiguous last `closeout` prompt. Runner commits P1–P2 sequentially and stops before P3; no `/activate`, no version bump.
- On local machine validate `npm run codex:stack:validate -- c8-ui3` then `npm run codex:stack -- c8-ui3` after safe checkout/worktree reconciliation. Do not rerun c8-ui2 P1–P3 or its P4 and do not change their historical prompt files.
- Preserve owner rights, private artwork, CSRF, approved FREE release #1, native static section compatibility, worker separation, schema14 and rollback. Phase 8 remains OPEN. P8B Wave 2 native static-layout device proof stays open unless independently checked; this visual correction does not qualify it.

**Assessment disposition:** Two focused implementation prompts + one deployment-first/manual closeout are the fastest safe sequence.

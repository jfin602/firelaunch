# C8-UI2 — Implementation Plan: Left Editor Rail, Styled Controls & Left Fullscreen Overlay

**Status:** authored plan only, 2026-10-21. Authority: [design](../../design/channel-secondary-rail.md), [assessment](prompt-assessment.md), [previous c8-ui staging evidence](../c8-ui/closeout.md). Latest verified GitHub root/lock `0.8.10`; no new code or rollout authorized by writing this plan.

## Sequential correction checkpoints

| Prompt | Model | Owns | Focused proof |
| --- | --- | --- | --- |
| [P1](P1-secondary-editor-rail.txt) | GPT-6 Sol Medium | Main sidebar → left secondary editor → right 16:9 TV; remote below; preserve single editor/Preview | Studio layout, page/editor/focus tests |
| [P2](P2-consistent-editor-controls.txt) | GPT-6 Sol Medium | Replace default-looking buttons with scoped Desert Heat control hierarchy across the Channel editor | Style/semantic/accessibility/regression tests |
| [P3](P3-fullscreen-left-drawer.txt) | GPT-6 Sol High | Reuse fullscreen TV state, change bottom overlay into left-edge slideout drawer | Fullscreen hover/touch/keyboard/focus tests |
| [P4](P4-left-rail-staging-closeout.txt) | GPT-6 Sol High, manual browser | Final live UI acceptance and protected staging deployment of exact candidate | One aggregate + real owner browser |

Each prompt requires unchanged project version **0.8.10**; no bump or `/activate`. P1–P3 runner commits; P4 exactly one final unambiguous browser-required closeout. P4 closes `c8-ui2`, not overall Phase 8 or unrelated P8B native device gate.

## Entry conditions

Check `git status --short`, HEAD and root+both lock versions on the local checkout; preserve any post-c8-ui P4 adjustments. GitHub main at assessment `f5c515c` carries c8-ui P1–P3 and P4 closeout, with tested staging release `20261021T193117Z-850e9d93523c` (dated status). Inspect current host only before attempting any new rollout. Validate `npm run codex:stack:validate -- c8-ui2`, then `npm run codex:stack -- c8-ui2`. Do not begin until local source aligns or conflicts have been safely reconciled.

## P1: Secondary left rail and right TV

In `apps/studio/src/App.tsx` and targeted `style.css`, preserve the existing `channel-fullscreen-root` parent with exactly one Preview and one editor. Change normal mode `.channel-presentation` from TOP stage / BOTTOM dock into a CSS grid with two columns. The editor `.channel-dock` becomes a VERTICAL secondary LEFT rail immediately to the right of persistent Studio sidebar, reaching down under topbar; existing tabs stay at its top and existing P8B page/section/Appearance content stays in its own independently scrollable vertical body. Do not move the global sidebar or introduce a third full-height inspector.

Right `.channel-tv-stage` gets remaining space; fit actual `.tv-frame` to 16:9 by width and height, centered/letterboxed, never crop or stretch. Relocate visual remote `.remote-bar` to the lower right space under the TV frame, no overlap with the TV/image or external editor. Keep the remote mounted with Preview if possible (styling rather than JSX cloning); preserve D-pad, Back and media input. Fullscreen reflow is P3.

Desktop ~1440×900 and 1280×720 should show readable editor+TV, with rail occupying roughly 36–43% of available Channel workspace (not including main left global sidebar) within sensible min/max, and vertical scrolling contained INSIDE rail. Tablet/phone use collapse or focused editor drawer without tiny clipped controls. Avoid whole-page overflow. Reuse P8B templates/sections and all save/rights/capability checks unchanged.

## P2: Consistent human-first buttons

Audit actual Channel controls: Pages & Layout/Appearance tabs, New page, Edit page, Edit section, Move up/down, Remove section, Add section, selected-context close, view fullscreen, editor rail actions and remote. Replace stark white/default buttons with focused `.channel-*`/editor-scoped CSS or existing semantic classes: neutral charcoal/warm-border for secondary, restrained warm-orange for selected/primary, meaningful danger, subdued disabled, high-contrast focus-visible. Use consistent typography/radius/height and useful >=40–44px interactive targets where practical; don't use excessive orange on every button. Refine compact page list and selected section actions without adding a new component library. Do not change `.tv-frame` button focus colors, creator `ChannelSpec.brand`, Library, Publish/Export, or media thumbnails.

Tests should inspect actual class structure and accessibility/focus states, no screenshot-derived assertions mistaken for real visual rendering. P4 performs real browser contrast/button checks.

## P3: Fullscreen left-side editing drawer

Current c8-ui `previewFullscreen`, `fullscreenRoot`, `dockVisible`, `dockHover`, `scheduleDockHide`, native Fullscreen API/fallback, Alt+E, `fullscreenchange`, Escape/TV Back and same mounted `Preview` are retained. Change trigger from a bottom-edge y-distance to a LEFT-edge x-distance of ~32–40px. Change `.channel-dock` fullscreen overlay to fixed/absolute LEFT overlay with bounded width, height 100%, `translateX(-100%)` hidden to 0 revealed; move `.channel-dock-handle` to left edge at accessible height. No bottom overlay remains in fullscreen.

Dock stays visible during hover/focus, unsaved changes and dialogs; hides after safe delay only on idle. Keep touch tap/swipe or handle access and keyboard Alt+E/reachable focus, with Escape exiting fullscreen, Backspace/virtual remote as TV Back except inside fields. Use `prefers-reduced-motion` and avoid timers/listeners leaks; handle fallback inert excluding the shared rail. Preserve both Preview and editor state, project switch, scroll and focus return; no remount/portal/duplicated editor. Right-side virtual remote remains accessible and not hidden by left overlay.

## P4: Real browser closeout and staging

After P1–P3 settle, run narrow predeploy UI sanity then ONE `npm run test` on the exact final source (includes checked build and kernel/Studio/runner suites); do not separately run root check/build/typecheck or repeat C7/Vega full matrix. Run stack validator and diff check. Qualify with real creator session and viewport geometry for the new secondary rail, right TV at 16:9, remote below, styled buttons, page/section save and fullscreen LEFT overlay pointer/touch/keyboard; one desktop journey plus short tablet/phone spots. At most two narrow UI repair cycles, new aggregate only if changed tree invalidates prior result.

**Protected staging is the release acceptance target.** Verify active host/source/rollback and the exact new archive hash, command-scoped authorized operator grant, retained prior hashed Studio assets, production-bundle visible-root smoke, schema14 + encrypted backup, then use existing protected scripts. After activation test fresh signed-out and signed-in owner Chrome on the actual deployed site and verify prior public release #1 unchanged. If operator grant/browser blocked, record NOT DEPLOYED/NOT GREEN, do not bypass. Roll back if critical regression. Write `docs/tasks/c8-ui2/closeout.md`, with UI/staging status and next usability notes; do not relabel the still-missing P8B native static-layout device gate.

## Efficiency/safety policy

P1–P3: only affected Studio tests and `npm run typecheck -w @firelaunch/studio` as needed, runner owns diff/commit/version; do not perform global builds/browser/deploy loops. No new editor engine, ChannelSpec changes, owner rights or publication, native Vega/device build, worker/config/cloud changes, or hidden auto-save. P4: one full build-backed aggregate, real browser and guarded staging, source hash/evidence. Successful correction does not close Phase 8.

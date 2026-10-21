# C8-UI3 — Implementation Plan: Final Approved Channel Composition

**Date 2026-10-21.** [Final mockup contract](../../design/channel-preview-final-composition.md) is the authority. OWNER WILL ATTACH the actual approved mockup image to Codex during P2 and P3; do not invent an image path or pretend it is a repo asset. Plan/prompt authoring does not implement or stage anything. Root+both root lock versions remain `0.8.10`; Phase 8 OPEN.

## Checkpoints

| Step | Model | Core changes | Verification |
| --- | --- | --- | --- |
| [P1 Seamless shell](P1-seamless-gray-channel-shell.txt) | GPT-6 Sol Medium | Unify primary/secondary sidebar seam/topbar alignment, remove Channel-only gutters, New Page charcoal-gray rail and full Channel near-black backdrop hiding canyon | Focused Studio CSS/layout tests; typecheck |
| [P2 Borderless Preview](P2-borderless-maximized-preview.txt) | GPT-6 Sol High | Fit largest safe 16:9 TV, remove decorative border/shadow, move draft/interactive label and View full screen UNDER TV, Remote below at lower-right, preserve same Preview/fullscreen drawer | Focused Preview/Channel and keyboard/fullscreen tests; typecheck |
| [P3 Staging closeout](P3-staging-visual-closeout.txt) | GPT-6 Sol High, browser yes | Exact source/one aggregate, guarded protected deployment FIRST, Codex-browser logged-in visual test ON STAGING, up to 2 targeted correction/redeploy loops | Real staged owner / 1440×900, 1280×720 and responsive spot checks |

**Correction not a version milestone:** all prompts require unchanged `0.8.10`. P1/P2 run sequentially under runner (only it commits); P3 is the one manual browser-required closeout. No `/activate`.

## Preflight

At last GitHub check: `main` `8c49aae` holds c8-ui2 P1–P3, root/lock `0.8.10`, and no c8-ui2 P4 closeout. c8-ui2's unrun P4 is **superseded as final visual/staging qualification by c8-ui3 P3**; historical P1–P3 code and prompts remain untouched. On actual local checkout inspect HEAD/`git status --short`/all 3 version fields, preserve any later files/dirty edits, reconcile without reset/force checkout/stash. Validate correction grammar and run when safe: `npm run codex:stack:validate -- c8-ui3`, `npm run codex:stack -- c8-ui3`. Normal runner stops at P3.

## P1 — Channel-only seam, header, background and tool palette

Inspect `apps/studio/src/style.css` .studio-main, .topbar, .workspace-main, .channel-presentation, .channel-dock, page/template controls and New Page dialog gray tokens; change JSX only if needed to eliminate an extra containing wrapper. Make the seam between global left navigation and secondary left editor *flush* (subtle divider permitted), align topbar and columns without stray left/top padding. Give entire Channel surface the existing solid near-black preview-stage background; hide canyon/scenic artwork on Channel only, including gutters. Use New Page charcoal gray for editor rail/panels/controls without changing TV brand art/colors or global Home/Library/Publish/Export. Keep meaningful orange selected actions. Preserve normal secondary-left-rail and right TV structure, full-height scroll in editor, all P8B sections and c8-ui2 fullscreen. Do not resize TV here except necessary containing background. Focused layout/style unit tests + Studio typecheck.

## P2 — Maximum 16:9 TV and controls below it

Use approved user-attached mockup. Inspect `apps/studio/src/Preview.tsx` .preview-heading, .tv-frame, .remote-bar; `App.tsx` .channel-stage-action; CSS .channel-tv-stage/.preview-wrap/.tv-frame and fullscreen overrides. Keep ONE Preview component/player instance; never portal-clone/re-mount it. For NORMAL mode remove decorative bezel/border/shadow and maximize frame to the largest **fully visible 16:9** upper-right rectangle from actual available width/height, not stretch/crop. Reclaim unnecessary top/side padding and avoid fixed `100cqh - 190px` reservation when metadata has moved below. Arrange a compact BELOW-TV utility row: Draft TV Preview, 16:9 Interactive indicator and View full screen action; Virtual remote stays below TV lower-right in remaining space, not overlaying media. Do not duplicate status/actions/remote or make the controls a fake part of ChannelSpec. Keep accessible Fullscreen Exit/Back with same LEFT overlay semantics and state. Account for 1280×720, 1440×900 and narrow breakpoints; contain scroll and preserve keyboard/remote. Run focused Studio Preview/shell/fullscreen tests and Studio typecheck only.

## P3 — Protected staging first, then visual acceptance in Codex browser

The owner-approved image must be attached to the **manual P3 Codex browser invocation** and preferably to P2; if it isn't provided, report visual reference missing rather than claiming a pixel match. P3 reads final P1/P2 commit evidence and real local diffs, checks version and runs ONE `npm run test` (which builds/typechecks all packages), stack validator and `git diff --check`; don't redundantly `npm run build/check`. Build and hash ONE exact-source staging archive with retained active hashed assets and production-bundle visible-root smoke. Verify live host, schema14, authorized narrowly scoped deploy command for this new archive, encrypted predeploy backup and rollback. **DEPLOY FIRST** using protected path, then use **Codex browser against https://firelaunch.jfin.dev/** to check actual currently served assets, sign in as owner with supported flow, and compare the deployed Channel to the attached mockup. No local/fixture browser substitutes for final acceptance.

Acceptance: flush editor/primary nav seam, topbar, gray tools, uninterrupted near-black Channel background with no canyon, largest fitted borderless 16:9 TV, labels + Full Screen BELOW and Virtual remote below at lower right, all controls reachable, fullscreen left drawer unchanged. Check 1440×900 and 1280×720 plus short tablet/phone. If defects found, at most two narrow fix/test/new-archive/approved redeploy/retest loops. Roll back severe regressions using authorized workflow and recheck signed-in restored Studio. Record `docs/tasks/c8-ui3/closeout.md` with UI GREEN/NOT GREEN + STAGING DEPLOYED/NOT DEPLOYED/ROLLED BACK separately; historical P8B and c8-ui2 dispositions remain intact; overall Phase 8 OPEN.

## Safety and budget

This is pure Studio chrome and Preview presentation. Do not modify native Vega device, ChannelSpec, publication, AWS/IAM/MediaConvert, worker, app schema, creator rights or package versions. Validate P1/P2 only affected Studio tests plus package typecheck; runner handles diff/commit. P3 aggregate once and real staged evidence, never a blanket historical native suite. Any missing authorization/browser/visual reference means truthful NOT GREEN/NOT DEPLOYED rather than unperformed success.

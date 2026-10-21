# C8-UI — Optimized implementation plan: TV-first Channel after P8B

**Updated 2026-10-21 against pushed main `be91bb8`.** GitHub root `package.json` and both top-level lock fields are **verified `0.8.10`**. P8B P1–P6 are committed, and [P8B P7](../p8b/wave2-closeout.md) is **NOT GREEN / NOT DEPLOYED**. This plan is documentation only: c8-ui implementation, new UI tests and staging still have NOT run. Phase 8 stays OPEN. Source of product truth: [TV-first design](../../design/tv-first-channel-workspace.md), [assessment](prompt-assessment.md).

## Exact ownership — three implementation prompts, one manual closeout

| Step | Owns | Concrete touched seams | Minimal evidence |
| --- | --- | --- | --- |
| [P1](P1-always-on-channel-preview.txt) | Always-on Preview, two Channel views, no UI Agent/toggle | `App.tsx` `ChannelView`, `channelView`, `previewOpen`, Home/Catalog/new-channel redirects and `Preview` mount | Focused navigation/`layout-workspace.test.tsx` and `workflow.test.tsx`; Studio typecheck |
| [P2](P2-horizontal-editing-dock.txt) | Stage/dock shared DOM, horizontal P8B editor and Appearance | `App.tsx` `Content` / Design, `style.css` `.channel-preview-split`, `.layout-workspace`, `.workspace.has-inspector` | Affected layout/editor tests + Studio typecheck; no real browser claim |
| [P3](P3-fullscreen-edge-dock.txt) | P8B fullscreen target retarget, overlay reveal and input safety | `previewContainer`, `previewFullscreen`, `fullscreenchange`, fallback inert, Preview keyboard, CSS `.preview-fullscreen` | Existing fullscreen tests + narrow common-root/reveal/focus tests; Studio typecheck |
| [P4](P4-tv-first-closeout.txt) | REQUIRED protected staging rollout and final creator UI tests ON STAGING; joint P8B Wave 2 follow-on | Exact source/backup/deployment and signed-in owner/changed native section proof | One final `npm run test`, actual staged UI + native delta; UI/deploy/Wave 2 separate status |

Three independent seams are optimal: P1 changes navigation/mount logic, P2 rehouses existing functionality and PREPARES the common fullscreen parent, and P3 only adjusts existing P8B fullscreen behavior. Do NOT combine P2 and P3 (easy double mount/focus regression) or split into repetitive cosmetic loops. Target <=8 minutes per implementation, hard stop at 15; fail closed and give focused handoff on overrun.

## Pushed P8B facts and version preflight

- Main at assessment: `be91bb8`, version `0.8.10`; P8B P1–P6 commits `cb17721`, `a84fc20`, `8a9d564`, `37ace5d`, `339f8fe`, `fab70c3`. P8B P7 **did not bump to 0.8.11**.
- P8B P7 already proved local Hero/Grid/Rows, static sections, page editing/reload and Fullscreen **fallback** in a disposable browser, with its aggregate test pass. It did **not** qualify real signed-in 0.8.10 staging, new static-layout Vega VirtualDevice, or protected deployment. These are NOT c8-ui engineering work; preserve P8B evidence and do not mark its P7 GREEN.
- The recorded staging release remained Wave 1 `0.8.4` at P8B P7 host readback. Source GitHub `0.8.10` is NOT a live staging release.
- Before correction runner: inspect `git status --short`, actual HEAD and root plus both lock fields; reconcile any newer local work safely (no forced checkout, reset, stash, destructive cleaning). All c8-ui prompts require **unchanged `0.8.10`**. If local tree isn't coherent, stop with exact handoff.
- Run `npm run codex:stack:validate -- c8-ui` and then `npm run codex:stack -- c8-ui`. P1–P3 are runner-owned commits and keep `0.8.10`; P4 is manual/browser-required and the runner stops before it. Its objective is to deploy and qualify the integrated candidate at staging; if an essential operator grant is missing, fail NOT DEPLOYED rather than silently treating staging as optional. No `/activate`, self-commit, version bump or modification to any existing `p8b` prompt.

## P1 — Entrypoints only

Current `App.tsx` still exposes `AI Assistant | Appearance | Pages & Layout`; `channelView` initially AI, `previewOpen=false`, conditional `<Preview>` and `TV Preview / Close TV Preview`. Change to Pages & Layout + Appearance and one always-visible Preview. Update old New Channel, Home and Catalog redirect actions; don't delete AgentPanel/provider backend. Keep P8B selectedPageId→TV sync and Preview mount identity across view tabs. No CSS large dock or fullscreen rewrite here. Update focused tests that currently click TV Preview/Close TV Preview rather than adding redundant new suite.

## P2 — Shared root and compact horizontal dock

Recompose the **actual P8B Content** (`layout-page-rail`, `layout-composition`, `layout-inspector`, page template dialog, new Image Banner/Image+Text, rights/dirty/state) into dock horizontal regions; rehouse Appearance edit form inside dock, without the `.workspace.has-inspector` external side rail. **Build ONE persistent common Channel parent holding TV stage and dock now**, so P3 can reuse it as fullscreen target without moving or remounting components twice. Height-first stage with undistorted 16:9 TV, immediate zero-gap dock, min usable dock height and contained scrolling for longer data. Desktop normal Channel should avoid document-level scroll; tablet/phone use compact focused dock panels and readable controls. Keep virtual remote accessible in a bounded help/control area instead of consuming stage height. P2 tests editor behavior and structure, not browser pixel proof.

## P3 — Reuse existing fullscreen, no second implementation

P8B already has `previewFullscreen` native/fallback API handling, `Preview.fullscreen` Backspace-vs-Escape UI, and focus state. **The missing feature is the fullscreen target still points at `#tv-preview` only.** Retarget to P2's common TV+dock parent. Fullscreen places dock over TV with bottom-edge pointer reveal and reduced-motion-safe slide; touch and keyboard alternatives are mandatory. Keep open while hovered/focused/unsaved or editing modal; hide only when idle. In fallback, inert ONLY the UI outside the shared fullscreen root; never disable the dock itself. Preserve one Preview/player and the same section forms across mode changes. Update existing targeted tests and no broader native work.

## P4 — Required staging rollout and shared Wave 2 qualification

After protected deployment, one actual authenticated creator journey ON STAGING: normal TV always visible, top-stage/dock adjacency, two styled tabs, page+section selection/save, Appearance, Full Screen, bottom hover/touch/keyboard dock reveal, Exit distinct from TV Back, no Preview/editor remount or lost draft. Real desktop (~1280×720, 1440×900) measurements and short tablet/phone spot checks. At most two directly observed bounded repair cycles. After changes settle, one aggregate `npm run test`, stack validator and `git diff --check`; no repeated global build/typecheck. Reuse P8B P7 existing local UI and C7 native video proof rather than rerunning its native/static-layout acceptance.

**Protected staging deployment is a REQUIRED objective, with its result recorded separately.** P8B P7 lacked a command-scoped exact-archive operator grant and did not deploy. Do not treat its observed broad temporary sudo allowance as permission. After predeploy tests, verify a grant for this exact candidate and required access, then use verified archive hashes, retained active asset bundles, production-bundle visible-root smoke, encrypted backup, schema14 checks, rollback and signed-out + owner fresh-tab smoke. If authorization or required backup checks fail, stop as `NOT DEPLOYED / NOT GREEN`; locally passing UI is not final staging acceptance. Preserve original approved free public release #1 bytes.

Write `docs/tasks/c8-ui/closeout.md` with independent **UI GREEN/NOT GREEN**, **DEPLOYED/NOT DEPLOYED/ROLLED BACK** and **P8B WAVE 2 GREEN/NOT GREEN** results. Verify a signed-in owner creator path on the deployed candidate and one bounded genuine native static-section device rendering delta for P8B Wave 2 GREEN; use prior P8B tests rather than repeating the full local matrix. Add a dated linked P8B Wave 2 continuation result if qualified; do not overwrite the historical P7 NOT GREEN. This closes **c8-ui only**. Phase 8 remains OPEN, Phase 9 not activated.

## Boundary and testing policy

- P1–P3: directly affected Studio tests (not guessing filenames), one Studio package typecheck per changed checkpoint, runner handles `git diff --check` and commits. No whole-workspace builds, MediaConvert, native worker, ZIP, device, browser login or staging in implementation prompts.
- P4: one final aggregate build-backed test plus actual browser/UI and optionally protected operator-scoped staging. Never claim DOM simulation proves visual dimensions/fullscreen hover.
- Preserve owner media/artwork, CSRF/revision rights, public release #1, custom source, Vega native parity, P8B finished section models and schema14. No broad engineering rewrite.

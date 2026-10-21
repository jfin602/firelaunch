# C8-UI — Prompt assessment: TV-first Channel shell and editing dock

**Owner-approved /docs-review 2026-10-21, authoring ONLY.** The screenshot of hosted Studio shows the current failure: Preview next to a tall Content form, unstyled AI/Appearance/Pages & Shelves controls, a Close TV Preview action, and unusable dead/scrolling space. Canonical [TV-first design](../../design/tv-first-channel-workspace.md). **Owner correction:** P8B ALREADY RAN LOCALLY; c8-ui follows and fixes its actual UI. GitHub main now VERIFY confirms the pushed root/lock `0.8.10`, P8B commits and P7 NOT GREEN closeout. Inspect any later local dirty state separately. **No code changes, versions, deployment or source qualification in this document.**

## Verified pushed P8B source — exact reuse points

At assessment main `be91bb8` has root/lock `0.8.10` and committed P8B P1–P6, plus [P7 Wave 2 NOT GREEN / NOT DEPLOYED](../p8b/wave2-closeout.md). The source contains all six bounded layout sections, Hero/Grid/Rows dialog, selected-page→Preview repair, existing draft guards and a fullscreen API/fallback. The old 0.8.4-only warning is superseded. The P7 report's local native/static section parity, owner-authenticated candidate and protected operator grant remain open, separate from this UI correction.

- **P1 exact App.tsx state:** `ChannelView = 'AI Assistant' | 'Appearance' | 'Pages & Layout'`, `channelView` initial AI, `previewOpen=false`, toolbar `Close TV Preview`, conditional `Preview`, Home/Catalog/new-channel AI redirects. Delete/show-only UI affordances, preserve backend AgentPanel and real P8B editor. Existing `apps/studio/test/layout-workspace.test.tsx` still asserts opening/closing TV and will need targeted updating.
- **P2 actual CSS/DOM:** `.channel-preview-split` still side-by-side at desktop, `.workspace.has-inspector` reserves an external Appearance rail and `.layout-workspace.layout-has-inspector` is 3 columns with a large vertical composition. `Content` already provides proper page and module controls, template creation, image/text rights and revision guards; reorganize THESE, not an old form. `apps/studio/test/workflow.test.tsx` and `layout-workspace.test.tsx` cover editor operations.
- **P3 existing fullscreen:** `previewFullscreen` native/fallback, `previewContainer` / Fullscreen API, `fullscreenchange`, Escape/Backspace and focus logic exist. The requested fullscreen target currently holds only `#tv-preview`; its sibling `.channel-editor` is outside fullscreen and the fallback inert logic disables it. P2 must create a stable parent of the TV AND dock; P3 changes the target and overlay state rather than adding another renderer/player.
- **Qualification reuse:** Wave 2 P7 already passed aggregate tests (see its exact counts), disposable local templates and fullscreen fallback. Do not rerun the complete P8B matrix or native C7 playback. Only changed Channel dock behavior needs focused tests and P4's real viewport/hover acceptance.


## Risk and mitigation

| Risk | Mitigation | Prompt |
| --- | --- | --- |
| Preview still optional or duplicate-mounted | Always mount once on Channel, remove close toggle, keep stable identity on tab changes | P1 |
| AI tab hidden but stale redirects remain | Remove Channel tab and reroute Home/Catalog/new channel entry safely | P1 |
| 16:9 preview consumes every pixel and dock becomes unreachable | Height-first layout with stage max and explicit dock min, inner scrolling | P1/P2 |
| Old module/brand forms simply shoved below TV and remain unusable | Horizontal dock tabs, compact grouped layout and keyboard semantics | P2 |
| Fullscreen overlay fails because it lives outside native fullscreen tree | One fullscreen surface containing TV and same dock, actual API/fallback | P3 |
| Escape conflicts with TV Back or pointer-hover hides editing form | Dedicated Back/Exit, visibility held during focus/dirty edit, keyboard/touch reveal | P3 |
| Regressing completed P8B page designer | **Do not edit P8B prompts or overwrite completed work**; c8-ui must adapt existing templates, six sections, editor and fullscreen behavior | all |
| Regression in remote focus/private media/Appearance edits | Bounded focused tests each step; one manual browser closeout for correction | P4 |

## Fastest safe stack

Use **three bounded implementation prompts + one MANUAL browser closeout**, `c8-ui` correction mode with **required unchanged project version `0.8.10` in every prompt** (verified on pushed main; inspect later local changes before running). This matches grammar for corrections: `TASK: Correction 8 / Pn — ...`, one final `P4-...closeout.txt` with Browser required yes. Runner executes P1–P3 and stops before P4. No `/activate`, no downgrade, no additional version bump. Implementation checks affected Studio tests/typecheck only; closeout owns one aggregate `npm run test` on final candidate and real signed-in browser. No device/native build or MediaConvert jobs for UI shell. **P8B P1–P6 is now committed on main at 0.8.10, and P7's NOT GREEN report is committed.** Never downgrade or rerun it. Stop if local version/dirty state conflicts, then reconcile safely rather than modifying past prompt stacks.

Checkpoint targets: P1 always-on preview/tab cleanup; P2 horizontal dock and layout sizing; P3 fullscreen bottom-edge dock reveal; P4 independent creator UX/staging disposition. Preserve Wave 1 accepted staging release and rollback. **P4 staging deployment and final UI tests there are mandatory objectives.** Existing exact-hash operator approval remains a safety gate: if missing, mark NOT DEPLOYED/NOT GREEN without bypass. Its acceptance can serve as P8B Wave 2 follow-on closeout only after new signed-in staged creator and native static-layout Vega proof (prior P7 NOT GREEN preserved).

**Assessment disposition:** Correction is independently valuable **after completed P8B** to repair the visible Channel workspace composition while preserving its finished templates, static sections and fullscreen work.
# C8-UI — Prompt assessment: TV-first Channel shell and editing dock

**Owner-approved /docs-review 2026-10-21, authoring ONLY.** The screenshot of hosted Studio shows the current failure: Preview next to a tall Content form, unstyled AI/Appearance/Pages & Shelves controls, a Close TV Preview action, and unusable dead/scrolling space. Canonical [TV-first design](../../design/tv-first-channel-workspace.md). **Owner correction:** P8B ALREADY RAN LOCALLY; c8-ui follows and fixes its actual UI. GitHub main still showed the older root/lock 0.8.4 at review, NOT proof of the local completed state. The authored P8B P6 target is 0.8.10; use this as the expected unchanged correction version, fail closed if actual local root/lock or checked history differs. **No code changes, versions, deployment or source qualification in this document.**

## Actual current seams

- `apps/studio/src/App.tsx`: `ChannelView = 'AI Assistant' | 'Appearance' | 'Pages & Shelves'`, `channelViews` list, `previewOpen = false`, explicit `TV Preview / Close TV Preview`, conditional mount of `Preview`, wide `channel-preview-split`, `Content` long form and `Design` appearance inspector. `Home.onEditChannel`, `Catalog.onRefine` and new-channel initial `setChannelView('AI Assistant')` require safe re-routing when hiding AI.
- Older `style.css` splits Preview and side editor; local P8B may have newer selectors. Convert the actual composition to viewport-height TV stage + attached dock without overriding completed P8B CSS or squashing controls. A naive 100%-width 16:9 frame leaves no bottom dock.
- `apps/studio/src/Preview.tsx` owns `TvState`, browser keyboard navigation, player and frame. Conditional mounting/remounting resets focus and playback. Fullscreen element must wrap one Preview instance **and** editing dock for overlays to work with browser fullscreen stacking.
- Existing `Content` and `Design` mutate validated `ChannelSpec` with revision/rights checks; must retain their real controls and save/unsaved protection. Removing user-facing AI tab does NOT mean deleting agent backend/provider APIs or breaking unrelated code.
- `p8b` human-first page templates/static variants/native parity are separate future work. Its already-authored P2/P3/P6 layouts currently assume central page with right inspector and require alignment to corrected shell; no separate fullscreen engine.

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

Use **three bounded implementation prompts + one MANUAL browser closeout**, `c8-ui` correction mode with **required unchanged project version `0.8.10` in every prompt** (the expected completed P8B P6 version; verify actual local source before execution and retarget docs if different). This matches grammar for corrections: `TASK: Correction 8 / Pn — ...`, one final `P4-...closeout.txt` with Browser required yes. Runner executes P1–P3 and stops before P4. No `/activate`, no downgrade, no additional version bump. Implementation checks affected Studio tests/typecheck only; closeout owns one aggregate `npm run test` on final candidate and real signed-in browser. No device/native build or MediaConvert jobs for UI shell. **P8B is already completed locally according to owner.** Never downgrade to 0.8.4 or rerun P8B. Stop only if the actual local completed version is **not 0.8.10** or if unrelated dirty work would be lost, then reconcile the correction's unchanged version against the verified current version before executing.

Checkpoint targets: P1 always-on preview/tab cleanup; P2 horizontal dock and layout sizing; P3 fullscreen bottom-edge dock reveal; P4 independent creator UX/staging disposition. Preserve Wave 1 accepted staging release and rollback. Staging deploy only when owner/operator separately scoped and candidate qualified—no automatic privilege inference.

**Assessment disposition:** Correction is independently valuable **after completed P8B** to repair the visible Channel workspace composition while preserving its finished templates, static sections and fullscreen work.
# C8-UI — Prompt assessment: TV-first Channel shell and editing dock

**Owner-approved /docs-review 2026-10-21, authoring ONLY.** The screenshot of hosted Studio shows the current failure: Preview next to a tall Content form, unstyled AI/Appearance/Pages & Shelves controls, a Close TV Preview action, and unusable dead/scrolling space. Canonical [TV-first design](../../design/tv-first-channel-workspace.md). Correction must precede `p8b` when run from the accepted **root/lock 0.8.4** baseline. **No code changes, versions, deployment or source qualification in this document.**

## Actual current seams

- `apps/studio/src/App.tsx`: `ChannelView = 'AI Assistant' | 'Appearance' | 'Pages & Shelves'`, `channelViews` list, `previewOpen = false`, explicit `TV Preview / Close TV Preview`, conditional mount of `Preview`, wide `channel-preview-split`, `Content` long form and `Design` appearance inspector. `Home.onEditChannel`, `Catalog.onRefine` and new-channel initial `setChannelView('AI Assistant')` require safe re-routing when hiding AI.
- `apps/studio/src/style.css`: `.workspace-main` padding, `.channel-preview-split` two columns at wide breakpoints, top toolbar and `.workspace.has-inspector` third rail. Converting to height-governed stage+dock requires deliberate viewport and breakpoint handling; naively setting TV width 100% forces bottom dock off screen.
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
| P8B duplicates the corrected layout | Update p8b design/plan/prompts to reuse shell and enhance editor, not rewrite it | docs apply |
| Regression in remote focus/private media/Appearance edits | Bounded focused tests each step; one manual browser closeout for correction | P4 |

## Fastest safe stack

Use **three bounded implementation prompts + one MANUAL browser closeout**, `c8-ui` correction mode with **required unchanged project version `0.8.4` in every prompt**. This matches grammar for corrections: `TASK: Correction 8 / Pn — ...`, one final `P4-...closeout.txt` with Browser required yes. Runner executes P1–P3 and stops before P4. No `/activate`, no `0.8.5` bump. Implementation checks affected Studio tests/typecheck only; closeout owns one aggregate `npm run test` on final candidate and real signed-in browser. No device/native build or MediaConvert jobs for UI shell. **If local p8b already advanced past 0.8.4, STOP**; do not run this fixed-version correction on a newer worktree or reorder completed prompt stacks.

Checkpoint targets: P1 always-on preview/tab cleanup; P2 horizontal dock and layout sizing; P3 fullscreen bottom-edge dock reveal; P4 independent creator UX/staging disposition. Preserve Wave 1 accepted staging release and rollback. Staging deploy only when owner/operator separately scoped and candidate qualified—no automatic privilege inference.

**Assessment disposition:** Correction is independently valuable and should run before authored `p8b` when source version still 0.8.4, to prevent layering Page Layout onto a broken workspace shell.
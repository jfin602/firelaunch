# P9-001 — Remove second channel-creation page

**Phase:** 9 — MVP Polish  
**Priority:** P1 / required for MVP  
**Status:** Reported; implementation not started  
**Reported:** 2026-10-22 11:59 UTC  
**Surface:** Hosted Creator Studio > Home / Workspace > New Channel  
**Evidence:** Owner-provided screenshot from the 2026-10-22 issue-collection conversation; the screenshot is retained in that conversation, not copied into this repository.

## Observed problem

The new-channel wizard continues to a separate **"02 First look"** screen after the creator has provided a name. It displays the channel name, offers **"Start with my catalog"** and **"Start with a prompt"**, explains a private creator-controlled feed/inventory workflow, and requires another **"Create channel"** click. This is redundant for the deadline MVP and suggests unfinished source/import/AI pathways must be configured before editing.

Testers should not have to understand catalog or prompt setup to begin making a channel. The extra page makes the simplest starting action look more complicated than it is.

## Owner-approved expected behavior

1. Show **one** minimal creation screen where the creator enters a channel name.
2. The **Create Channel** action persists an owned, private draft channel using the app's existing safe defaults.
3. On successful creation, navigate **directly to that channel's Channel Editor**; no second page or source-selection decision.
4. Keep existing functional Library, catalog/import, and editing tools discoverable in their proper places. Removing the wizard choice must not destroy or disable those independent workflows.
5. Remove obsolete **"First look"**, step counter, next/back step, radio choice, explanatory copy and now-unused onboarding state/routes, without broad unrelated refactoring.

### Before / after

**Before:** Enter name -> First Look -> choose catalog/prompt -> Create channel -> channel workflow.  
**After:** Enter name -> Create Channel -> Channel Editor.

## Functional constraints

- Preserve exact entered name (subject to existing validation), creator ownership/auth scope, private/draft status and established channel defaults.
- Prevent double-submit from creating duplicate channels; disable/reconcile repeated clicks during a pending creation request.
- On API or validation failure, show actionable error feedback **without losing the entered name**.
- A created channel must reopen after refresh/sign-out/sign-in; do not replace or mutate another channel.
- Keep accessibility, keyboard submission and ordinary loading behavior intact.
- Avoid changing exported Vega content or existing working channels as a side effect.

## Acceptance tests

- Fresh authenticated creator opens New Channel, enters a valid name, clicks Create Channel **once**, and lands inside the corresponding Channel Editor.
- **"02 First look"** and the catalog/prompt choice never appear on the path.
- Reload and reopen show exactly one persisted owned private draft with the chosen name.
- Double-click/retry does not produce two copies. Forced create failure preserves input and shows a recoverable error.
- Other existing channels and the independently usable Library remain unchanged.

## Dependencies / batching notes

- Coordinate with any Phase 8 P8C first-time creator work; prefer surgical change on the final Phase 8 baseline, not a parallel reimplementation.
- Documentation-only report: **not fixed, not deployed, not qualified**. 

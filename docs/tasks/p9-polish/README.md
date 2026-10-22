# Phase 9 — MVP Polish: issue register

**Owner decision:** 2026-10-22  
**Deadline:** 2026-10-23 noon (owner delivery deadline; verify authoritative timezone in final handoff)  
**Status:** Issue collection OPEN; no Phase 9 implementation or qualification yet. Phase 8 P8C is still being finished in parallel.

## Scope pivot

The previously authored `docs/tasks/p9/` **Live Channel Publishing & App Updates** plan is **deferred beyond the MVP deadline**. Phase 9 will instead be **MVP Polish**: make the working core product understandable, remove unfinished/planned UI paths that did not make the MVP cut, stabilize create/edit/video/export, and give testers a truthful channel experience.

This issue journal records **owner-reported problems**, not implementation completion or source truth. Do not mutate old Phase 9 publishing evidence or pretend the product has been changed merely because these reports exist. The final Phase 9 implementation prompts, version contract, docs/roadmap reconciliation, and staging closeout will be organized **after collecting issues** and after reconciling Phase 8's actual final state.

## Issue index

| ID | Priority | Problem | Status | Companion |
| --- | --- | --- | --- | --- |
| **P9-001** | P1 required | Remove second "02 First look" page from channel creation and go straight to Channel Editor | Reported | [P9-001 details](issues/P9-001-simplify-channel-creation.md) |
| **P9-002** | P0 critical | Private video pool and one-click Publish/Remove for Vega channel inclusion; delete private-draft artwork preview | Reported | [P9-002 details](issues/P9-002-video-channel-inclusion.md) |
| **P9-003** | P1 required | Reorder Home quick actions: orange Edit Channel, Add Media to Library, one-click View fullscreen | Reported | [P9-003 details](issues/P9-003-home-quick-actions.md) |
| **P9-004** | P1 required | Single persisted media-rights confirmation during Add Media; remove repeated blockers/status jargon across Studio | Reported | [P9-004 details](issues/P9-004-one-time-media-rights-confirmation.md) |
| **P9-005** | P1 required | Compact Pages & Layout editor: borderless icon actions, animated drag section reorder, distinct New Page, top compact Add Section | Reported | [P9-005 details](issues/P9-005-compact-channel-layout-editor.md) |
| **P9-006** | P1 required | Formal image-upload popup for channel logo, app background and image sections; aspect-safe display and Vega export | Reported | [P9-006 details](issues/P9-006-channel-branding-image-uploads.md) |

## Per-issue companion-file contract

Every new issue gets a permanent sequential **P9-NNN** ID and a separate Markdown file under `docs/tasks/p9-polish/issues/`, linked from this index. Record:

- Original observed problem and **screen/workflow**.
- Date and screenshot reference/description; do not claim screenshots are committed unless actually present in repo.
- Exact **requested/expected behavior** (and, when useful, before/after user journey).
- Boundaries protecting already-working features, existing data, rights, ownership and releases.
- Practical, testable **acceptance criteria**.
- Priority, status, dependencies and overlap with unfinished Phase 8 work.

Issue intake is **documentation only**. Don't implement an issue when it is merely reported. Group and prioritize the collected issues into the smallest safe manual/runner prompt batch after collection. `P0` = core journey broken or seriously confusing; `P1` = deadline-required usability; `P2` = optional polish only if time.

## Immediate MVP user journey

Create channel -> Channel Editor -> add/upload video privately -> explicitly include ready video in channel -> verify same state in interactive Vega Preview -> export working Vega package.

**Critical terminology:** A per-video **Publish** in P9-002 means inclusion in channel draft/next export, **not** Amazon submission, a new hosted live release, or an update to already-installed Vega apps. Preserve existing protected live release separately.

## Issue collection procedure

Append exactly one row to the index per new ID. Preserve the companion description as written; later discoveries can be logged as dated clarifications rather than silently replacing the originally reported problem. After issue intake, review for duplication and dependencies with P8C before creating implementation prompts.

## Documentation and concurrency

These notes live initially on a **dedicated docs branch** while Phase 8 Codex work continues; this avoids altering `main` or forcing in-progress implementation agents to reconcile a documentation-only commit. Reconcile/merge only when safe. No code changes, schema changes, staging deployment, version bump, or active publishing changes were made by recording these issues.

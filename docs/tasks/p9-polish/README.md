# Phase 9 — MVP Polish: issue register

**2026-10-22 owner-approved Phase 8 closeout:** Phase 8 is CLOSED BY OWNER with explicitly carried NOT GREEN qualification exceptions; Phase 9 begins at clean baseline 0.9.0. The P9 issues below are still NOT IMPLEMENTED by documentation alone. Earlier references to an unapproved Phase 8 transition below are dated history.

**Owner decision:** 2026-10-22  
**Deadline:** 2026-10-23 noon (owner delivery deadline; verify authoritative timezone in final handoff)  
**Status:** ELEVEN issues documented (P9-011 added); one-issue-at-a-time manual Phase 9 prompts **AUTHORED, NOT EXECUTED**. Phase 8 P8D final closeout is NOT GREEN and `c8-hero-multimedia` correction must be reconciled first. See [active Phase 9 prompt plan](../p9/README.md).

## Scope pivot

The previously authored `docs/tasks/p9/` **Live Channel Publishing & App Updates** plan is **deferred beyond the MVP deadline**. Phase 9 will instead be **MVP Polish**: make the working core product understandable, remove unfinished/planned UI paths that did not make the MVP cut, stabilize create/edit/video/export, and give testers a truthful channel experience.

This issue journal records **owner-reported problems**, not implementation completion or source truth. Do not mutate old Phase 9 publishing evidence or pretend the product has been changed merely because these reports exist. The [new Phase 9 manual prompts](../p9/README.md), [assessment](../p9/prompt-assessment.md) and [implementation plan](../p9/implementation-plan.md) are now authored: ten existing mainline prompts plus one independent [P9-011 correction](../c9-multimedia-editor/README.md), followed by one final integrated smoke. Each agent must reconcile actual Phase 8 result, code/version and staging before execution. The previous publishing prompts have been migrated to [deferred Phase 10](../p10/README.md). No implementation, source version change or deployment is implied by prompt authoring.

## Issue index

| ID | Priority | Problem | Status | Companion |
| --- | --- | --- | --- | --- |
| **P9-001** | P1 required | Remove second "02 First look" page from channel creation and go straight to Channel Editor | Reported | [P9-001 details](issues/P9-001-simplify-channel-creation.md) |
| **P9-002** | P0 critical | Private video pool and one-click Publish/Remove for Vega channel inclusion; delete private-draft artwork preview | Reported | [P9-002 details](issues/P9-002-video-channel-inclusion.md) |
| **P9-003** | P1 required | Reorder Home quick actions: orange Edit Channel, Add Media to Library, one-click View fullscreen | Reported | [P9-003 details](issues/P9-003-home-quick-actions.md) |
| **P9-004** | P1 required | Single persisted media-rights confirmation during Add Media; remove repeated blockers/status jargon across Studio | Reported | [P9-004 details](issues/P9-004-one-time-media-rights-confirmation.md) |
| **P9-005** | P1 required | Compact Pages & Layout editor: borderless icon actions, animated drag section reorder, distinct New Page, top compact Add Section | Reported | [P9-005 details](issues/P9-005-compact-channel-layout-editor.md) |
| **P9-006** | P1 required | Formal image uploads for logo, channel-wide and per-page backgrounds (with Apply to all pages), and image sections; Vega export parity | Reported — amended 2026-10-22 | [P9-006 details](issues/P9-006-channel-branding-image-uploads.md) |
| **P9-007** | P1 required | Standardize every Studio popup on New Page modal style, including all media and upload workflows and illustrative choice graphics where useful | Reported | [P9-007 details](issues/P9-007-unified-desert-heat-modal-design.md) |
| **P9-008** | P1 required | Fix clipped foreground artwork in interactive/fullscreen Vega Preview and export; support non-16:9 aspect ratios without breaking TV layout | Reported | [P9-008 details](issues/P9-008-prevent-preview-image-clipping.md) |
| **P9-009** | P1 required | Redesign login with the owner-approved cyberpunk Desert Heat canyon image and a compact centered Google sign-in card | Reported; visual approved | [P9-009 details](issues/P9-009-login-page-redesign.md) |
| **P9-010** | P1 required | After P8D, formalize Library sections for Videos, Audio, Books and non-content Assets (logos/backgrounds/section art) | Reported; depends on P8D | [P9-010 details](issues/P9-010-multimedia-library-formalization.md) |
| **P9-011** | **P0 critical** | Make Video, Audio MP3 and Books selectable from Channel Editor in Hero/Rows/Grids, with More info and type-correct Watch/Listen/Book detail | Reported; manual correction authored, NOT RUN | [P9-011 details](issues/P9-011-mixed-media-sections.md) |

## Per-issue companion-file contract

Every new issue gets a permanent sequential **P9-NNN** ID and a separate Markdown file under `docs/tasks/p9-polish/issues/`, linked from this index. Record:

- Original observed problem and **screen/workflow**.
- Date and screenshot reference/description; do not claim screenshots are committed unless actually present in repo.
- Exact **requested/expected behavior** (and, when useful, before/after user journey).
- Boundaries protecting already-working features, existing data, rights, ownership and releases.
- Practical, testable **acceptance criteria**.
- Priority, status, dependencies and overlap with unfinished Phase 8 work.

The owner-approved P9-009 canyon background is preserved in the 2026-10-22 image-generation conversation, **not yet committed to this repository**; P9 implementation must acquire that exact asset rather than inventing a substitute. P9-010 is conditional on the **actual P8D multimedia baseline**, which should be independently verified at implementation time.

Issue intake is **documentation only**. Don't implement an issue when it is merely reported. The eleven issue IDs are stable; existing P9 P1–P11 prompt files are not renumbered; [c9-multimedia-editor](../c9-multimedia-editor/README.md) separately owns P9-011.  follow the [manual execution order](../p9/README.md) with one staged/browser-validated issue at a time (NO runner). `P0` = core journey broken or seriously confusing; `P1` = deadline-required usability; `P2` = optional polish only if time.

## Immediate MVP user journey

Create channel -> Channel Editor -> add/upload video privately -> explicitly include ready video in channel -> verify same state in interactive Vega Preview -> export working Vega package.

**Critical terminology:** A per-video **Publish** in P9-002 means inclusion in channel draft/next export, **not** Amazon submission, a new hosted live release, or an update to already-installed Vega apps. Preserve existing protected live release separately.

## Issue collection procedure

Append exactly one row to the index per new ID. Preserve the companion description as written; later discoveries can be logged as dated clarifications rather than silently replacing the originally reported problem. After issue intake, review for duplication and dependencies with P8C before creating implementation prompts.

## Documentation and concurrency

This register originated on `docs/p9-polish-issue-register` and was copied to the current-main-derived `docs/p9-polish-manual-p10-deferred` planning branch. Reconcile/merge safely with live Phase 8 Codex work; no destructive reset/rebase/stash. Neither documentation branch implies active Phase 9 product source. No code changes, schema changes, staging deployment, version bump, or active publishing changes were made by issue and prompt authoring.

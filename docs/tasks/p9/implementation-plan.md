# Phase 9 — manual issue-by-issue implementation plan

**Owner-approved baseline adjustment:** Phase 8 closed by owner at 0.8.17 source; clean Phase 9 entry baseline 0.9.0 already reserved. P1–P10 map 0.9.1 through 0.9.10 respectively; P11 no bump. Do not use these values until checking current source/version/previous issue commits.

**2026-10-22 / documentation-only authoring**. Execute only after reconciling c8-hero-multimedia and actual post-P8D local/staging source. Historical P8 closeout remains NOT GREEN. [Task README](README.md) is the execution contract; [issue companion files](../p9-polish/README.md) provide exact acceptance criteria.

## P9-011 P0 targeted manual correction (2026-10-22 owner addendum)

A new P0 issue, [P9-011](../p9-polish/issues/P9-011-mixed-media-sections.md), exposes a functional gap: Audio and Book catalog entries are absent from the Channel Editor section picker and need stable valid selection into the current ChannelSpec with the existing typed Hero/Row/Grid and More info/Watch/Listen/Book Showcase behavior. Use [`c9-multimedia-editor`](../c9-multimedia-editor/README.md), assessed and planned as ONE independently manual Sol High prompt with guarded staging + real owner Codex browser + native parity where possible. **No existing P9 P1–P11 renumbering and no extra preassigned 0.9.x version**; keep the correction at actual version where safe. Run before P11; if earlier P9 P2/P3/P8 code overlaps, reconcile completed commits first. Report native media delivery accurately, never assume private MP3 playback equals native public delivery.

## Manual sequence / suggested version mapping

| Manual step | Issue | Candidate root version (conditional) | Dependency / test nucleus |
| --- | --- | --- | --- |
| P1 | P9-001 | 0.9.1 | Direct name→channel draft→editor; prevent dupes |
| P2 | P9-004 | 0.9.2 | One saved rights check; avoid repeated UI warnings and bypass |
| P3 | P9-002 | 0.9.3 | Channel-inclusion state; one-click publish/remove; preview/new export parity |
| P4 | P9-007 | 0.9.4 | Modal audit, New Page visual baseline, all media/upload dialogs |
| P5 | P9-006 | 0.9.5 | Owned images, logo/title, global/per-page background rules, image sections/native |
| P6 | P9-008 | 0.9.6 | Contain foreground non-16:9, background cover; Studio/native |
| P7 | P9-005 | 0.9.7 | Compact rail; drag lift/shifting/drop, persistence and keyboard equivalent |
| P8 | P9-010 | 0.9.8 | Library Videos/Audio/Books/Assets, truthful workflows and reuse |
| P9 | P9-003 | 0.9.9 | Home CTA reorder, Library Add Media, instant interactive fullscreen |
| P10 | P9-009 | 0.9.10 | Exact approved canyon + centered login, real Google OIDC |
| P11 | Final smoke | unchanged | One full MVP walkthrough + one final aggregate |

Versions are **provisional** and valid only after local preflight confirms agreed entry and all previous accepted commits; don't bump solely to meet a table. No runner commands for P1–P11.

## Per-issue procedure (mandatory, repeated inside each prompt)

1. Inspect `AGENTS.md`, relevant `docs/tasks/p9-polish/issues/P9-NNN*.md`, prior stage/evidence and actual changed source. Read latest `docs/tasks/c8-hero-multimedia/closeout.md` if present; do not assume correction GREEN. Align current git status/root+root lock versions, and check no conflicting work.
2. Implement **only** issue; focused tests, changed-package typechecks/build and diff. Commit candidate and root/lock version consistent with actual baseline; if issue already fixed, verify without churn.
3. Stage **committed source archive** on muffinos via approved SHA256 verified guarded runbook; record active stage/version/assets/schema15-compatible encrypted backup/previous rollback; public FREE #1 unchanged. No new privileged grant or unauthorized migration.
4. After fresh deployed readback, use connected Codex browser signed in as owner, reproduce original and verify acceptance at useful viewport(s), refresh/reopen, negative/failure and regression checks; capture private screenshots/logs references. If relevant, prove actual native VirtualDevice/export behavior rather than inferring from Studio.
5. If needed at most two bounded repair → focused test → new commit/archive/deploy → browser cycles. On regression rollback. Record independently honest scoped GREEN/NOT GREEN/BLOCKED in a per-prompt evidence file before moving on.
6. P11: one final `npm run test` after source settles, exact-source authenticated creation/upload/include/TV/export/Google login browser walkthrough, native proof for changed contracts as practicable, and a compact list of known residual defects, no re-run of complete earlier qualification suites.

### Scheduling / risk order

P0 video inclusion is third because the underlying rights attestation needs to be simplified safely first. The top modal standard is before image assets. Library inventory follows both P8D and image assets. Home actions follow a working Library. Login is last because its missing approved binary asset is a noncore blocker.

When runway narrows, **do not try ten simultaneous deployments** to shared staging. A single active staging release is authoritative, so one owner prompt at a time. Prioritize a demonstrably functional end-to-end creator journey and an honest closeout over performing low-value cosmetics at the cost of security/native parity.

## Phase 10 boundary

The previous P9 immutable live updates and existing-app upgrade stack has been migrated to [Phase 10](../p10/README.md) in a **deferred planning state**, not executed. No per-asset Publish click in Phase 9 triggers it. Keep historical Phase 8/c7 evidence unchanged.

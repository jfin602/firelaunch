# Phase 9 — MVP Polish (owner-approved scope, manual Codex browser execution)

**Plan authored:** 2026-10-22. **IMPLEMENTATION NOT STARTED BY DOCS AUTHORING.** These are one-issue-at-a-time **manual Codex prompts**. All authoring lives on `docs/p9-polish-manual-p10-deferred` until safely merged; reconcile with any actively running c8-hero-multimedia work before merging or running. No automatic stage deploys or version bumps from writing docs.

**Owner decision:** The old [Live Channel Publishing & App Updates plan](../p10/README.md) becomes **DEFERRED Phase 10**. The only active new Phase 9 goal is an understandable, working **create → media → channel → TV Preview → Export** MVP. Preserve approved FREE public release #1 unchanged. Per-media **Publish** in P9-002 means **include in channel draft/next fresh Vega export**, not OTA or remote publication of an installed app.

## Entry evidence, not assumptions

At the time of this review, committed `main` root is **0.8.17** and [P8D final Phase 8 closeout](../p8/closeout.md) is **NOT GREEN**; real Video/Audio MP3/Book Showcase work is present, but some mixed-media/natively deployed behavior remains unqualified. [c8-hero-multimedia](../c8-hero-multimedia/README.md) is the current separately running/planned correction at **unchanged 0.8.17**, so **do not start P9 based solely on this dated GitHub readback**. The owner has authorized a scope pivot, not a fictional Phase 8 GREEN. First executing agent checks real local HEAD/dirty worktree/origin, latest Phase 8 correction evidence, package and BOTH top-level root lock versions, plus active staging release/schema, and resolves any overlap without discarding work.

**Preferred version allocation if entering from an accepted 0.8.17 baseline:** P1 `0.9.0`, P2 `0.9.1`, ... P10 `0.9.9`. This is a *planning guide, not authority to overwrite a changed baseline.* Each implementing agent reviews and owns the next semver, changes root package plus both root lock fields together, commits product source, and deploys the exact committed candidate. P11 final smoke has **no version bump**. If actual baseline differs, reconcile/adjust docs coherently instead of applying a predetermined bump.

## Manual prompt sequence — one issue per prompt

| Run | Issue | Prompt | Work | Priority |
| --- | --- | --- | --- | --- |
| **P1** | P9-001 | [Simplify channel creation](P1-channel-creation.txt) | Single name→Create→Editor | P1 |
| **P2** | P9-004 | [One-time rights](P2-one-time-rights.txt) | Persist one creator attestation; quiet repetitive UI | P1 |
| **P3** | P9-002 | [Video inclusion](P3-video-inclusion.txt) | Private pool and single Publish/Remove from Vega app | **P0** |
| **P4** | P9-007 | [Unified dialogs](P4-modal-system.txt) | New Page popup becomes app-wide modal standard | P1 |
| **P5** | P9-006 | [Upload/apply image assets](P5-image-assets.txt) | Logo; global/page backgrounds; section art | P1 |
| **P6** | P9-008 | [No foreground clipping](P6-foreground-artwork.txt) | Contain image content vs decorative cover | P1 |
| **P7** | P9-005 | [Compact layout editor](P7-layout-rail.txt) | Icon actions, drag reorder, page/add-section hierarchy | P1 |
| **P8** | P9-010 | [Multimedia Library](P8-multimedia-library.txt) | Video, Audio, Books and reusable design Assets after P8D | P1 |
| **P9** | P9-003 | [Home quick actions](P9-home-quick-actions.txt) | Edit Channel / Add Media / View fullscreen | P1 |
| **P10** | P9-009 | [Login redesign](P10-login-redesign.txt) | Approved cyberpunk canyon and compact Google sign-in | P1 |
| **P11** | integrated only | [Final MVP smoke and closeout](P11-manual-closeout.txt) | One combined creator walkthrough; no feature expansion | qualification |

Issue requirements and tests remain authoritative in the [ten companion files](../p9-polish/README.md). Each prompt **fixes only its named issue**; cross-issue notes are dependencies/anti-regression checks, **not** permission to silently implement another issue in the same step. If an issue is already resolved in actual source, verify it on deployed staging, document evidence and avoid churning code/version unnecessarily.

## Every P1–P10 prompt MUST perform this loop

1. **MANUAL Codex with connected browser, GPT-6 Sol High unless a prompt specifies Medium. NO runner / validator / `/activate`.** Read `AGENTS.md`, own issue companion, this README, actual source, previous issue evidence, current version/stage. Check clean/coherent worktree, preserve any concurrent changes, never reset/stash/force; stop on overlap.
2. **Implement one issue.** Reuse working P8D/hero/Studio/Vega models. Rights/tenant isolation, exported native compatibility, working video/audio/books, protected manifests and staged rollback are mandatory. Narrow changes; no new Amazon release, CloudFront/IAM policy, AWS billable encoding or paid features.
3. **Test changed scope before deploy:** targeted tests, package typechecks/build as relevant, `git diff --check`, practical negative/edge case. Do not run the huge aggregate repeatedly; P11 runs one final aggregate. Fix bugs; record any skipped/blocked tests honestly.
4. **Agent owns code and version commit.** Change root `package.json.version` and BOTH root `package-lock.json` top-level versions for successfully implemented checkpoint (unless verified no-code issue); make scoped commit; save product SHA separately from evidence commit. No runner-controlled commits. Do not package dirty/uncommitted source.
5. **Protected staging deploy FIRST** from exact committed source via [standing-runbook](../../scripts/staging/README.md) on muffinos: verify current grants and service/schema (latest evidence **schema 15**, not old 14), SHA-256 archive + matching incoming, guard/backup/schema compatibility, healthy API + worker, retained old assets, rollback candidate, approved public FREE release #1 bytes/pointer unchanged. No unreviewed privileged commands or migrations under standing grant; if a schema change is necessary, stop for a separately reviewed safe path.
6. **Only AFTER deployed SHA/readback:** connected Codex browser at `https://firelaunch.jfin.dev/` with actual authorized creator login; fresh release/JS/CSS, reproduce issue, exercise happy, failure, reload/reopen, selected channel, keyboard and responsive visuals as relevant. Capture private screenshot references outside public Git. No cached UI, local-only tests or fake auth proof. When native parity is touched, use supported Vega real package/VirtualDevice evidence or label that gate **NOT GREEN**.
7. **At most TWO focused corrective loops** under this prompt: observed failing stage/browser → narrow code fix → targeted test → new commit/sha → new guarded deploy → fresh browser test. On serious regression use authorized rollback, preserve prior health. **No claim of GREEN merely because deployment succeeded.**
8. **Write and commit** `docs/tasks/p9/evidence/P#-P9-NNN.md`: actual product commit SHA vs evidence commit, versions, tests, active stage/archive/backup/rollback/schema, screenshots/browsed interactions, preserved release #1, scoped GREEN / NOT GREEN / BLOCKED, next issue handoff. If blocker remains, stop progression; optional targeted repair may be separately approved instead of inflating scope.

**Time discipline:** target 8 minutes, 15-minute implementation prompt cap; stages/browser may require evidence-driven work. No excessive architecture refactor or perpetual retries. **Never skip a safety/rights check, fake native evidence or quietly mark an unverified issue GREEN to meet a clock.** If a prompt can't be completed safely, record NOT GREEN + minimal handoff and stop.

## Timing and exit

Deadline: **Friday October 23, 2026, noon America/Chicago** (historical roadmap has contradictory timezone labels; verify organizer/owner at final handoff). Keep fast-changing integrated video/TV export issues ahead of purely cosmetic polish when time becomes scarce, without violating individual dependencies.

P11 is **one combined real browser MVP smoke** (and targeted actual device/export proof where practical), not another round of ten reimplementations. Unresolved P0s block launch-green. Preserve honest Phase 8 historical NOT GREEN and any genuine remaining P9 limitations; do not relabel Phase 10 publication as MVP-ready. There is no requirement to publish/update an existing installed app during Phase 9.

[Assessment](prompt-assessment.md) · [Implementation plan](implementation-plan.md) · [Issue register](../p9-polish/README.md) · [Deferred P10](../p10/README.md)

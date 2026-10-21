# P8 — Implementation plan: coherent Creative Studio and verified pipeline

**Date:** 2026-10-21 UTC. Approved [README](README.md) and [assessment](prompt-assessment.md). Documentation/prompt creation ONLY; no code, version, staging, cloud or public-release changes.

## Checkpoint contract

| Step | Version | Owner files/seams | Exit evidence |
| --- | --- | --- | --- |
| P1 Navigation | 0.8.1 | apps/studio/src/App.tsx, Home.tsx, menu routing/tests | Five reliable destinations, Channel subviews and Export Advanced Source; no lost endpoints |
| P2 Layout | 0.8.2 | App.tsx, style.css, Preview, editors and UI tests | Empty inspector gone; context selection/dismiss; full-width Library/Publish/Export; responsive real Preview |
| P3 Media | 0.8.3 | Catalog.tsx, VideoWorkspace/VideoReview/VideoUpload, OwnedArtwork, Home, Preview, focused server tests if needed | Saved/reopened catalog and ChannelSpec, accurate thumbnail/rights/HLS/private states |
| P4 Publication/Export | 0.8.4 | NativeExportWorkspace/Delivery, hosted-workspace source resolution, release-build input, Studio API and C7 queue seams | One-action export initiation/resume, release-bound safe source, protected edits and verified owner-only ZIP |
| P5 Manual closeout | 0.8.5 proposed | real browser and current staging+device evidence | focused owner walkthrough and docs/tasks/p8/closeout.md GREEN/NOT GREEN |

Use the checked-in tests and preserved route APIs. Do not create an additional ChannelSpec, catalog, video workspace, publication system, agent/chat instance, source builder or worker. Existing functionality must remain reachable through the new grouping. TV Preview is semantic real preview with D-pad/focus/Back, never decorative art.

## Entry/version/preflight
1. Confirm actual local HEAD/status, root package.json and both root lockfile version fields, latest c7-export-recovery R2/R3/R4 changes and source/API status, Phase 6 media work, and protected staging release. The GitHub main head and historical docs are not proof of local/staging status.
2. The current active c7 correction stays at root 0.7.3 and app schema 14; P7 R2–R4 remain separate and cannot be interrupted by P8. Obtain a safe coherent checkout/handoff before implementation. Do not reset, delete, stash without consent, or overwrite parallel changes.
3. After required P7 handoff, a separate reviewed **version-only entry** changes root package.json and both root package-lock version fields together to 0.8.0; no workspace version bump. Do not infer /docs-apply authorizes this. If the branch is still 0.7.3 or dirty, P1 must stop with actionable handoff rather than auto-upgrade.
4. Then run npm run codex:stack:validate -- p8. P1–P4 are runner-compatible sequential implementation checkpoints; P5 is one separately invoked, browser-required manual closeout. No /activate. Never run runner while the current manual c7 R2–R4 session is working in the same checkout.

## Time-optimized validation ownership

**Do not repeat whole-project builds/checks after P1–P4.** Root `npm run test` invokes `test:kernel` (which runs root `npm run build`), then all Studio tests and runner tests. All seven workspace builds already typecheck with TypeScript; root `npm run check` first performs an **extra** workspace-wide `--noEmit` typecheck before running those same build-backed tests. Reserve one `npm run test` for P5 **after** source settles. Do not separately invoke root build/typecheck/check or duplicate suites. If a later patch invalidates prior aggregate evidence, targeted verification first and repeat aggregate only when necessary for the changed final tree.

| Checkpoint | Mandatory focused evidence | Explicitly leave to later |
| --- | --- | --- |
| P1 | Actual navigation/component tests, Studio package typecheck (runner handles diff check) | Layout/browser/full build |
| P2 | Inspector/selection/focus/Preview tests and Studio typecheck (runner handles diff check) | P1 navigation suite replay, full device/UI regression |
| P3 | Artwork/private video/reopen/shelf/rights tests for changed components, Studio typecheck on changed code, changed-server typecheck/test if touched | C7 worker/ZIP, new encode, full media suite |
| P4 | One-click Studio entry and server source-snapshot regression incl. stale/custom/foreign/CSRF/duplicate job; typecheck touched Studio/server packages; runner handles diff check | Full build/aggregate, real worker/device retest |
| P5 | One real desktop creator journey + brief tablet/mobile spot checks; one `npm run test` (includes all builds/TS checks and suites) on final candidate, stack validation and diff check | Re-running unchanged R1–R3 or Q2/Q3 matrices |

Use discovered existing test file paths, e.g. `node --import tsx --test apps/studio/test/<actual>.test.tsx`, not unbounded `npm run test:studio` per step. If focused validation exposes an actual cross-package regression, escalate that **specific failing dependency** and explain why, rather than skipping tests or expanding to generic loops. P1 reads full baseline once; P2–P4 read prior handoff plus changed files/essential authority, not entire historical reports again. P5 uses a previously authenticated owner and saved content where possible; no fresh paid AWS jobs or native builds without a changed dependency and separately approved operator scope.

## P1 — Creator-oriented information architecture
Replace flat visible menu labels/destinations with five entries: Home, Library, Channel, Publish, Export. Use internal subview state or routing that leaves existing components mounted only as intended: Library -> Catalog; Channel -> AI Assistant (AgentPanel), Appearance (Design), Pages & Shelves (Content); Publish -> LivePublication; Export -> native Download/Build and Advanced Source (Delivery Code). Preserve account/project selection, existing Home cards/open-video, keyboard/aria-current, legacy deep entry points and current project restoration. Audit duplicate buttons, impossible actions and dead placeholders; do not remove genuine feature access or make a blocked unsafe hosted build appear enabled. No page-width redesign in P1.

Focused navigation/UI tests for changed routing, project switch and blocked action state; Studio package typecheck only. P2 owns layout/Preview interaction. Report route map and touched tests.

## P2 — Selection-based inspector and workspace composition
Eliminate always-mounted right inspector and permanent grid column. Only meaningful selected page/shelf/media tile/appearance property provides right-side inspector controls; deselection/close restores full-width. Open selection must be keyboard-reachable, keep focus/scroll predictable, and not lose unsaved form state without confirmation. In Channel editor support prominent toolbar TV Preview toggling or opening alongside editor, still using existing Preview semantics; no second preview renderer. Library/Publish/Export use full central workspace or existing modal. Mobile should use an accessible drawer/sheet or inline selected-editor section rather than an unusable fixed sidebar; test 375/768/1440 widths and reduced motion where feasible. Preserve desert canyon backdrop and colors, no gimmick panels.

Focused tests: open/close/deselect selection, unsaved edits, Escape/focus return and representative Preview keyboard control; typecheck Studio. Do not rerun P1 navigation suite or full browser/device tests. P5 owns real viewport observations.

## P3 — Draft/edit/media fidelity
Use actual ChannelSpec, CatalogItem/MediaAsset and Collection. Exercise minimal creator actions: create/use project, add or reopen a video, edit title/optional description/poster/shelf, reload/switch account/project and confirm persisted identity + selected artwork. Check private video upload/processing statuses and existing verified READY HLS Preview without public leak; differentiate file upload, encoded technical ready, rights-approved and live. Preserve one stable video identity, creator ownership and display/playback rights, optional subtitle independence; don't re-encode a video simply for a test. Repair only demonstrated source projection or UI defects with focused regression. No new media architecture or published-manifest schema changes.

## P4 — Approved publication vs one-action native export

**Single action contract:** Clicking **Build & Export App** in the Export workspace must immediately resolve/restore the matching job and, if eligible and not already running/ready, submit exactly one native export request. Remove the required second **Build App** click. Begin work on the direct click handler (one intentional user gesture), never automatically upon mounting/reopening the modal, polling or checking readiness. Preserve the existing owner-authorized, immutable source/build receipt, isolated C7 worker and four-file ZIP verifier; the user can navigate away and reopen progress. For an equivalent queued/running job, show status instead of another request; for a verified matching ready job, offer/download that ZIP instead of rebuilding. Failure/expired/changed inputs require a clearly labeled retry with fresh validation, not automatic loops. Once complete, a reliable **Download ZIP** control is mandatory; optional automatic download only where browser rules genuinely permit it, without hiding a blocked-download fallback.

**Release-bound safe source decision (server-side, not Code-page regeneration):**

| Existing source | P4 expected outcome |
| --- | --- |
| None | Generate an ephemeral source snapshot using the **exact approved published** ChannelSpec revision and owned deployment; do not persist it into Code editor |
| Valid, matching approved revision/fingerprint | Reuse the stored source as-is; keep valid custom edits |
| Stale saved source, with all files matching its trusted baseline | Generate replacement **ephemeral** build source from the immutable approved release, leaving stored source intact |
| Custom-edited source, current and valid | Build unchanged after existing security/identity validation |
| Custom-edited source, stale/incompatible/unsafe | Reject with an actionable "review/preserve your source" conflict; never discard/overwrite it |

An editable draft can be newer than the published release. Never silently use that draft for native export or invoke `HostedWorkspaceService.generate` (which targets current draft) to prepare the native package. Compare the stored generated baseline and modified files using existing source/fingerprint helpers and protect missing/unknown/unsafe assets. Build snapshots, queue receipts, status and download must remain bound to approved creator/project/deployment/package/release/source identities; revalidate rights, ownership and revision on submit, acceptance and download. Do not relax CSRF or the existing protected manual Code/Advanced Source workflow. No approved published release or deployment approval means one clear blocked state and next Publish action, **never** automatic creator publication.

**Publish distinction:** Publish controls explicit rights-reviewed immutable live content and rollback. Compatible catalog/layout updates can reach installed apps via approved manifest refresh without a fresh binary; native code, permissions, package identity or incompatible schema updates require a newly reviewed native release. Avoid suggesting FireLaunch submits to the Amazon Developer Console.

**Focused ownership/security validation:** Add deterministic regression for no source, stale unmodified source (including newer private draft), current custom source, stale custom conflict with unchanged saved bytes, missing publication/approval, duplicate click/enqueue, reopening during a queued build, ready reuse/download, stale/expired/foreign owner denial, CSRF, and verified ZIP identity. Run touched Studio and server test files plus package-specific typechecks only; **no full root builds, real AWS encoding, new public publication, native worker rebuild, ZIP/device requalification, or long polling loops** in P4. P5 owns one final aggregate and browser journey.

## P5 — Independent creator closeout
Single manual browser walkthrough: signed-in creator Home -> Library Add Video/reopen and artwork/rights -> Channel Appearance/Pages & Shelves/AI request where available -> TV Preview -> Publish read-only review (actual new release only with separate explicit owner authorization) -> **one Build & Export App click** that either immediately begins/restores the correct asynchronous job or exposes verified ready ZIP, with no Code/Regenerate Source and no second Build App action -> verify reload/reopen and owner-only Download ZIP fallback -> compare approved content to existing Phase 7 exact artifact/device evidence where available. Exercise stale-source and custom-edits branches in focused offline tests; a new real build job, publication or release modification requires separate authorization and is not invented for demo evidence. Exercise desktop (wide/narrow) and mobile navigation, closed contextual inspector, keyboard, error/retry and project switch. Reuse exact P7 device/ZIP proof; if missing, mark that acceptance slice NOT QUALIFIED. Run one aggregate `npm run test` on the stable final candidate unless an exact unchanged-tree aggregate pass already exists; do not separately rebuild or rerun full suites. Run focused tests only for newly repaired code. Record exact HEAD/version, browser/staging version, approved release, ZIP/VPKG hashes if actually tested, test counts, known gaps and GREEN/NOT GREEN. Don't relabel historical Q2 F7/P7/P5/c5. P5 never self-commits or deploys.

## Constraints and handoff
- Owned, reproducible, rights-safe, free-only MVP; immutable published release #1 remains unchanged absent owner permission; no paid encode, AWS/IAM/CDN change, Appstore login, broad auto catalog sync, new cloud infra, native builder rewrite or workspace secret leakage.
- Preserve Phase 6/7 tested contracts and staging rollback; no unsupported native device claims.
- Save focused checks in implementation checkpoints; a small exact repair is preferred over a broad cosmetic pass.
- P1–P4 commits may be runner-owned only when runner is actually invoked with a safely activated coherent 0.8.0 baseline. P5 is manually invoked and records evidence, not an automatic version/commit action.
# P8 — Implementation plan: coherent Creative Studio and verified pipeline

**Date:** 2026-10-21 UTC. Approved [README](README.md) and [assessment](prompt-assessment.md). Documentation/prompt creation ONLY; no code, version, staging, cloud or public-release changes.

## Checkpoint contract

| Step | Version | Owner files/seams | Exit evidence |
| --- | --- | --- | --- |
| P1 Navigation | 0.8.1 | apps/studio/src/App.tsx, Home.tsx, menu routing/tests | Five reliable destinations, Channel subviews and Export Advanced Source; no lost endpoints |
| P2 Layout | 0.8.2 | App.tsx, style.css, Preview, editors and UI tests | Empty inspector gone; context selection/dismiss; full-width Library/Publish/Export; responsive real Preview |
| P3 Media | 0.8.3 | Catalog.tsx, VideoWorkspace/VideoReview/VideoUpload, OwnedArtwork, Home, Preview, focused server tests if needed | Saved/reopened catalog and ChannelSpec, accurate thumbnail/rights/HLS/private states |
| P4 Publication/Export | 0.8.4 | Delivery.tsx, LivePublication.tsx, Studio api and existing c7 status/download seams | Correct explicit publish vs native export and readiness; real artifact only when P7 qualified |
| P5 Manual closeout | 0.8.5 proposed | real browser and current staging+device evidence | focused owner walkthrough and docs/tasks/p8/closeout.md GREEN/NOT GREEN |

Use the checked-in tests and preserved route APIs. Do not create an additional ChannelSpec, catalog, video workspace, publication system, agent/chat instance, source builder or worker. Existing functionality must remain reachable through the new grouping. TV Preview is semantic real preview with D-pad/focus/Back, never decorative art.

## Entry/version/preflight
1. Confirm actual local HEAD/status, root package.json and both root lockfile version fields, latest c7-export-recovery R2/R3/R4 changes and source/API status, Phase 6 media work, and protected staging release. The GitHub main head and historical docs are not proof of local/staging status.
2. The current active c7 correction stays at root 0.7.3 and app schema 14; P7 R2–R4 remain separate and cannot be interrupted by P8. Obtain a safe coherent checkout/handoff before implementation. Do not reset, delete, stash without consent, or overwrite parallel changes.
3. After required P7 handoff, a separate reviewed **version-only entry** changes root package.json and both root package-lock version fields together to 0.8.0; no workspace version bump. Do not infer /docs-apply authorizes this. If the branch is still 0.7.3 or dirty, P1 must stop with actionable handoff rather than auto-upgrade.
4. Then run npm run codex:stack:validate -- p8. P1–P4 are runner-compatible sequential implementation checkpoints; P5 is one separately invoked, browser-required manual closeout. No /activate. Never run runner while the current manual c7 R2–R4 session is working in the same checkout.

## P1 — Creator-oriented information architecture
Replace flat visible menu labels/destinations with five entries: Home, Library, Channel, Publish, Export. Use internal subview state or routing that leaves existing components mounted only as intended: Library -> Catalog; Channel -> AI Assistant (AgentPanel), Appearance (Design), Pages & Shelves (Content); Publish -> LivePublication; Export -> native Download/Build and Advanced Source (Delivery Code). Preserve account/project selection, existing Home cards/open-video, keyboard/aria-current, legacy deep entry points and current project restoration. Audit duplicate buttons, impossible actions and dead placeholders; do not remove genuine feature access or make a blocked unsafe hosted build appear enabled. No page-width redesign in P1.

Focused unit/UI tests for route mapping, each real main-menu destination, accessible subview selection, project switching, disabled/blocked capability state, quick actions. Keep old error and save flow. Report route map and touched tests.

## P2 — Selection-based inspector and workspace composition
Eliminate always-mounted right inspector and permanent grid column. Only meaningful selected page/shelf/media tile/appearance property provides right-side inspector controls; deselection/close restores full-width. Open selection must be keyboard-reachable, keep focus/scroll predictable, and not lose unsaved form state without confirmation. In Channel editor support prominent toolbar TV Preview toggling or opening alongside editor, still using existing Preview semantics; no second preview renderer. Library/Publish/Export use full central workspace or existing modal. Mobile should use an accessible drawer/sheet or inline selected-editor section rather than an unusable fixed sidebar; test 375/768/1440 widths and reduced motion where feasible. Preserve desert canyon backdrop and colors, no gimmick panels.

Tests: open/close/deselect selection, click-outside if deliberately supported, unsaved edits, escape/focus return, responsive overflow, real keyboard/remote Preview. No screen should reserve an empty rail.

## P3 — Draft/edit/media fidelity
Use actual ChannelSpec, CatalogItem/MediaAsset and Collection. Exercise minimal creator actions: create/use project, add or reopen a video, edit title/optional description/poster/shelf, reload/switch account/project and confirm persisted identity + selected artwork. Check private video upload/processing statuses and existing verified READY HLS Preview without public leak; differentiate file upload, encoded technical ready, rights-approved and live. Preserve one stable video identity, creator ownership and display/playback rights, optional subtitle independence; don't re-encode a video simply for a test. Repair only demonstrated source projection or UI defects with focused regression. No new media architecture or published-manifest schema changes.

## P4 — Approved publication vs native export
Keep explicit creator-reviewed content publication separate from native package Export. Publish shows immutable draft/live diff, approval tied to current project/catalog revisions, release history/rollback, and rights-blocked reasons. Export surfaces truthful queued/building/ready/failed/expired and owner-only verified VPKG ZIP from c7 R3 or exact blocked reason. Do not equate data-only content updates with needing a native rebuild: compatible approved manifest updates may appear in already-deployed apps without binary re-export; native code/permissions/schema/package changes need new release. Ensure no secret/signed private asset references in public manifest/artifact; preserve owner/CSRF/revision checks. If R2/R3/R4 aren't real/qualified, leave states honest, record dependency; never run unsafe build/duplicate worker or claim installed-device success. Tests: publish vs export navigation, approval/revocation display, download readiness and negative state.

## P5 — Independent creator closeout
Single manual browser walkthrough: signed-in creator Home -> Library Add Video/reopen and artwork/rights -> Channel Appearance/Pages & Shelves/AI request where available -> TV Preview -> Publish read-only review (actual new release only with separate explicit owner authorization) -> Export current verified job/ZIP -> compare approved content to Phase 7 actual external VVD evidence where accessible. Exercise desktop (wide/narrow) and mobile navigation, closed contextual inspector, keyboard, error/retry and project switch. Reuse exact P7 device/ZIP proof; if missing, mark that acceptance slice NOT QUALIFIED. Run focused tests for changes and one aggregate check only as appropriate. Record exact HEAD/version, browser/staging version, approved release, ZIP/VPKG hashes if actually tested, test counts, known gaps and GREEN/NOT GREEN. Don't relabel historical Q2 F7/P7/P5/c5. P5 never self-commits or deploys.

## Constraints and handoff
- Owned, reproducible, rights-safe, free-only MVP; immutable published release #1 remains unchanged absent owner permission; no paid encode, AWS/IAM/CDN change, Appstore login, broad auto catalog sync, new cloud infra, native builder rewrite or workspace secret leakage.
- Preserve Phase 6/7 tested contracts and staging rollback; no unsupported native device claims.
- Save focused checks in implementation checkpoints; a small exact repair is preferred over a broad cosmetic pass.
- P1–P4 commits may be runner-owned only when runner is actually invoked with a safely activated coherent 0.8.0 baseline. P5 is manually invoked and records evidence, not an automatic version/commit action.
# c6-desert-heat-studio — Prompt assessment

Date: 2026-10-17 UTC
Status: Assessment and prompt-stack authoring; implementation NOT STARTED
Baseline reviewed: GitHub `main` after Desert Heat docs approval `ae0f2ca6740a07b8695b4d3b22d8329d1a166996`; root package version `0.6.7` at authoring. Recheck actual checkout/version before execution.
Decision: [Studio visual baseline](../../design/studio-visual-baseline.md), [ADR 0012](../../decisions/0012-studio-visual-identity.md), [reference provenance](../../design/references/README.md).
Workflow: [docs/workflow.md](../../workflow.md).

## Goal and user-approved non-negotiables

Convert the **creator Studio** into the owner-approved "Desert Heat — Dark Cinematic" visual system, not a simple palette swap: real full-viewport edge-to-edge shell, stable left navigation/topbar, central flexible hero/content with dimmed canyon, right contextual panel, warm high-value accents, neutral elevated surfaces, contemporary typography/spacing, usable mobile/tablet adaptation, and believable, naturally colored film artwork.

The approved screenshot depicts fictional controls, statistics, names and movies; **do not** add unsupported Templates, Community, Analytics, fake progress or sample inventory. The Studio theme does not change a creator's `ChannelSpec.brand` or generated Vega package. Treat [reference hash/provenance](../../design/references/README.md) as the immutable comparison target, **not** a deployable backdrop.

## Current repository facts and gaps

1. `apps/studio/src/style.css` is a dense stylesheet with olive/lime token-like hexes (`#d8f66c` and green tints), broad `button`, `.sidebar`, `.topbar`, `.workspace`, `.inspector` rules, P0 preview styles, plus recent video upload/catalog classes. A blind global color replacement risks TV Preview and focus, rights badges, form contrast and states.
2. `apps/studio/src/App.tsx` owns `Catalog | Create | Design | Content | Code | Build | Publish` selection and project/session state. The default existing project surface is Catalog, and central Preview remains visible with a right inspector. There is no actual dashboard Home route; a media-first overview must be **read-only/adaptor-driven**, keeping all existing routes reachable.
3. `apps/studio/src/Preview.tsx` isolates the creator TV brand through `--tv-accent`, `--tv-bg`, `--tv-text` from `spec.brand`, with keyboard/D-pad behavior. Shared CSS changes must not bleed into those variables, focus borders or TV content.
4. `apps/studio/src/Catalog.tsx` already has an "Add Video" entry, a catalog-library list and rights-aware selection. It renders `item.creatorOverrides?.artworkUrl ?? item.sourceRecord.metadata.artworkUrl`, and a `VideoLibraryStatus` record per eligible video; do not invent public artwork URLs or treat a source listing as TV rights.
5. `apps/studio/src/VideoUpload.tsx` provides MP4 selection/drop, optional thumbnail, rights checkbox, private upload/progress, retry and processing messaging. Preserve validators, abort/retry, owner/project scope, upload session data and accessible status messages.
6. `apps/studio/src/api.ts` exposes existing owner-scoped `listProjects` / `readCatalog`; use these for a current-project dashboard without a new server endpoint or unfiltered account-wide media fetch. React races, stale project selection, session expiry and private thumbnails must remain safe.
7. Studio test files include `auth.test.tsx`, `catalog.test.tsx`, `video-upload.test.tsx`, `workflow.test.tsx`, `preview.test.tsx`, `delivery.test.tsx`. Preserve these; add lightweight contract/interaction tests near each changed UI.
8. `docs/design/references/README.md` records a source screenshot checksum, but the image binary is **not committed**. Do not claim pixel comparison without exact source. A photographic-grade standalone canyon asset is also not supplied: acquire an authorized asset through an explicit owner/supported asset workflow, or implement an original restrained fallback and record visual-fidelity gap.

## Risks by severity

- **High — functional navigation regression:** adding Home, changing default route, changing project switches or moving inspector can orphan Catalog, Create/Agent, Design/Content, Preview, Build/Publish. Preserve labels and calls; test keyboard and smoke interactions. Reject second parallel Studio/editor/navigation systems.
- **High — tenant/rights truth:** dashboard must never show previous project images during switch, foreign records, private S3 object URLs, unpublished public video links or fictitious processing approval. Async fetches must be scoped and stale-result guarded.
- **High — preview brand/focus contamination:** globally scoped CSS might recolor or alter interactive TV Preview or video keyboard handling. Keep token scoping on the Studio shell, explicit TV brand exception.
- **Medium — massive stylesheet churn:** minified rules span unrelated P0/P6 features; prefer structured style extraction with minimal stable selectors and focused tests over blanket search/replace.
- **Medium — visual asset provenance:** screenshot is a composite mockup and cannot be a wallpaper. Source a standalone lawful canyon/illustration and validate independent media fixture rights. Owner reference missing from repo prevents exact screenshot check until supplied.
- **Medium — responsive/accessibility regressions:** overlay/rail reflow can hide upload, status or Preview. Screen-reader, keyboard, focus and mobile states require actual browser inspection.
- **Medium — execution context:** root `0.6.7`, Node >=24.15, npm 12, dirty checkout, and runner's exact grammar/commit policy. No version changes or deployments authorized.

## Scope and dependency split

Six prompts are proportionate: **P1 tokens/materials/asset seam**, **P2 true full-bleed shell and responsive navigation/inspector**, **P3 truthful overview and media cards**, **P4 Catalog/VideoUpload visual integration**, **P5 remaining editor surfaces and a11y/regression convergence**, **P6 MANUAL independent browser/functional closeout**. Five implementation prompts target bounded (~8 minutes each, 15 max when feasible), then one aggregate/browser gate. Do not collapse P3 and P4: project-scoped dashboard data and the private upload/rights workflow have different test and state boundaries. Do not subdivide into per-color or per-component prompts.

## Invariants and non-goals

- No changes to server, DB schema, AWS MediaConvert, S3/CloudFront config, managed transcoding, native Vega, ChannelSpec contracts, release management, authentication policies, publishing authority or deployed VPS unless an independently discovered critical safety bug requires a separate owner-approved correction.
- No unapproved marketing pages, new analytics/template/community capabilities, unsourced movie poster downloads, fabricated data, hardcoded customer identifiers, decorative progress percentages, or unqualified final GREEN.
- No package/lock/workspace version bumps: correction **unchanged `0.6.7`**. If current root differs, STOP and update assessment/prompts with owner approval rather than bypass runner safeguards.
- Existing historical P0/c0/P2/c2/P4/P5/c5/P6 NOT GREEN and hosted S1–S6/device/cloud qualification remain independently traceable.
- Runner owns P1–P5 commits. P6 manual and must not commit. Do not deploy or modify live data.

## Validation strategy

P1: CSS tokens, asset fallback and style/build check. P2: shell/project navigation and responsive inspector behavior tests. P3: owned dashboard reads, stale-response isolation, loading/empty/error/media fallbacks, click-through. P4: uploader, upload states/rights, library thumbnails/retry. P5: focused UI-wide Studio suite/typecheck/build, keyboard/mobile/TV preview regression and `git diff --check`. P6: one final `npm run check`, runner grammar, independent real hosted/local browser screenshots desktop/tablet/phone, authorized upload/private processing, creator-TV theme independence, contrast/performance review. Report EXACT runtime/browser evidence and open asset gap; absent reference or licensed canyon can be NOT GREEN on visual fidelity while narrower functional gates pass.

Disposition at authoring: READY TO WRITE/RUN PROMPT STACK, **NOT IMPLEMENTED / NOT QUALIFIED**.

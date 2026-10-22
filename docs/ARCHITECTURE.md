# FireLaunch Architecture

## CURRENT C8 HERO MULTIMEDIA — shared focus and two native renderers (2026-10-22)

[Design](design/c8-hero-multimedia.md) and [correction](tasks/c8-hero-multimedia/README.md) are the next owner-approved source targets. Use `packages/tv/src/runtime.ts` existing `focusRows/transition/returnFocusId` to derive ONE transient selected hero item from the first selector row; no new ChannelSpec field/schema. Existing `apps/studio/src/Preview.tsx` and `templates/vega-channel/src/App.js` currently render separate giant Hero/card and first rail; scoped correction presents **one hero display + first row already visible at 720p/1080p**, same selected data and original device/player transitions. Native layout uses `templates/vega-channel/src/tv-layout.js`, guarding focus scrolling; portrait 2:3 and square 1:1 foreground use contain and same authorized art for optional atmospheric background. Private Studio blob/capability cannot escape into native package; installed-client unknown capability remains fail-closed. Other modules/pages remain intact.

Runner P1 shared state, P2 Studio renderer, P3 Vega renderer **browser=no**, 0.8.17 unchanged; P4 **browser=yes MANUAL**, mock artwork ATTACHED by owner to Codex, protected staging deployment FIRST, exact signed-in browser and genuine Vega display capture. If attachment or display missing, visual parity unqualified. This docs-only correction does NOT change current [Phase 8 NOT GREEN](tasks/p8/closeout.md) or approve P9. Prior c8-ui code/visual notes below are dated history.

---


## Current P8D execution boundary: runner + browser handoffs (2026-10-22)

The [P8D multimedia design and contracts](tasks/p8d/README.md) stay unchanged; owner switched from all-manual to RUNNER recognition. CLI runner implements/commits only browser=no P1 contract checkpoint `0.8.14`; browser-required P2 Audio, P3 same-book optional MP3 Book Showcase and P4 native publishing remain manually executed with version subjects `0.8.15`/`0.8.16`/`0.8.17` for resume, and browser-required P5 proposed metadata `0.8.18` does not bump actual 0.8.17. All true native/device, immutable-media/rights, installed-client compatibility and guarded staging gates persist; none can be bypassed by setting a false browser flag. Older no-runner P8D instructions below are execution history, not current authority.

---


## CURRENT IMPLEMENTATION BOUNDARY — P8D multi-media (2026-10-22)

Owner-cleared [P8D](tasks/p8d/README.md) from root/lock **0.8.13**, with [design contract](design/multi-media-creator-experience.md) and P1–P5 manual prompts ready. The prior [P8C closeout](tasks/p8/closeout.md) remains historically **NOT GREEN**; owner defers its two external/visual gates **for starting P8D**, not for declaring them qualified. No code changed by this documentation action.

Retain one canonical `CatalogItem` (`video|audio|book`) + `MediaAsset` (`video|audio|artwork`) and immutable owner rights. A standalone audio item and optional audiobook audio asset attached to a SINGLE book item use the same MP3 ingest, release delivery and TV audio player; book-only informational presentation has no player. P8D adds narrowly optional book-specific audio binding (not arbitrary `information.mediaUrl`), validates matching book/project/creator/asset rights in immutable PublishedManifest and makes older incompatible native app **Requires App Update/Blocked**. No second ChannelSpec/TV state or direct private URL in ZIP/manifest. Add Audio and Add Book are first-class creator-friendly Library modals reusing existing video uploader patterns; Book Showcase presents covers/synopsis, no EPUB/PDF/TV reader. Native templates `templates/vega-channel`, Studio Preview and TV runtime must agree in semantics before device success is claimed. Preserve prior video HLS paths, existing public release #1 and last-known-good.

At P8D authoring only P1 is cleared to execute; P2–P5 need accepted predecessor commits and measured environment. Guarded `muffinos` standing sudoers only authorizes the preinstalled exact-hash staging deploy/rollback workflow; schema/cloud policy/production changes still require separate owner/operator approval.

---


## Fullscreen overlay state addition — c8-ui3 P3 (2026-10-21)

Scoped to existing `apps/studio/src/App.tsx` fullscreenRoot/previewFullscreen/dockVisible, `Preview.tsx` remote/Exit presentation and fullscreen CSS only. Preserve ONE Preview/VideoPlayer, SAME mounted left editor, Fullscreen API/fallback, TV focus and keyboard commands. In fullscreen render TV at maximum fitting 16:9 without reserved control space; Virtual remote BOTTOM LEFT, Exit/Hide TOP RIGHT as overlays. Additional Clean View visibility mode hides all Studio overlays and uses H, top-right corner, Alt+E or Escape for safe recovery while never intercepting input fields/TV interactions. Existing P1/P2 normal-mode corrections unchanged. P4 protected deploy-first Codex-browser qualification, not P3. No ChannelSpec/native/runtime/rights/schema changes; Phase 8 OPEN.

## c8-ui3 Studio-only presentation boundary (2026-10-21)

[c8-ui3](tasks/c8-ui3/README.md) is a normal-mode UI composition correction after committed c8-ui2 P1–P3 at root/lock `0.8.10`. It changes only `apps/studio/src/style.css` and small `App.tsx`/`Preview.tsx` presentation areas as needed: flush global/editor sidebar and header, cool gray editor palette, Channel-wide solid dark canvas, largest safe borderless 16:9 TV and BELOW-TV utility row/remote. Preserve the single mounted `Preview`/TV/player, fullscreen LEFT overlay and existing `ChannelSpec` canonical contracts. No native Vega, schema, worker, approval or media changes. Staging qualification is c8-ui3 P3, protected-deploy FIRST, then authenticated Codex browser visual comparison using user's attached approved image; c8-ui2 P4 is superseded but historical prompt unchanged. Phase 8 OPEN.

## Current Channel workspace presentation correction — c8-ui2 (2026-10-21)

The post-P8B [c8-ui](tasks/c8-ui/closeout.md) was UI GREEN and staging DEPLOYED for a top-stage/bottom dock at `0.8.10`. New approved [c8-ui2](tasks/c8-ui2/README.md) replaces **presentation geometry only**: editor as a secondary fixed LEFT rail next to persistent main sidebar, existing Preview on RIGHT at 16:9, remote below TV; fullscreen's existing shared `channel-fullscreen-root` retains one Preview/Channel editor and transitions rail into a LEFT-edge overlay instead of bottom. Scope: `apps/studio/src/App.tsx`, `Preview.tsx` only if needed for remote placement, Studio-scoped `style.css`, related tests. No duplicate `TvState`, no new Content/Design implementation, no changes to module contracts, native renderer, auth, publication or video. Preserve P8B native static compatibility gate and historical Wave 2 NOT GREEN. See [design](design/channel-secondary-rail.md). Authored only, no new deployment, Phase 8 OPEN.

## Phase 8 Wave 2 design contract — approved direction, not implemented

[Wave 1 P5](tasks/p8/wave1-closeout.md) is GREEN/DEPLOYED within its staging UI/export scope (root `0.8.4` at tested release); Phase 8 remains OPEN. [Wave 2 `p8b`](tasks/p8b/README.md) is an owner-approved design continuation, not a started runner. [Human-first Page Layout design](design/page-layout-human-first.md) governs default templates, section controls, layout accessibility, Preview and native parity.

**Canonical data path:** `packages/contracts/src/index.ts` `Page.modules` currently supports `hero|rail|grid|text`; `packages/channel-engine` validates mutations and stable IDs; `packages/tv` projects modules/navigation/focus; `apps/studio/src/Preview.tsx` renders interactive TV; `templates/vega-channel/src/App.js` renders native output. Page templates **Hero/Grid/Rows** seed valid ordered modules from this existing model. They are NOT a parallel HTML/page-layout state that can drift. Existing project/channel versions remain compatible and creator-specific content/rights must be preserved.

**New sections and publishing:** Image Banner and Image + Text require narrowly bounded validated module variants, projection/Studio renderer and native Vega renderer support, old-spec preservation and rights-safe static artwork handling. Static informational art/text is non-focusable on TV; remote D-pad navigation stays on true interactive content. When Phase 9 supports compatibility classification, unknown/new module types are **Requires App Update / Blocked** for installed clients without that renderer, not automatically Publish Now. New native capability needs a qualified same-ID VPKG update; no arbitrary executable OTA or invisible approval.

**UI path:** Channel → **Pages & Layout** presents pages and central page composition with the existing contextual-only inspector; defaults need only name + template, optional Customize presets. **Full-screen Preview** reuses the same Preview and TV state, not a second runtime or arbitrary screenshot; handle browser Fullscreen API/fallback, focus restore and distinct Exit/TV Back actions without remounting playback. Test semantic Studio/Vega parity for new layouts and reuse prior C7 and Wave 1 evidence for unchanged paths.

## Current owner-approved phase handoff — October 21

[P7 owner closeout](tasks/p7/owner-closeout-2026-10-21.md) closes Phase 7/C7 as **accepted partial**, not GREEN, and approves the `0.8.0` root/lock **source baseline** for [Phase 8](tasks/p8/README.md). Existing C7 restricted build worker, authenticated owner ZIP, and installed Vega package's branding/artwork/Back/restart are evidenced; first-TS-fragment native moving video/audio/pause/seek remain NOT GREEN and carry into Phase 9 final acceptance. The version transition itself does not alter any native worker, generated source, media, database schema, deploy or public release. Historical plans below are superseded for Phase 8 entry ordering.

## Current forward architecture (owner decision October 20)

The active roadmap is [P7 native Vega export and C7 R4-only HLS repair](tasks/c7-export-recovery/README.md), [P8 Creative Studio UX & Pipeline Confirmation](tasks/p8/README.md), then [P9 final MVP qualification](tasks/p9/README.md). Older future phase numbering and FFmpeg guidance below is dated background, not a current implementation request. **C7 R1–R3 succeeded at their tested boundaries; exact installed VPKG displayed branding/artwork/Back/restart, but first TS-fragment HLS playback, visible video, audio and pause/seek are NOT GREEN.**

P7 must generate native Vega source from an authenticated creator's real ChannelSpec, CatalogItem/MediaAsset and ChannelDeployment with pinned public-only HTTPS PublishedManifest identity. The downloadable ZIP contains the verified x86_64 native VPKG, README/install instructions, nonsecret export provenance and SHA256SUMS. Host native builds only inside an isolated constrained worker with per-owner job authorization, CSRF, ephemeral filesystem, bounded CPU/disk/network/time, safe artifact collection/expiration and owner-scoped download. Never execute arbitrary creator code in the privileged shared staging API/VPS process. Validate build provenance, actual artifact, correct target package identity and no private URLs/credentials/foreign data.

The installed native app reads strictly approved immutable manifests from device-reachable public endpoints, renders verified published artwork and plays creator-approved FREE HLS in SDK-compatible media surfaces with remote navigation and restart. Private Studio Preview URLs, signed S3 originals, AWS credentials and unpublished data never enter exported manifests/packages.

P8 begins with a bounded creator-facing Studio navigation cleanup: **Home / Library / Channel / Publish / Export**, with Channel subviews **AI Assistant / Appearance / Pages & Shelves**, Export's **Advanced Source** preserved, and TV Preview prominent. The right desktop inspector is **contextual-only**, tied to an actual selected editing object; no permanent reserved grid column, while Library/Publish/Export remain full workspaces and VideoWorkspace retains its accessible modal. This is a routing/layout layer over the existing CatalogItem/MediaAsset, ChannelSpec, agent, publication, source and P7 export contracts, not a second editor or worker. Subsequent P8 checkpoints verify saved/reopened edits, artwork rights, private Preview, explicit immutable publication and exact approved content in a real installed client when P7 proof exists. P9 independently qualifies the Studio -> ZIP -> VVD -> playback/restart walkthrough. Physical hardware, paid access, billing and Appstore approval remain outside October 23.

No automatic catalog polling/diffs/reconciliation/auto-publication will be built. Manual initial/repeat catalog import, explicit creator approval, and installed-client refresh of already published revisions remain. MediaConvert background completion after creator upload is not catalog synchronization. Before any later code cleanup, audit legacy sync-oriented types/jobs and preserve data compatibility.

## Historical deployed/planned media architecture (2026-10-18; superseded by later evidence)

Read [CURRENT-STATE](CURRENT-STATE.md), [ADR 0011](decisions/0011-aws-vod-foundation.md), [ADR 0013](decisions/0013-hybrid-video-access.md), and [p6-live-vod](tasks/p6-live-vod/README.md) before executing any old implementation recipe in this architecture document. Real hosted Add Video private ingestion and owned Postgres/S3 persistence are STAGING UX GREEN; the managed MediaConvert processing adapter is offline LOCAL GREEN, but a real HLS job, approved free CloudFront release and native Vega VirtualDevice playback are NOT QUALIFIED. AWS Foundation nested-role/prefix correction was deployed and simulated at a dated checkpoint with queue PAUSED, EventBridge DISABLED and CloudFront DISABLED; reverify actual state.

The current encoding path is authenticated rights-owned S3 original -> durable verified control-plane MediaConvert intent -> privately staged complete HLS graph -> explicit creator rights/readiness approval -> immutable, free-only CloudFront delivery prefix and P5 PublishedManifest. Creator catalog/shelf placement intent persists even when unprocessed; incomplete media must not appear as playable content. S3 originals and staged output must never be public. Only `free` is in P6 scope; future purchase/rental/subscription needs protected viewer entitlements outside immutable manifest bytes. Historical FFmpeg worker plans and pre-existing phase-numbering references below are archival, not runnable instructions. Every AWS activation, cloud publication and staging change requires separate operator/creator approval.



## Planned c6-usability: persistent video workspace and two-hour media bounds (owner approved 2026-10-19)

The Studio video workspace is a modal/sheet opened by a stable owner-scoped CatalogItem identifier and project, not a transient upload-only form. One coordinator reuses the existing CatalogItem, MediaAsset, upload session, managed job, collection, ChannelSpec, ChannelDeployment and PublishedManifest paths. Display stages are projections of server facts. After close/reopen/reload, re-read authoritative owner-only API state and current channel/catalog revisions; guard against stale project/account requests. The modal's visibility is independent of durable MediaConvert work and in-tab multipart transfer ownership. Never abort a transfer on modal unmount; protect accidental browser exit while transfer is active, and label any non-resumable interrupted transfer honestly. Reopening a stored video cannot recover browser-only File handles automatically.

Stage boundaries: (1) initial minimal MP4/title and unchecked rights attestation, private draft; (2) active upload with real progress; (3) server-side verification and managed private HLS with retryable failure; (4) progressively review artwork/metadata/rights/provenance, existing basic Videos shelf and ChannelSpec linkage; (5) existing LivePublication readiness, explicit channel-wide creator approval and immutable release, never auto-publish. Channel-wide review must show the scope of other affected content. Postpublication edits are drafts until another approved release. Advanced import/rights/technical controls remain available but not first-step blockers beyond true policy requirements. No parallel rights engine, workflow database or publishing API unless proven necessary.

A two-hour file (7200 seconds) with the configured six-second HLS segments can produce about 1200 TS objects per rendition, ~2403 objects total for two renditions and playlists. Existing HLS verifier/approval/cleanup paths have 1800-second, 250-segment, 600-object, single-page S3 listing and 1000-object deletion caps; lift these safely with bounded, paginated, stream/memory-safe and idempotent operations. Maintain exact owner scope, expected canonical paths, S3 private originals/staging, verified checksums/MIME/HLS graph, fixed verified profile, no unexpected objects, and operator-only cleanup after recorded revocation. Do not merely increase constant checks or make arbitrary bulk deletes; verify all expected files and fail closed on truncation, unexpected entries or partial publication. Source upload has an independent 2 GB control-plane cap versus 250 MB client cap, and 1-hour session expiration that needs assessment. Chunk incremental hashing instead of buffering a multi-gigabyte File. Two-hour end-to-end acceptance is distinct from actual provider and Vega real-device qualification; preserve the Q2/Q3 independent gates.

## Objective

Make the common creator workflow deterministic enough to validate while retaining an explicit code escape hatch.

Dependency direction:

Studio UI
-> application services
-> ChannelSpec / channel engine
-> agent tools, preview projection, generator, readiness
-> adapters: filesystem, Bedrock, Vega toolchain

Generated Vega source is an output of the domain, not the source of truth for ordinary edits.

## Planned P0 repository shape

apps/
  studio/             React + TypeScript + Vite creator UI
  server/             Node + TypeScript local API/orchestration

packages/
  contracts/          ChannelSpec schemas and API contracts
  channel-engine/     validation, mutations, selectors, migrations
  agent/              provider-neutral ChannelAgent + Bedrock/mock adapters
  generator/          deterministic Vega project generation
  readiness/          build/publish checks and submission bundle logic

templates/
  vega-channel/       checked-in React Native for Vega application template

The preview can live in studio if TV rendering/navigation primitives remain independent from editor chrome.

## Process model

P0 is a local application.

The studio talks to the local server. The server owns filesystem persistence, generated-project access, model calls and local toolchain processes. Browser code does not receive arbitrary filesystem authority.

## Local storage

Default data root: .firelaunch-data/ (gitignored).

Suggested shape:

.firelaunch-data/
  projects/<project-id>/
    project.json
    channel.json
    assets/
    agent/
    generated/
    builds/
    submission/

All path operations enforce project-root containment and reject traversal/symlink escape where applicable.

## ChannelSpec

Use Zod or equivalent runtime schema.

Requirements:
- explicit schemaVersion
- stable IDs
- strict parsing at persistence/API boundaries
- sensible bounded strings/arrays
- migration hook from day one
- pure mutation functions
- no executable code inside ChannelSpec

Persist atomically.

## Preview parity

Do not build a bespoke preview that only looks similar.

Extract semantic TV components/rules so preview and generated Vega project implement the same page/module kinds, ordering, content resolution, brand tokens, focus/navigation intent and detail/playback transitions.

## TV navigation

Represent focusable elements with stable IDs and deterministic directional order.

Required behavior:
- arrows/D-pad move focus
- Enter/select activates
- Escape/back returns predictably
- page transitions establish deterministic initial focus
- focus never disappears
- virtual remote and keyboard drive the same command abstraction

Tests exercise navigation as commands, not mouse clicks.

## Agent architecture

ChannelAgent accepts project/channel context, visible user request and bounded tools.

Primary adapter: Bedrock Converse/tool use, configured by environment. Do not hardcode credentials. BEDROCK_MODEL_ID is configuration.

Mock adapter is deterministic and clearly labeled.

Agent tools call channel-engine functions. Model output is never applied before schema/tool validation.

## Code customization

Generation writes a complete Vega source tree.

Code surface provides project file tree, text editing for safe text files, save, changed-state indication and regenerate.

Contain edits within generated/.

Regeneration cannot silently erase custom edits. Detect dirty generated files and require a deliberate strategy.

## Vega integration

Target React Native for Vega.

Use Amazon Devices Builder Tools for AI context when available. Node 24 is the repository baseline because it satisfies current ADBT guidance and avoids the documented Node 26 SQLite compatibility issue.

Provide a toolchain doctor that reports Node, ADBT context where detectable, Vega SDK/dev tools, simulator/device visibility where detectable and exact missing prerequisites.

Generated manifest must include:
com.amazon.category.main

For a target using Vega SDK 0.24, the generated `manifest.toml` must also include `[os.version]` with compatible `target` and `min` (both `1.2` for Vega OS 1.2 in SDK 0.24), and matching package/runtime dependencies. Verify these requirements against the *installed* SDK; do not assume that the currently generated template or a declared npm dependency has been qualified. The `c0-real-tv-qualification` correction owns any compatibility repair demonstrated by real SDK validation.

Do not invent Vega CLI commands. Inspect installed tooling and current Amazon documentation/ADBT context during implementation.

Build execution is explicit, project-contained, bounded, captures output, and verifies artifact existence. Real qualification must record SDK/CLI version, target/runtime compatibility, exact invoked command and exit status, fresh nonempty `.vpkg` path and SHA-256, and evidence that the *same artifact* was installed on the target. Build output or generated source alone is insufficient. The current build wrapper command must be checked against the installed SDK before claiming compatibility.

## Publish/readiness

Readiness is a set of independently reported checks:
- channel/schema
- TV interaction
- Vega manifest/project
- build artifact
- store assets/copy
- support/privacy metadata
- device/simulator evidence
- human Amazon Console steps

## Security

- no credentials in repository/project JSON
- environment-based AWS auth
- path containment
- bounded assets
- safe media URLs
- no arbitrary server command endpoint
- generated code editing restricted to project workspace
- strict JSON parsing
- no HTML injection from model/content text

## Testing

T1 unit: ChannelSpec, mutations, migrations, focus commands, readiness.

T2 integration: persistence, API, agent tool execution, generator, custom-edit protection, process doctor/build wrapper.

T3 product: browser golden path and actual Vega simulator/device evidence.

P7 originally owned T3 final browser/platform closeout; after its NOT GREEN disposition, `c0-real-tv-qualification` owns targeted real Vega and device requalification. P2 owns only the earlier TV semantics/generator/toolchain discovery foundation.

## Launch-MVP hosted architecture extension (planned P1-P8)

The preceding local-file, loopback API and P0 repository descriptions remain historical. Post-P0 extends the deterministic ChannelSpec/TV engine rather than replacing them.

### Logical data path

```text
Authenticated creator -> project-scoped Studio/API
  -> permitted CatalogSource adapters (authorized Amazon, feed, file, upload)
  -> CatalogItem + MediaAsset + Collection + provenance
  -> ChannelAgent / visual editor -> validated ChannelSpec draft
  -> publish authorization + rights/compatibility checks
  -> immutable PublishedManifest + atomic deployment release pointer
                                       |
Creator-owned installed Vega application
  -> HTTPS deployment resolver -> versioned manifest -> approved media URLs
```

`ChannelSpec` is canonical for TV presentation; catalog records are canonical for inventory, source IDs and rights. Sync observations record external changes and apply only through validated catalog/editor services. A publish transaction snapshots *approved* state. A draft edit never directly updates live television.

### Persistent service boundaries

- Hosted relational persistence with schema migrations, revision/CAS writes, secure backups and recovery. Every project, catalog source, media asset, release and credential is scoped to a CreatorAccount.
- Private-by-default object storage for uploads; media delivery uses valid permitted TV-reachable HTTPS URLs, not loopback Studio fixtures.
- Secrets/token storage isolated from ChannelSpec, export, server logs, TV manifest and generated source.
- Connector adapters define required permissions, terms, supported data, rate limits, refresh cursor and revocation behavior. No claim of universal Amazon, KDP or Audible catalog access.
- Sync workers are idempotent, retry/backoff aware, support checkpoints and reconciliation polling, detect conflicts/missing items and queue creator review. Optional provider notifications accelerate but do not replace recovery polling.
- Creator-owned ChannelDeployment holds an app/package identity and live release pointer, independent of other creators' apps.
- Keep agent writes behind strict schema-validated tools and retain custom-code regeneration protection.

### Remote manifest contract

Published manifests are immutable, versioned, signed or integrity-verifiable where appropriate, and contain only TV-safe public data. The deployed Vega app fetches the compatible current release over HTTPS, validates it before activation, caches last-known-good state across restarts, and rolls back on bad releases or failed refresh. Private account data, drafts, source tokens or unlicensed media never ship in a manifest.

Ordinary compatible catalog, collection and layout updates are remote data changes. Native executable changes, installed dependencies, package identity, capabilities, permissions or incompatible schemas require a new qualified VPKG and applicable Appstore review. Verify Preview versus physical TV semantics independently.

**P5 concrete boundary (ADR 0009, 2026-10-11):** The server transactionally commits immutable per-deployment PublishedManifest bytes/digest and CAS-activates one live release pointer only after owner approval tied to current channel/catalog revisions and checked media rights. A public read-only HTTPS resolver returns ONLY published TV-safe manifests; creator publication writes remain authenticated and CSRF-protected. Informational books publish without playback, never with fake media or automatic rights grants. Hosted generated Vega projects bind a stable CreatorAccount-owned ChannelDeployment package ID, pinned HTTPS resolver and bundled safe baseline; installed TV validates identity, schema/compatibility/integrity, stores a fully verified last-known-good across restarts, and rejects bad/offline updates without blanking the app. Rollback creates a NEW higher-sequence release rechecked against current rights. A controlled temporary HTTPS staging endpoint suffices for Phase 5 device proof, but do not expose legacy local-unauthenticated APIs. The same installed VPKG must directly exhibit remote refresh and fallback on Vega VirtualDevice (physical Fire TV deferred to P8 launch, and not assumed proven). Automatic source sync (P6), Console submission (P7) and production S1–S6 security are separate gates.

### Authorization, recovery and evidence

Enforce per-creator authorization on all APIs, queue jobs, build/download routes and storage access. Include account export/deletion, data retention, revocation, backups, audit of source changes/publications and monitoring of failed sync/refresh. Provide rollback of an immutable published revision, not silent live mutation.

P1 defines contracts and Amazon connector feasibility; P2 hosts accounts/data; P3 imports catalog; P4 adds catalog-grounded generation; P5 implements remote manifests; P6 adds sync; P7 supports creator-owned release/limited SaaS operations; P8 qualifies creator pilots, security, physical TV and actual Appstore approval.

The 2026-10-09 `c0-real-tv-qualification` correction **did** directly prove an actual VPKG and Vega VirtualDevice navigation/playback for a tested candidate, but remained BLOCKED / NOT GREEN overall. P1–P3 can proceed without P0 Bedrock or full P7 GREEN. P5 must independently demonstrate real installed-app remote manifest updates; P8 still requires a supported production build environment, physical Fire TV and Appstore approval. Neither changes historical P7 status.

### Live AI provider boundary (post-P0)

P0's Bedrock-first demonstration is historical; the SaaS `ChannelAgent` remains provider-neutral. P1 defines provider capabilities and model/tool contracts without choosing AWS infrastructure. P2/P3 hosting and catalog import are independent of AI provider credentials.

P4 GREEN requires a live **non-mock** supported provider (OpenAI, Gemini, Bedrock or another suitable adapter) receiving actual imported catalog context, returning bounded validated mutations, persisting them in ChannelSpec and rendering a usable Preview. Mock tests remain deterministic and cannot substitute for real-provider evidence. Keep tokens and private catalog data out of public TV manifests and exported source. See [ADR 0008](decisions/0008-launch-ai-provider-policy.md).

Track final browser/editor regression and aggregate checks by P4, remotely updated installed Vega by P5, Publish evidence by P7 and supported production build host, physical Fire TV, default/demo asset replacement, content rights and Appstore approval by P8. This is a carry-forward of unresolved P0 evidence, not a reclassification of P7 as GREEN.

### Hosted P2 implementation boundary (approved 2026-10-10)

The historical `ProjectRepository` in `apps/server/src/repository.ts` stores a `ch_*` project JSON on the local filesystem, and `apps/server/src/api.ts` currently exposes uncredentialed project/mutation/agent/workspace routes; `WorkspaceService` directly reads and edits generated files and executes the local Vega CLI. These are P0-only trust assumptions, **not** a hosted security model.

P2 introduces an explicit server-side principal derived from a verified OIDC session (Google is the initial live issuer, behind a replaceable identity boundary), with independently authenticated creators. Protect OIDC issuer/audience/signature/nonce/state/PKCE checks, CSRF on mutating cookie-authenticated requests, secure cookie flags, logout/revocation and trusted-proxy origin handling. Test issuers are allowed only in an isolated test configuration, never automatically in hosted production. Never grant access based on a supplied creatorId, projectId, package name, client permission flag or unverified rights assertion.

The Postgres data model maps subject -> CreatorAccount -> owned ChannelProject -> optional unique ChannelDeployment, with creator-owned catalog/media/evidence metadata. Enforce globally unique native package identity, scoped foreign keys and transactional compare-and-swap revisions. Every query and job must carry and verify creator scope; enforce ownership before resolving any local file path, generated source or signed object reference. Cross-owner resource lookups must not leak object contents or existence. Use migrations and safe transaction retries, not an in-process map as an authorization source.

Private evidence/media objects live behind an S3-compatible provider boundary with private buckets, opaque object keys, scoped short-lived access and no raw public storage listing. P2 establishes ownership and storage operations, not final TV delivery URLs or P3 catalog ingestion. Credentials and tokens must never enter `ChannelSpec`, generated source, exported bundles, logs or TV manifests.

Hosted mode must deny unisolated source execution and the local build toolchain while retaining the historical local dev path explicitly. P2 preserves source inspect/export and bounded edits only with creator-scoped authorization and safe storage semantics; full isolated cloud build belongs to later qualification.

Migration from P0 must be an explicit, dry-runnable, idempotent creator-selected process validating the existing project fixture, preserving `ChannelSpec` and custom generated files, reporting collisions and quarantining corrupt/unsafe entries without modifying originals. Recovery covers a consistent database-plus-object snapshot, a real restore on disposable storage and tested restart/rollback behavior. Delete/export mechanics belong to P2 security; polished self-service account UX and billing stay P7.

P2 GREEN requires independently authenticated account A/B browser/API proof of isolation on every route category, successful new+existing project persistence after restart, representative local migration, backup/restore with private assets and no token/source leakage. Missing Google credentials or a runnable Postgres/object-store environment is a qualification blocker only if the required actual gate could not be exercised; do not fabricate external evidence.

### Phase 3 catalog import architecture (implemented and bounded-local-qualified 2026-10-10)

Use P1's strict `packages/contracts/src/catalog.ts` contracts and existing P2 session, PostgreSQL and private-object seams. The first implementation checkpoint uses automated two-principal authenticated route and private-object isolation regression; the real concurrent two-profile Google test is deferred to P3 P8. Preserve P2/c2 NOT GREEN staging gates separately. Every new catalog route and object must have a verified creator and project owner; source or external identifiers supplied by clients cannot select or authorize a creator account. Apply owner-scoped foreign keys and uniqueness to `(creatorAccountId, projectId, sourceId, provider/marketplace/kind/value)` or equivalent normalized identity. Transactions must make repeat imports idempotent, keep revision expectations stable and avoid orphaned partial source records.

The import pipeline is `creator session -> project-ownership check -> bounded source input -> parse/normalize -> validate provenance and rights -> preview diff -> explicit approval -> transactional catalog write -> collection curation`. Source payloads and source-provided fields remain separately observable from manual creator overrides; imports may propose but never silently overwrite creator-authored fields. A source state `discovered` does not imply permission to import, sync or deliver. A `CatalogItem` can represent non-playable books/listings with zero `MediaAsset` bindings; `ChannelSpec` remains only the approved TV presentation projection, owned by P4 generation.

For creator-supplied CSV/JSON imports, cap file bytes, record counts, nesting and string sizes; reject malformed encoding and unsafe structure, report per-row errors, and sanitize any later CSV export so cells cannot execute spreadsheet formulas. Do not allow arbitrary archive extraction or untrusted filenames to become filesystem paths. For one-shot HTTPS feed snapshots, use explicit allowlisted input types, DNS/IP checks on each resolution and redirect, reject private/loopback/link-local/metadata destinations (including IPv6), bound response bytes/time/redirects and parsed item counts; prevent DNS rebinding and unsafe decompression. Do not implement background source workers or polling until P6.

Store private uploads and rights evidence through P2's owner-scoped S3-compatible service; validate MIME by bytes where applicable, quotas, file names and object size, and bind media to the correct creator-owned catalog item. An upload does not prove television licensing; separately record display and playback rights and review evidence. Keep object keys, signatures, auth tokens and raw import payloads out of TV/public manifests and generated source. P5 independently qualifies TV-reachable rights-safe delivery URLs; P3 does not create public manifest releases. Hosted local native build execution remains disabled.

Cross-cutting gates from P2/c2: P3 P1 checks automated cross-tenant API/capability denial; P3 P7 repeats automated regressions for new routes. P3 P8 independently exercises two simultaneously authenticated real Google browser profiles and all route categories. Exercise hosted restart and portable source export. HTTPS staging callback/secure cookies and private HTTPS S3 source/restore buckets remain independent open release gates until directly proven. A local MinIO two-bucket drill is already positive evidence for its tested candidate, not automatically equivalent to remote HTTPS staging or production readiness. Preserve P2 P7/c2 NOT GREEN history and surface unqualified security gates in the P3 handoff.


### Phase 4 catalog-to-channel architecture (activated 2026-10-10)

Use `CreatorAccount session -> authenticated project ownership -> creator-selected catalog snapshot (CatalogItem/Collection/MediaAsset) -> use-specific rights/approval filter -> stable catalog-to-spec binding and deterministic type-specific composition -> revision-checked validated ChannelSpec mutation -> persisted draft -> Preview`. Imported source data, creator overrides, rendered spec content, rights evidence and publication are independent state layers; never let a model or browser invent owner authority.

The current ChannelSpec content contract requires `mediaUrl` and shared TV state enters playback unconditionally. P4 first introduces a narrowly compatible informational nonplayable/audio/video presentation contract, preserving old video fixtures and shared Vega/Studio focus/Back semantics. Source identity is not TV presentation identity; use stable mapping and a baseline/diff/creator-touch policy so regeneration cannot silently erase manual module/order/brand edits, create duplicates or overwrite custom source. Keep composition templates simple but truly differentiated for film, album/audio and author/book contexts.

Catalog grounding is a bounded server-side read-only capability for the current authenticated creator and selected project. Expose only rights-safe approved metadata; no S3 object identifiers, private evidence, tokens, signed URLs, user credentials or foreign catalog fields may enter model context or exported/generated source. Structured agent tool calls remain schema/revision validated. Provider adapters must preserve mock and Bedrock behavior while allowing another supported real non-mock provider; a live end-to-end provider/persisted mutation/Preview test is Phase 4 closeout evidence, not inferred from configuration.

Draft authenticated Preview may use an independently guarded short-lived private-media read capability, never persisted into ChannelSpec or reinterpreted as a public TV URL. P5 owns public immutable PublishedManifest and TV-reachable media, P6 automatic source sync, P7 creator app submission and P8 physical TV/Appstore proof. P2/c2 historical NOT GREEN and P3's hosted-release-open S1–S6 gates continue to apply.


## Approved AWS Media Foundation — future P6 (ADR 0010)

This extension does not modify or gate the authored P5 (0.5.x) manifest/VirtualDevice stack. Proposed pipeline: creator session -> owner-scoped presigned multipart upload -> private originals S3 -> durable FFprobe/FFmpeg job (separate worker, initially controlled Linux development host) -> format/rendition/segment inspection -> private immutable delivery S3 -> CloudFront Origin Access Control -> approved HLS URL in immutable ChannelDeployment release -> qualified Vega player. Only approved content becomes public; no automatic publication from upload or a processing webhook. Native runtime/player integration remains device-specific; Vega P6 qualification first, Android Fire OS and Roku later.

S3 originals, delivery objects, and P2/P3 small private evidence/backup storage must have separate permission boundaries. CloudFront OAC denies direct public S3 reads but does NOT provide viewer entitlements. Initial static public free-to-view HLS is allowed only with separately approved TV rights. Private or subscriber media needs future authorized playback resolution and a compatible revised native contract; never put expiring tokens, private S3 keys, AWS credentials or unlicensed material in a PublishedManifest/ChannelSpec. Upload and processing workers use scoped IAM, limited resources, quotas, immutable paths, hash verification, safe retries and accurate error/status reporting. No tenant-controlled command line or execution of arbitrary files on muffinos.

Initial encoding: H.264/AAC HLS; probe first, stream-copy only when profile/keyframes/segment alignment prove safe; otherwise 480p/720p adaptive ladder, optional 1080p, ~6-second aligned segments, no upscale. Pre-publish validate playlists, referenced objects, MIME, playback seek/recovery, rights and creator approval. Revocation protects new publishing and future delivery but existing CloudFront/TV caches may persist; document and test policy limitations.

P6 owns this delivery slice; future catalog sync is P7, creator-owned console and SaaS operations P8, hardware/Appstore/pilots P9. Previous P6/P7/P8 references in completed plans are historical; do not rewrite P5's P8 prompt number or past gate dispositions. See [ADR 0010](decisions/0010-aws-media-delivery.md) and [AWS setup/qualification](integrations/aws-media-delivery.md).

## Current creator VOD architecture (ADR 0011, 2026-10-14)

The original P6 FFmpeg architecture and implemented code at root 0.6.7 are historical starting points. **For new FireLaunch-managed creator uploads, the accepted target encoding provider is AWS Video on Demand on AWS Foundation (MediaConvert)**, NOT a local/VPS/laptop FFmpeg worker. FireLaunch Studio/API/Postgres remains owner-scoped control plane; creator-authenticated S3 direct multipart remains the ingest path. A verified source creates one owned correlated MediaConvert job through the reviewed Foundation ingest workflow. Cloud events are idempotent observations that cannot alone grant READY/publication; reconcile missing results and verify the complete private staged HLS master/variants/segments. Publication rechecks rights/current revisions and promotes immutable output into delivery-only private S3 + CloudFront OAC. PublishedManifest v1 stays a stable approved HTTPS URL; no raw S3 or expiring secrets in clients. Default Foundation CloudFront behavior must be customized so unfinished transcoded output is inaccessible publicly.

Current migration authority: [ADR 0011](decisions/0011-aws-vod-foundation.md), [managed integration runbook](integrations/aws-vod-foundation.md), [c6-aws-vod correction](tasks/c6-aws-vod/README.md). Local code and actual AWS/Vega qualification are NOT completed by documentation. Preserve historical P6 P1-P7 and P5/c5 evidence, and retain real P6 P8 qualification. Never deploy/delete AWS resources automatically.

## Per-video supporting media architecture (ADR 0014; approved 2026-10-19)

Model an owned video aggregate by stable creator/project/CatalogItem/video MediaAsset references, plus independent artwork and optional subtitle-track asset/version IDs; don't overload the video MediaAsset ID as a file container or create a parallel rights engine. Physical security boundaries remain current private-object S3, video originals, private processed HLS and publisher-only immutable delivery keys. Use existing opaque private artwork in place with no destructive move or new bucket; new assets may use safely validated per-video logical prefixes where appropriate.

Studio selected-file thumbnail preview uses revocable local blob URLs, then persisted private artwork from owner-scoped, short-lived capability/content APIs (header-based, not secret query strings). One shared artwork resolver/component handles Home, Catalog, per-video popup, upload/progress, processing and *private* channel preview with explicit custom > generated still > owned eligible fallback; cancel stale fetches on project/account changes. Don't inject private capabilities into generated ChannelSpec, public TV URLs or logs.

Publication requires verified owner/source/artwork display-right claims, concrete asset version, bytes/hash/MIME validation and current creator approval before rights-checked copy to immutable approved `delivery/` artwork key (JPEG/PNG) and stable HTTPS CloudFront URL resolution. Extend server-side publication projection and manifest construction without relaxing strict PublishedManifest v1 URL/media bindings or rewriting release #1. CloudFront public viewer function, exact-prefix allowlist and publisher S3 policy need a narrow reviewed image extension, not an open `*.jpg` rule; protect private/staged/original keys, cache/revocation and paid media. Avoid partial publication on failed copy; retain previous release pointer.

Optional subtitle records link to the video with normalized BCP 47 language, validated UTF-8 WebVTT (.vtt), bounded size/cue safety, opaque private object, digest, version and independent replacement/revocation. Missing tracks never block. Do not advertise subtitles in strict published-manifest v1 or Vega until native renderer, exact delivery permission and backwards-compatible contract are independently qualified. Plan supporting paths now without prematurely changing TV client format or creating another bucket. See ADR 0014 and c6-supporting-media.

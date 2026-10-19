# FireLaunch Architecture

## Current deployed and planned media architecture (2026-10-18)

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

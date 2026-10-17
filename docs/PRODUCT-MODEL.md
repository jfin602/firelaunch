# FireLaunch Product Model

## Primary user

A creator, brand or small media organization that has video content and wants a branded TV destination without hiring a dedicated TV application team.

Developers are also users, but the default workflow must not require TV-platform expertise.

## Core nouns

### ChannelProject

The creator-owned FireLaunch workspace.

Contains:
- ChannelSpec
- content metadata
- project assets
- agent transcript/change history
- generated-project metadata
- build/readiness state

P0 uses local filesystem persistence. Cloud accounts/workspaces are deferred.

### ChannelSpec

Canonical structured definition for the normal channel experience.

Minimum shape:
- id, title, slug
- brand
- navigation
- pages
- content catalog
- playback defaults
- schemaVersion

Brand includes logo/art references, colors, typography intent and display options.

Navigation references pages by stable IDs.

Pages are composed from bounded TV modules such as hero, rail, grid and text/about.

Content items include stable ID, title, description, artwork, playable media URL and optional duration/category/series metadata.

P0 may add fields when required, but avoid a generic arbitrary JSON page builder.

### ChannelAgent

Provider-neutral orchestration boundary that turns creator language into validated structured operations.

P0 tools should cover:
- inspect current channel
- set brand
- add/update/remove page
- add/update/remove module
- add/update/remove content
- reorder navigation/module/content references
- apply a validated bounded patch
- request generation/readiness actions

Bedrock is the primary real provider integration. Mock mode produces deterministic tool calls for tests and offline demo fallback.

### TV Preview

Interactive 16:9 projection of ChannelSpec.

It must exercise the same semantic page/module/content rules as the generated channel and support directional focus, select/enter, back, virtual remote buttons, keyboard equivalents, visible focus, content detail and playback.

The preview is not allowed to be a static screenshot.

### GeneratedVegaProject

Self-contained source project produced from a checked-in template/runtime plus ChannelSpec.

It must be inspectable in the Code surface and usable independently from FireLaunch after export.

### BuildArtifact

Evidence-backed output of the Vega build path.

A record contains project/spec revision, command/toolchain identity, time, exit status, artifact path and artifact hash when practical.

No artifact record exists merely because generation succeeded.

### SubmissionBundle

FireLaunch-prepared Appstore materials:
- VPKG reference when actually built
- app/store copy
- app icon/artwork checklist
- screenshots
- support/privacy fields
- device target notes
- compliance/readiness checks
- unresolved human actions

P0 does not automate credentialed Developer Console submission.

## Golden path

1. New Channel.
2. Enter title and short intent, optionally add logo/content.
3. FireLaunch creates a valid starter ChannelSpec.
4. Agent produces/refines the first channel composition.
5. TV Preview becomes immediately navigable.
6. Creator asks for changes or uses Design/Content controls.
7. Creator can open Code and inspect/edit the generated project.
8. Generate/Validate updates source and readiness.
9. Build uses the locally installed Vega toolchain.
10. Publish presents a truthful readiness report and submission bundle.

## Studio information architecture

Use a focused creator shell with persistent project identity and these primary surfaces:
- Create / Agent
- Design
- Content
- Code
- Build
- Publish

The TV Preview remains visually central during creation/refinement.

Do not clone a general IDE.

## Demo fixture

Ship a rights-safe local/sample Wild Earth-style project with placeholder/generated imagery or repository-owned assets and a small set of playable demo media that is legally usable.

## Explicitly deferred

- login/accounts
- billing
- team collaboration
- hosted transcoding/CDN
- subscriptions/IAP
- advertising
- analytics
- multi-TV-platform export
- component marketplace
- automated Developer Console credentials/submission

## Launch-MVP product model extension (planned P1-P8, accepted 2026-10-09)

The preceding P0 nouns, local storage, golden path and deferrals are historical, not descriptions of the finished hosted product. Launch additions extend the canonical `ChannelSpec` model; they do not replace its validated TV presentation contract.

### Identity and creator-owned deployment

- **CreatorAccount:** login, customer/service entitlement, privacy/export/deletion and ownership principal.
- **CreatorProfile:** public brand and contact/media attribution, separate from private account data.
- **ChannelProject:** creator-scoped workspace containing one channel and its catalog configuration; no shared team access in MVP.
- **ChannelDeployment:** one independent Fire TV application identity, package identifier, manifest endpoint, artifact/release lineage and Amazon Developer Console listing status. Each creator owns the app/account/listing, not FireLaunch. One account may own multiple independently published projects.

### Catalog, media and synchronization

- **CatalogSource:** type, provider/external identity, permission/verification state, feed or seller authorization, refresh capability, last-success/error and safe secret references. Supported launch fallback: creator-controlled CSV/JSON, HTTPS feed and media uploads.
- **CatalogItem:** stable internal ID, namespaced source IDs (including ASIN where applicable), type, title, metadata, artwork, provenance, imported field ownership, rights state and association to Collections.
- **MediaAsset:** independently authorized video/audio/artwork references or uploads, codec/playability data where needed, licensing/rights declaration, delivery eligibility and captions/other metadata.
- **Collection:** curated series, bookshelf, featured programming, album/playlist or rail, stable item references and editorial order.
- **SyncPolicy:** selected source-owned fields, creator overrides, new-item publication/review rule, removals/grace behavior and cadence.
- **SyncObservation:** checkpoint/diff, source provenance, validation, last run/errors and accepted/rejected/queued state.
- **PublishedManifest:** immutable, versioned, public TV-safe snapshot composed from approved ChannelSpec, catalog selection and media references, linked to one ChannelDeployment and compatible client schema.

`ChannelSpec` is canonical for presentation and TV navigation. The catalog records canonical content inventory and provenance. Publication validates and projects both; neither imports nor AI models may bypass schema validation or creator review rules.

### Source trust states

- **Discovered:** a possible source or item match; identity and import rights unverified.
- **Verified:** the creator has demonstrated control/permissions using a supported mechanism.
- **Syncing:** a permitted, functioning ongoing source with observable sync health.

An Amazon author/seller name or ASIN cannot authorize import. No universal KDP, Audible, Seller Central or affiliate-content access is promised. Amazon connectors ship only when authorization and downstream TV use are proven.

### Field and update policies

Source-owned fields can refresh; creator-owned fields must not be overwritten. AI suggestions are proposals until accepted. New external items default to review; deletions use a grace period; revocation stops ingestion and is visible. Draft items and private tokens never enter published payloads. A failed refresh retains the last approved release.

### Launch golden path

Account -> catalog import/rights -> video/audio/writing-specific generation -> visual Preview/edit -> approve live manifest -> creator-owned source/build/Console submission -> ongoing permitted synchronization and live TV refresh. Prompt-first creation and advanced Code remain optional. A product listing without licensed playable content is not a finished TV experience.

### Launch gates and deferrals

Target evidence includes three real creator pilots (video/audio/writing), one creator-owned Appstore-approved app, physical Fire TV navigation/playback and remote refresh, plus tenant isolation, backup/rollback and support readiness. These are not current accomplishments.

Defer team management, more TV platforms, arbitrary code agent autonomy, full transcoding marketplace, live TV/EPG, viewer IAP/advertising and undocumented Developer Console automation.

### Hosted creator ownership semantics (P2)

`CreatorAccount` is the server-side billing/ownership/security principal; an authenticated OIDC subject is a login identity mapped to one account, and an authenticated session is not itself an account ID. A `ChannelProject` has exactly one owning creator for the MVP; one creator can own several projects and separate deployments, but no team membership or shared workspace authority exists. No user-supplied ownership claim can transfer a project or cross the tenant boundary.

An optional `ChannelDeployment` has a globally unique native package ID and release lineage; it is not automatically created merely by importing a local project. Project/spec and imported external catalog identity are separate from account/deployment identity. Private asset/evidence records and credential references must be owned, auditable, revocable and excluded from public TV payloads. P2 implements only private storage foundations, not P3 imports or P5 public manifest publishing. P2 preserves exportable ordinary generated source without giving one creator access to another creator's files or tokens.

### Phase 3 catalog and import user model (implemented local; bounded CATALOG GREEN, 2026-10-10)

A `CatalogSource` is a creator-and-project-scoped origin with its own proof of retrieval/display permission. `CatalogItem` stores stable source-scoped external identifiers and immutable observed source metadata separately from creator editing overrides; an item can be a non-playable book or listing. `Collection` expresses deliberate programming order (bookshelf, playlist, album, featured rail), not a playback license. `MediaAsset` is independently attached to a catalog item and may be private/rights-unknown even when inventory is complete. An evidence reference is not itself a verified grant, and neither a public Amazon identifier nor an upload demonstrates television reuse permission.

**Phase 3 creator workflow:** choose a source type -> upload CSV/JSON or supply a permitted HTTPS feed -> inspect parsed records, invalid rows and duplicates -> approve selected changes -> curate collections -> attach owned/licensed media and separate display/playback rights -> save a project-scoped catalog draft. Creator override fields survive repeated imports. New external items require review; no automatic publication or silent missing-item removal. Empty and non-playable inventories are valid drafts but not implicitly playable television channels. P4 owns generation into `ChannelSpec`; P5 owns remote public delivery; P6 owns ongoing refresh/reconciliation.

Phase 2 P7 and c2 remain **NOT GREEN**. P3 completed its implemented local catalog foundation with automated tenant regression and sequential live Google identities; simultaneous independent real browser profiles, full foreign API negatives, HTTPS OIDC/cookie behavior and independent HTTPS S3 recovery remain unqualified preproduction security gates. Neither passed catalog tests nor local-only authentication are grounds to label the entire hosted service production-qualified.


### Phase 4 channel draft generation model (activated 2026-10-10)

P4 maps creator-selected, persisted approved CatalogItems and Collections into a project-owned ChannelSpec **draft**, without changing the original catalog/provenance. Stable catalog-to-presentation bindings and revision-checked updates must preserve deliberate manual brand, order and text edits on regeneration; a collection determines organization, not permission to show or play. Non-playable books/listings can have rich text/detail without a media URL or Play behavior. Video and audio content must have genuinely suitable playback semantics when independently licensed/eligible; missing or revoked rights show honest unavailable states.



**Phase 5 published delivery:** A creator-owned ChannelDeployment holds one stable native package identity and approved public HTTPS resolver. ChannelSpec and catalog remain editable private drafts; editing alone does not publish. Creator approval binds project/catalog revisions and rights; immutable PublishedManifest snapshots and an atomic release pointer control what an anonymous installed television reads. Informational books do not require playback; audio/video require approved device-reachable TV playback rights and separate display rights. The TV validates compatible releases, stores last-known-good state and falls back on bad or offline fetch; rollback is a new approved, monotonically sequenced release, not mutable history. A real VirtualDevice suffices for P5 testing of one same-installed-VPKG remote update, while physical Fire TV and Appstore approval stay P8 release gates. No live Bedrock or production VPS is needed to start the implementation. See ADR 0009.
P4 uses bounded server-authorized catalog inspection and provider-neutral ChannelAgent structured mutations, never raw model-generated JSON replacement or client-provided creator IDs. A successful real non-mock model call grounding on imported catalog plus persisted, valid ChannelSpec change and interactive Preview is required for P4 GREEN. Deterministic starter layouts work offline for video, audio and writing; mock tests do not prove live provider qualification. Authentication/private Preview and generated-source sanitization remain separate from P5 public immutable media/manifest delivery; P6 owns automatic sync. Full hosted release security readiness remains unqualified until inherited S1–S6 gates pass.


## Planned P6 — AWS media delivery extension (not implemented)

P5's historical approved PublishedManifest/ChannelSpec contracts remain the compatible native client baseline. P6 extends existing `MediaAsset` with owner-scoped original upload identity, content hash, probe metadata, rendition-set version, encoding profile, FFmpeg job/attempt, verification results and delivery-ready state. Do not substitute media assets for ChannelSpec presentation identity or replace previously approved publication releases. All private originals, upload sessions, worker credentials and evidence remain outside public/exported contracts. Encode jobs and HLS rendition metadata have independent revisions and retries.

Media moves through upload pending -> uploaded -> probing -> processing -> verified/ready or failed; separately track TV-display/playback rights, approval, revocation and delivery eligibility. FFprobe can approve safe stream copy/repackaging, otherwise transcode a bounded two-quality HLS profile (480p/720p initially, optional 1080p). Every rendition-set publication must resolve to stable validated CloudFront HTTPS media usable by the P5 wire format, with no signed private S3 URL or temporary query credentials. Private storage from P2/P3 for small evidence and uploads remains distinct; P6 handles scalable video masters.

For **future** subscribers, public playback manifests must not contain per-viewer credentials. Viewer identity, Amazon/Roku billing and playback entitlements require a separately approved device/provider contract. Initial P6 is free-to-view rights-cleared video. P6 (0.6.x) precedes planned P7 sync (0.7.x), P8 publishing/SaaS (0.8.x), P9 launch (0.9.x); all earlier P6/P7/P8 references in historical phase plans remain historical, not renamed evidence.

## Accepted managed VOD media lifecycle (2026-10-14, ADR 0011)

The historical P6 FFmpeg-job paragraphs above describe the initial implementation, not the currently approved future encoder. New FireLaunch-managed creator-uploaded videos depend on **AWS Video on Demand on AWS Foundation / MediaConvert** rather than a FireLaunch FFmpeg worker. The creator's existing MediaAsset/CatalogItem identity, upload ownership/rights and immutable rendition/publication linkage remain canonical. A managed job identity binds an owner-approved verified original to AWS account/region/job ID, immutable profile/version, private staging output, attempt/status/error and reconciliation state. READY requires trusted provider result and complete HLS verification; it is not a rights grant. Only a distinct explicit approved P5 publication may expose delivery URLs. Existing client ChannelSpec and public manifest playback contracts do not change. Legacy READY media and job records must survive correction; live cloud, playback and production qualification remain open. See ADR 0011 and c6-aws-vod.

## Owner-approved video-first Studio correction (c6-video-publishing-ux, 2026-10-16)

The launch golden path for creators uploading their own videos is **Add Video** within the existing ChannelProject, not mandatory CatalogSource import, Collection setup or separate generic-media attachment steps. Creator-facing inputs are video file (required), title (required but prefilled from a sanitized filename), optional description, optional category defaulted to Videos, and optional thumbnail (custom or supported auto-generated frame). One unchecked combined TV display-and-playback rights attestation is required; backend display and playback rights remain separate and independently enforced/auditable. Missing rights or artwork may leave a valid private draft but never a published TV asset.

FireLaunch infers channel/project ownership from authenticated context and video duration/technical properties from trusted processing, not arbitrary input fields. A privately uploaded MediaAsset must be associated with a stable owned CatalogItem and validated ChannelSpec draft presentation; optional Collections remain available in a separate management flow. A successful S3 upload creates/persists a draft, not readiness, immutable publication or playable Vega output. Existing P5 rights/publication gates and ADR 0011 managed MediaConvert/private staging policy remain authoritative. When processing/CDN is disabled, show the blocking status instead of enabling Publish or pretending device playback has been qualified. See [manual correction contract](tasks/c6-video-publishing-ux/README.md).


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

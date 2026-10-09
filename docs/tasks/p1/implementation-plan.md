# p1 — Source-aware implementation plan

Status: approved for prompt authoring and execution
Root phase baseline: 0.1.0
Authority: docs/roadmap/mvp-roadmap.md P1, ADR 0001 and ADR 0004-0008

## Universal boundaries

Inspect current source before edits. Preserve existing strict ChannelSpec v1, projectSchema, channel-engine, TV projection, Vega generator and local project files. Create new versioned creator/catalog/publication schemas under packages/contracts/src with exports via index.ts and focused tests under packages/contracts/test. Prefer Zod strict objects, bounded fields, typed identifiers, explicit schemaVersion and representative safe examples. Do not include credentials in persisted/project/TV-facing schemas. P2 implements accounts/hosted DB; P3 implements ingestion; P4 live provider; P5 remote delivery; P6 sync.

Version root package.json and root package-lock.json metadata to assigned 0.1.N in each implementation prompt, leaving internal workspace versions unchanged unless actual build compatibility forces an explained change.

## P1 — Ownership contracts / 0.1.1

Own CreatorAccount, CreatorProfile, ChannelOwnership, ChannelDeployment (or equivalent versioned shapes). Include account/project linkage without altering historical ch_ ChannelSpec IDs, one account owning many distinct apps, unique per-app package identity, creator-controlled release and Console evidence state. Public/private profile boundaries, safe identifier/URL lengths and strict rejection of unknown fields. Model global uniqueness as a future storage constraint; do not pretend a schema alone enforces it.

Primary paths: packages/contracts/src/creator.ts, index.ts exports, packages/contracts/test/creator.test.ts. Include positive fixtures, mismatched IDs/owners, invalid lengths and cross-creator identity invariants.

Validate: focused creator/P0 contract tests, contracts build/typecheck, git diff --check. No database, login or server changes.

## P2 — Catalog, media and provenance / 0.1.2

Own CatalogSource, CatalogItem, MediaAsset, Collection and provenance/rights records, with stable internal IDs and external provider namespace (marketplace, seller/ASIN/SKU where applicable). Distinguish discovered/verified/syncing; source identity versus actual authorization; creator-owned CSV/JSON/HTTPS feed/upload from pending Amazon providers. Model non-playable items (e.g. books), independently licensed playable media, rights unknown/cleared/revoked, artwork and collection editing. Bounded inputs and safe URL references, no arbitrary executable code/credentials. Do not change P0 contentSchema just to permit a product listing.

Primary paths: packages/contracts/src/catalog.ts, index.ts exports, focused catalog.test.ts. Test three creator types, duplicate IDs, bad provenance, unlicensed media and hostile URLs.

Validate: focused catalog/P0 contract tests, affected build/typecheck, git diff --check. No network imports.

## P3 — Sync and published manifest / 0.1.3

Own SyncPolicy and SyncObservation (field ownership, default review of new items, missing-item grace, revocation, conflict/error status, idempotency/change fingerprints) and PublishedManifest (public-safe, immutable/versioned channel revision envelope, released only after explicit approval, client compatibility, deployment reference, media-safe references, rollback pointer semantics). Public manifests cannot expose auth tokens, raw source payloads, private account metadata, draft state, unlicensed media. Keep draft/approved states distinct. Add small pure validation/projection helpers only when warranted, not HTTP or workers.

Primary paths: packages/contracts/src/sync.ts, publication.ts, index.ts exports and tests. Test valid public payload, unknown field injection, incompatible version, disallowed draft/unsafe media, sync conflicts and creator override protection policies.

Validate focused tests/build/typecheck and git diff --check. Actual immutable persistence, client caching, scheduling and delivery belong to P5/P6.

## P4 — Amazon matrix and onboarding / 0.1.4

Deliver docs/integrations/amazon-catalog-feasibility.md: dated official primary sources and technical/permission matrix across Seller Central SP-API (public seller developer registration, seller OAuth, Listings Items, Catalog Items, Notifications), KDP/Author Central, Audible, Associates/Creators/PA-API and creator-provided CSV/JSON/HTTPS feeds/uploads.

Each row must independently state input/discovery, API access, consent/approval, imports, ongoing sync, downstream TV reuse, media licensing, actual FireLaunch implementation status, unresolved questions and user action. Labels: documented technical capability, pending external approval, unknown/unverified, restricted/blocked, or implemented/verified. Official API docs never prove our account approval. Do not scrape Amazon pages, fabricate API access or assume product listing = playback rights. Note seller/TV reuse limitations explicitly. Prefer verified primary URLs and date of inspection.

Deliver docs/creator-onboarding.md: catalog-first wizard, vendor-neutral discovery fallback, identity ambiguity, unsupported source, creator rights verification, preview and media gaps; variations for video, audio and writing, empty/error/pending states, source/field review, app ownership; future P2/P3/P4/P5 handoffs. Provide rights-safe synthetic scenario examples. No UI implementation.

Validate source links/claims and doc consistency, git diff --check. No AWS needed.

## P5 — Independent qualification closeout / 0.1.5

Only final closeout prompt. Review all checkpoint outputs and code. Confirm P0 contracts unchanged, new contracts strict and source/public boundaries tested, data rights/review policy preserved, independent creator-owned app identity, official matrix labels and onboarding paths. Run one complete npm run check, npm run codex:stack:validate -- p1 and git diff --check. Record exact checks/counts, version/HEAD, evidence, unimplemented source approval, P2/P3 handoff and GREEN/NOT GREEN in docs/tasks/p1/closeout.md. No browser required: P1 adds no runtime UI. Keep historic c0/P7 NOT GREEN intact.

If source/contracts are unsafe or policy statements overclaim approval, NOT GREEN and recommend bounded c1-* correction rather than rewriting all prior prompts.

## P2 handoff

Deliver contract exports/field semantics, storage/auth obligations, tenant isolation invariants, migration cautions, source consent and rights matrix, P3 import edge cases, P5 TV manifest compatibility and P6 safe sync policies. P2 owns actual authentication, Postgres and private file storage; P1 does not.

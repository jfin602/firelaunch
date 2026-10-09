# p1 — Prompt assessment

Status: approved strategy; implementation stack prepared
Date: 2026-10-09
Baseline: 0.1.0

## Decision

Use four bounded GPT-6 Sol High implementation checkpoints and one independent closeout. Build contracts, technical feasibility and no-code onboarding specifications, not the hosted SaaS yet. Full historical P7 GREEN, AWS and Bedrock are not P1 prerequisites.

## Current code and seams

- packages/contracts/src/index.ts defines strict Zod ChannelSpec v1 and local projectSchema. Channel content requires mediaUrl and is a playable TV projection, not a canonical bookstore/listings catalog.
- packages/channel-engine/src/index.ts validates and mutates ChannelSpec; packages/tv, packages/generator, Studio, agent and server depend on it. Avoid schema drift.
- The current project id has the same ch_ identifier as ChannelSpec. Define creator/project ownership separately rather than silently migrating P0 data.
- ChannelAgent currently exposes mock/Bedrock; the provider-neutral future is owned by SaaS P4, not this stack.
- Real Vega VPKG/VirtualDevice navigation has been proven for a tested candidate, but c0/P7 remains NOT GREEN. Do not obscure its remaining browser, Publish, aggregate and production-device deficits.
- The Prompt Stack validator requires p1 versions 0.1.1 through 0.1.5 from baseline 0.1.0.

## Decomposition

P1: CreatorAccount, CreatorProfile, ChannelOwnership and independent ChannelDeployment identity contracts and tests. No login or actual tenant isolation.

P2: CatalogSource, CatalogItem, MediaAsset, Collection and provenance/rights contracts and tests. Non-playable products are valid inventory, never implicitly licensed TV media.

P3: SyncPolicy, SyncObservation and PublishedManifest envelopes and contract tests. Explicit creator overrides, review-before-publish, grace on missing items and private/public separation. No jobs or endpoints.

P4: Dated, official-source Amazon feasibility matrix plus creator-first onboarding wireflow for video/audio/writing, including no-API fallback, unresolved permissions and rights checks.

P5: Independent contract, policy and integration-readiness review, one aggregate check and honest GREEN/NOT GREEN closeout.

## Risk controls

1. Backward compatibility: leave ChannelSpec v1, existing project JSON and channel-engine stable. Add focused contracts under packages/contracts/src with public exports and tests.
2. Ownership: strict account/deployment references but no unsupported claim that schema parsing enforces cross-tenant authorization; P2 hosting implements that.
3. Data permissions: distinguish discovered, verified and syncing. Amazon URL, ASIN or author name alone conveys no authorization or playable media rights.
4. Amazon policies: separate seller SP-API technical endpoints, seller OAuth, account approvals, downstream TV display rights and Appstore approval. Do not invent KDP/Audible API access or depend on affiliate/Creators API TV use.
5. Publication: draft differs from approved immutable manifest. Public TV output cannot contain private credentials, source tokens or unlicensed media.
6. Cost: P1-P4 run focused typechecks/tests. Full npm run check belongs to P5, no paid provider call or device run for P1.
7. Scope: no new database, account UI, server auth, scraping/OAuth, sync engine, AI adapter, TV runtime or checkout/billing implementation.

## Completion threshold

P1 GREEN requires strict tested contracts, authoritative capability/permissions matrix with dated citations, realistic onboarding and P2/P3/P5 handoff. Amazon approval remains a future external gate; any source described as operational without proof must be corrected before GREEN.

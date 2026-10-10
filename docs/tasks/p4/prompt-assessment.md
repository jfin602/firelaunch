# Phase 4 — Prompt Assessment

Date: 2026-10-10
Status: approved direction translated into source-aware prompt scope
Activation: root `0.4.0` after Phase 3 `0.3.8` bounded catalog closeout

## Problem and evidence

P3 delivered PostgreSQL owner-scoped catalog, CSV/JSON/HTTPS snapshot import, Collections, private assets, provenance, rights records and progressive Studio curation; catalog itself does not yet become the canonical `ChannelSpec` TV presentation. P3 P8 directly saw approved draft imports, idempotency, curator overrides, rights preservation and hosted restart, but did not qualify production hosting (docs/tasks/p3/closeout.md).

Source inspection:
- `packages/contracts/src/index.ts`: `contentSchema` presently requires `mediaUrl` and lacks a clear non-playable/audio TV discriminator. Making up media URLs for books is unacceptable.
- `packages/tv/src/runtime.ts`: detail `select` always enters playback. `apps/studio/src/Preview.tsx` presents a video player and film wording regardless of item kind. Vega generation and UI share the resulting compatibility obligation.
- `packages/contracts/src/catalog.ts`: normalized kinds, Collections, separate playback/display rights, MediaAsset `deliveryEligible` checks and creatorOverrides are available. That does not itself supply reviewed catalog-to-spec bindings or a public rights grant.
- `apps/server/src/catalog-repository.ts`: authenticated owner-scoped snapshot/mutation, revision and rights checks already exist. `apps/server/src/api.ts` has separate catalog and agent endpoints; catalog grounding must be built on server-owned reads, not client-provided owner/catalog JSON.
- `packages/agent/src/index.ts` + `packages/agent/src/tools.ts`: bounded validated mutation loop and mock/Bedrock adapters exist, but no `inspect_catalog` or another provider adapter is registered.
- `apps/studio/src/Catalog.tsx` and `apps/studio/src/AgentPanel.tsx` are separate workflows. Generation and preview affordances must integrate without replacing the established catalog/edit/code surfaces.

## Decisions and risk responses

1. Preserve `ChannelSpec` as a versioned presentation contract; extend or migrate it compatibly to distinguish non-playable detail, audio and video. A historical spec must continue to parse and navigate; change Vega/template projection only as needed to maintain focus/play parity. Prefer a small discriminator over a generic renderer rewrite.
2. Create deterministic, owner-verified catalog selection/projection with stable item/Collection references. Resolve creatorOverride fields without mutating source provenance. A recurring generation must not reset creator edits or add duplicate pages/modules.
3. Rights are use-specific and fail closed: only independently eligible display artwork, playback media and explicitly selected/reviewed catalog items can appear in the relevant draft roles. No raw private object key, credential, signed capability or inferred Amazon reuse rights enters `ChannelSpec` export. Draft authenticated Preview and P5 public delivery are different paths.
4. Use three bounded composition strategies, not one generic cards layout. Writing must support informational books and companion cleared readings, audio should support listening controls, video cinematic featured/series programming. Include meaningful blank/missing-rights states.
5. Keep agent provider-neutral; retain Bedrock/mock compatibility, allow one actual supported non-mock provider via adapter, and read catalog context through an authenticated bounded tool with payload limits and no secret/evidence leakage. Require strict mutation validation and current revision checks.
6. Regeneration ownership: detect creator-touched nodes/fields and preserve them. A deliberate reset should be a separate explicit action, not assumed from Generate. No generated source custom-edit overwrite.
7. Browser/editor and real provider verification belongs to independent P8; implementation checkpoints do not make paid calls in deterministic tests. P8 must close NOT GREEN if no successful live non-mock request, regardless of how many mocks pass.
8. Do not requalify P2/c2, HTTPS OIDC/S3, physical Fire TV, VPKG, remote manifest service or Appstore through P4. Preserve security denial tests and exact inherited open release gates.

## Decomposition rationale

Seven implementation checkpoints plus one independent closeout use root versions 0.4.1–0.4.8. Order contracts/TV semantics -> trusted catalog projection -> differentiated compositions -> AI agent/provider -> Studio UX -> hosted/security convergence -> final qualification preparation -> live/browser closeout. Each slice owns one subsystem transition and focused tests to minimize rework and avoid repeated global test runs.

## Success / failure

P4 GREEN requires all three types creating distinctly appropriate, persisted, browsable drafts; non-playable books cannot open fake playback; media eligibility/tenancy and creator edits are preserved; a real non-mock call produces actual validated persisted changes; qualified browser navigation and integrated aggregate check pass. A mock-only result, absent provider credentials, foreign leakage, destructive regeneration, or inaccurate playback/rights state means NOT GREEN (with bounded blockers), not a fabricated success.

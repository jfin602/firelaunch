# p3 — Catalog Import and Discovery

Status: PROMPT STACK AUTHORED / NOT EXECUTED
Phase: 3 (post-P0 SaaS launch roadmap)
Activation baseline: root `0.3.0`; prior P2/c2 formal qualification remains NOT GREEN
Model guidance: GPT-6 Sol High on security/import boundaries; Medium on tightly bounded routine UI
Date: 2026-10-10

## Goal

Deliver a real creator-controlled catalog-first workflow on the existing authenticated hosted foundation. Store tenant-scoped sources, imported items, Collections, rights evidence and media in PostgreSQL/S3; implement bounded CSV/JSON and one-shot HTTPS feed imports, preview/review, deduplication, creator-owned edits, privacy-safe uploads and Studio curation without falsely asserting Amazon permissions or automatically publishing TV media.

Read [carried-forward gates](carried-forward-gates.md) before planning. P2 P7 and c2 closeouts remain historical NOT GREEN. P1 runs focused automated tenant-isolation and authentication regression tests; the unfinished real two-profile browser matrix is deferred to P8 independent qualification, not a pre-run condition. New catalog routes must remain owner-scoped and test cross-tenant denial. HTTPS staging OIDC and private S3 recovery remain unqualified preproduction gates.

## Approved planned prompt decomposition (not yet executable)

| P3 prompt | Planned responsibility | Assigned version | Browser |
| --- | --- | --- | --- |
| P1 | Automated hosted security regression and owner-scope tests | 0.3.1 | no |
| P2 | Tenant-owned catalog PostgreSQL schema, constraints, CRUD | 0.3.2 | no |
| P3 | Bounded CSV/JSON parsing, import preview, duplicate resolution | 0.3.3 | no |
| P4 | One-shot safe creator-controlled HTTPS feed snapshot import | 0.3.4 | no |
| P5 | Private media uploads, rights provenance and eligibility | 0.3.5 | no |
| P6 | Catalog-first Studio wizard and Collection/editor workflow | 0.3.6 | no |
| P7 | End-to-end integration and security/edge-case regressions | 0.3.7 | no |
| P8 | Independent browser/import/security qualification closeout | 0.3.8 | yes |

The eight prompts are executable without a manual browser gate beforehand. P1 verifies existing authentication and tenant boundaries using focused automated tests with separate test principals and actual PostgreSQL where available. A failing security test is a real blocker to that checkpoint; absence of optional real-browser evidence is not. The inherited real two-profile Google qualification remains OPEN for P8, the only browser-required prompt, and for preproduction.

## Existing source and contracts

- `packages/contracts/src/catalog.ts`: versioned CatalogSource, CatalogItem, MediaAsset, Collection, CatalogInventory, provenance and rights validators.
- `packages/contracts/src/sync.ts`: review/override/grace rules, but scheduled work belongs to P6.
- `apps/server/src/hosted-repository.ts`: tenant-scoped project persistence; `private-objects.ts`: S3-compatible private asset foundation.
- `apps/server/src/api.ts`: hosted authentication and existing project/private-object endpoints; extend with owner-scoped import/catalog endpoints, fail closed.
- `apps/studio/src/App.tsx`: local/historical channel editor; catalog-first wizard is P3 work, not delivered yet.

## Acceptance boundaries

A real creator can import a substantial authorized CSV/JSON/HTTPS feed catalog, review parse problems/collisions and retain stable provenance across repeat imports, manage Collections/creator overrides, attach separately approved media and export/project-restart without cross-account leakage. Rejected/unsafe feeds, unlicensed playback, forged creator IDs and large/malformed media fail safely. Neither source clues nor uploaded media imply TV publication approval.

No general Amazon integration, periodic feed synchronization, catalog-grounded AI generation, public TV manifest rollout, creator Console publishing, real build/runtime qualification or billing is included. Full hosted release readiness remains unqualified until carried-forward staging/security gates pass.

## Next workflow

From a clean root 0.3.0 checkout, run `npm run codex:stack:validate -- p3` and `npm run codex:stack -- p3`. No separate browser preflight is required. Runner commits P1-P7; P8 is the independent manual browser/security closeout. See [optional browser-check guide](security-preflight.md). Successful implementation prompts receive runner-owned commits; manual browser closeout writes real evidence and does not self-commit.

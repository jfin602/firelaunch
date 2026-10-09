# ADR 0005 — Catalog provenance and field-owned synchronization

Status: Accepted
Date: 2026-10-09

## Decision

Keep `ChannelSpec` canonical for the TV experience and add independent CatalogSource, CatalogItem, MediaAsset, Collection, SyncPolicy and SyncObservation records. Normalize all imports, preserve source identifiers and provenance, and treat source-owned and creator-owned fields differently. New items enter review by default; missing items receive graceful review rather than immediate deletion.

## Rationale

Amazon product ecosystems have different access and usage permissions; creator edits and media licenses cannot be safely inferred from listing data or overwritten by synchronization.

## Consequences

- Catalog-first import works with creator-supplied files/feeds even when no Amazon connector is approved.
- Distinguish discovered, verified and syncing sources; neither storefront URLs nor ASINs establish ownership.
- Track stable IDs, rights, field-level provenance, detected diffs, review decisions and worker failures.
- Run idempotent, rate-limit-aware scheduled reconciliation with retry/backoff and token revocation behavior.
- Manual editorial overrides always survive sync; media eligibility is validated before publish.
- Amazon integration is released only after authorized API access and permitted downstream Fire TV use are documented.

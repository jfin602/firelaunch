# Phase 3 Implementation Plan

Status: approved and source-aware
Root activation: 0.3.0; assigned checkpoint versions: 0.3.1–0.3.8.
Read BOOT.md, AGENTS.md, roadmap, Product Model, Architecture, creator onboarding, catalog contracts, and carried-forward-gates.md before each prompt.

## Runner and preflight

The owner completes the two-browser-profile Google security exercise before starting the runner and records genuine, redacted evidence per security-preflight.md. P1 is marked browser-required: no for runner compatibility, but **must fail before changing the version** if real simultaneous two-account isolation evidence is missing or fails. P8 is the only browser-required prompt. Implementation prompts have runner-owned commits, focused tests, affected build/typechecks and git diff --check. P8 owns one root npm run check.

## P1 — 0.3.1: Inherited security gate

Inspect authentication/session, hosted API/repository/workspace and private objects. Verify direct positive owner and denied foreign access in real separate Google browser sessions, including saved projects, source export, private media and protected build state. Distinguish access control from missing session or invalid CSRF. Test restart and run focused hosted integration checks. Record actual evidence. Do not proceed without local S1/S2 proof.

## P2 — 0.3.2: Catalog persistence

Add migrations from existing 001–004 baseline for creator-owned sources/items/media associations/Collections, external provider identity keys, strict foreign keys, ownership, transactional revision and repeat-import uniqueness. Add protected APIs. Tests against two tenants on real PostgreSQL. ChannelSpec unchanged.

## P3 — 0.3.3: CSV/JSON import

Bound document size, input format, nesting and record counts. Parse to source-aware records, show validation errors and duplicates, preview before explicit creator approval, store approval revision and keep idempotent reimport. Preserve imported source values separately from creator overrides and require review for new items.

## P4 — 0.3.4: One-shot HTTPS feed

Implement a documented limited RSS/Atom or JSON Feed parser and reuse the import review pipeline. Check network destinations and redirects against private/local addresses, limit response size/time/decompression and reject dangerous XML. No scheduled worker or automatic source refresh.

## P5 — 0.3.5: Media and rights

Reuse P2 private S3-compatible storage and protected metadata, link assets to owned catalog items, validate safe file types and sizes. Separately track television display and playback rights; unknown or revoked assets never become eligible for public delivery.

## P6 — 0.3.6: Studio workflow

Progressive catalog-first journey: source/type selection, file/feed import preview, errors/duplicates, review, Collections, overrides, media and rights readiness. Keep prompt-first alternative and unchanged Design/Content/Code/TV Preview. Nonplayable books/listings remain valid draft inventory.

## P7 — 0.3.7: Integration

Full local catalog path for video/audio/writing, repeated import, failed inputs, tenancy, private object controls, restart, export and P0 regression. Correct only observed faults.

## P8 — 0.3.8: Independent closeout

With two real independently authenticated Google browser profiles and local PostgreSQL/MinIO, qualify creator import, review, Collections, private media and cross-tenant isolation. Run root aggregate once, validator and diff check; record results in p3/closeout.md. HTTPS Google callback/secure cookies and separate HTTPS S3 source/restore are additional preproduction gates: if unavailable mark them OPEN, not passed. Report a bounded catalog qualification separately from full hosted release readiness. P2/c2/P0/c0 dispositions remain unchanged.

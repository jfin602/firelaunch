# Phase 4 — Implementation Plan

Status: authored for executable P4 Prompt Stack
Entry: committed root 0.4.0; Phase 3 closed CATALOG GREEN / hosted release not qualified
Versions: P1 0.4.1, P2 0.4.2, P3 0.4.3, P4 0.4.4, P5 0.4.5, P6 0.4.6, P7 0.4.7, P8 manual closeout 0.4.8

Read BOOT.md, AGENTS.md, docs/VISION.md, docs/PRINCIPLES.md, docs/PRODUCT-MODEL.md, docs/ARCHITECTURE.md, docs/roadmap/mvp-roadmap.md, docs/workflow.md, ADR 0008 and p3/closeout.md. P2/c2 security gates stay open. Implementation never requires real AI provider credentials just to run offline focused tests.

## P1 — 0.4.1: TV presentation contract and semantics

Inspect `packages/contracts/src/index.ts`, `packages/channel-engine/src/index.ts`, `packages/tv/src/runtime.ts`, Studio Preview and generator/Vega projection. Introduce minimal explicit presentation types / migration for informational non-playable, audio and video items. Legacy video specs still load; no placeholder URL required for books. `select` on an informational detail does not navigate to playback; D-pad/Back/focus stay correct. Audio/video show correct controls in browser and generator/runtime semantics. Tests: legacy fixtures, strict validation, non-playable/select/Back, audio/video parity, affected builds. Avoid broad TV UX overhaul.

## P2 — 0.4.2: Owner-scoped catalog projection and bindings

Create a small catalog-to-channel projection service and internal binding/diff representation. Read creator account exclusively from authenticated server principal and verify project ownership. Resolve approved/explicitly selected `CatalogItem`/`Collection`, creator overrides and separate use rights. Convert only safe, allowlisted presentation fields; do not leak raw external provenance/evidence/private object keys or embed ephemeral signed capabilities in persisted/exported spec. Authenticated draft preview may use short-lived server-side media access without granting public TV distribution. Use stable reference mapping and revision/CAS to prevent duplicate/lost records. Tests: owner/foreign, rights revoked/unknown, books without media, override, repeat projection, no secrets.

## P3 — 0.4.3: Three deterministic starter compositions

Implement bounded video film/series rails, audio albums/playlists and writing bookshelves/author-reading layouts from P2 eligible catalog projection. Give meaningful informational item detail, suitable focus navigation and explicit no-media/review warnings. Protect existing creator-touched modules/brand/order and never erase custom generated source. No model calls needed; use deterministic fixtures and stable IDs. Tests: three shape snapshots/semantic behavior, idempotence, override protection and absence of unlicensed playback.

## P4 — 0.4.4: Real provider adapter and catalog-grounded ChannelAgent

Keep existing ChannelAgent mutation tool checks, round limits, MockProvider and Bedrock compatibility. Add a genuinely callable supported non-mock provider adapter (selection through config; no required AWS/Bedrock dependency), bounded server-authorized `inspect_catalog` or equivalent read-only grounding, and immutable/validated tool schemas. Never accept browser-injected owner/catalog state, credentials, raw private media evidence or unsupported provider claims. Revision conflicts fail safely, and provider proposal vs persisted mutations are distinguishable. Offline adapter/transport fixtures test malformed/foreign/oversized tool calls, timeouts/errors and genuine persistence path; P8 alone qualifies a live model request.

## P5 — 0.4.5: Progressive Studio Generate and Refine

Integrate the P3 catalog UI with Generate -> type-specific draft Preview -> editable brand/order/content -> optional AI refinement. Expose readiness for missing rights/media, preserve prompt-first and Code alternative, keep creator overrides and prior manual edits on regeneration, and show explicit conflict/retry paths. Add focused Studio tests: empty/error states, revision changes, no fake book Play, audio player, navigation, saved edits. Avoid broad CSS or design-system redesign.

## P6 — 0.4.6: Hosted API/security integration

Wire project-scoped generation, safe catalog inspection and mutations through guarded API surfaces, compatible schema/export and existing hosted repository. Audit permissions/CSRF/tenant denial, privilege boundaries for private media and short-lived preview access, revision conflict, process restart and source export sanitization. Keep hosted native builds blocked. Test with two fixture principals against actual isolated PostgreSQL/MinIO where configured; do not mistake fixtures for simultaneous real browser identities. No new public manifest endpoint.

## P7 — 0.4.7: Three-creator convergence and repairs

End-to-end deterministic integration for representative video, audio, writing catalogs with creator-owned selection, rights approval, generated draft, manual edit, re-generate, preview, restart and cross-tenant denials. Confirm generator/Vega output and historical P0 semantics regressions still behave; focus fixes on observed P4 defects. Produce simple runbook/fixtures for P8 live browser/provider testing; provider smoke script must be explicitly opt-in. Run focused tests and affected builds; reserve one global aggregate for P8.

## P8 — 0.4.8: Independent manual qualification

Inspect P1–P7 runner SHAs, actual root version, provider settings and worktree. Qualify in real browser: video/audio/writing generated drafts, distinct navigation/Back/playback, nonplayable books and rights/revocation limits, manual edit persistence, restart, negative foreign/private access and protected export. Execute at least one actual successful **non-mock** model request grounded on imported permitted catalog items and witness the validated tool result, updated durable ChannelSpec and usable Preview; configuration or mock success alone is NOT GREEN. Run stack validator, focused external smoke (if authorized), ONE final `npm run check`, `git diff --check`; record exact counts and evidence in `docs/tasks/p4/closeout.md`. Advance only root package.json and the two root package-lock.json version entries to 0.4.8, without self-committing. If external live provider/browser proof is missing, close NOT GREEN with explicit blocker; carry P2/c2/S1–S6 HTTPS release gates separately regardless of P4 result.

## Version/git/testing rules

Every implementation prompt must verify its predecessor, inspect source before edits, change only root version metadata for its assigned patch, run the smallest relevant tests plus affected typecheck/build and `git diff --check`, and leave commits/HEAD to the runner. P8 manual closeout does not rewrite HEAD or claim unobserved platform proof. Root npm 12/Node 24 requirements remain in effect.

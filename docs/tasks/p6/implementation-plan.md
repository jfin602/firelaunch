# Phase 6 — Implementation Plan: AWS Media Foundation

Status: authored for executable runner; not executed, not provisioned, not qualified
Entry: actual owner-closed P5 candidate plus clean committed 0.6.0 activation. If P5 is NOT GREEN, owner must explicitly accept any inherited risks; do not build on a missing public publication/rights path.
Versioning: P1–P7 0.6.1–0.6.7 with runner-owned checkpoint commits; P8 independent MANUAL 0.6.8, no self-commit.
Authority: BOOT.md, AGENTS.md, docs/workflow.md, ADRs 0009/0010, docs/integrations/aws-media-delivery.md and this task stack. Review live source before edits.

## P1 — Media contract and durable job state / 0.6.1

Touch primarily `packages/contracts/src/catalog.ts` and new narrowly named media-pipeline contract modules, `apps/server/src/hosted-repository.ts` and a forward-only migration after the actual P5 migration number. Reuse existing CreatorAccount/MediaAsset identity, rights, CatalogItem link and PubManifest wire contract. Define private original identity/metadata, upload states, authenticated owner-scoped job queue with fixed encode profile, attempts/leases, output rendition manifests, failure/revocation state and safe CAS transitions. Owner/project FKs and uniqueness ensure no cross-tenant key or job spoofing. No S3 clients/endpoints/FFmpeg yet. Focused migration/schema/replay/foreign-denial tests. Handoff: DB/typed interfaces for API, S3 and worker.

## P2 — AWS provider and deployable infrastructure boundary / 0.6.2

Implement a small isolated S3/media-delivery adapter with injected SDK clients for ephemeral upload intent, head/checksum, multipart completion/abort, private originals, immutable staging/delivery copy and CloudFront playback-origin config validation. Add operator-reviewed AWS infrastructure template/policies (CloudFormation or equivalent) for **two private buckets + OAC-protected CloudFront distribution + narrow per-role policies** and documented permissions, CORS, encryption, cache/MIME, private prefix and lifecycle rules. No real AWS provisioning, IAM key generation or cloud spending in automated prompt. Tests for fail-closed config, mocked S3 errors, key confinement and no secrets in public output. Handoff: tested storage adapter to P3/P4.

## P3 — Owner-authorized large video ingest / 0.6.3

Inspect `apps/server/src/api.ts`, auth/CSRF, catalog repo and P2 private object routes. Add narrow authenticated owned create-upload, part-auth, finalize/verify and abort/status APIs using P1/P2 contracts; do not proxy large bytes through Node. Bound number/size/type/duration claimed, expiry, in-flight uploads and account quota; random opaque server-chosen object identity, validated part ETags and authoritative S3 size/metadata/head/hash verification (reject false client claims). Track idempotency and abandoned multipart cleanup. Deny cross-account ID/key guessing, replay, forged CSRF and publication before processed rights approval. Focus route + injected adapter tests; no Studio changes yet.

## P4 — Isolated FFprobe/FFmpeg worker / 0.6.4

Build a separate manually startable worker process; never run FFmpeg inside muffinos API or enable remote arbitrary command execution. Lease ready P1 jobs by owner and record tool versions/timeouts/attempts, download only owned S3 masters to unique safe temp dirs. Probe codec/container/duration/profile/bitrate/frames/size; stream-copy/repackage only with verified keyframe and timing constraints, otherwise encode fixed H.264/AAC 480p+720p HLS variants (optional 1080p if defined) with aligned ~6s GOPs, no upscaling. Fixed argv from validated enums, CPU/RAM/disk/time/concurrency bounds, worker access restricted, cleanup/retry/failure state. Validate every master/variant playlist and referenced segment, MIME, duration, seeking/FFprobe output and hashed immutable paths before READY. Tests use tiny generated owned media or fixtures, stubbed shell/SDK faults, interrupted job lease and idempotent retries; do not require live AWS or claim physical device proof.

## P5 — Rights-checked HLS publishing and revocation / 0.6.5

Inspect the *actual* P5 approved publication API, catalog binding and release validator. Bind only owned READY HLS rendition set with source rights + independently approved TV playback/display claims, verified complete CloudFront HTTPS master URL and compatible P5 PublishedManifest. Keep stable MediaAsset and immutable rendition path; do not put signed S3/cookies, staged paths, private source IDs, AWS credentials or secrets in source exports or manifests. Recheck revisions/rights on publish; reject foreign, missing, processing, revoked, broken playlists and stale results. Add cache invalidation/revocation handling only within observed CloudFront behavior and document limits. Preserve P5 release immutability/LKG, books informational and legacy P0. Negative repository/public resolver tests and focused builds.

## P6 — Creator upload UX and hosted defaults / 0.6.6

In `apps/studio/src/{App,Catalog,api}.ts[x]`, add accessible owner-scoped file selection, direct multipart progress, status/failed retry/abort, upload limits, rights review and processing/ready/publish gating. Use existing CatalogItem/MediaAsset workflows and do not create a second catalog. Fix `apps/studio/src/sample.ts` / New Film initial localhost default in hosted mode; keep local P0 demo functioning. Explicit free-to-view HLS semantics and unavailable state; never say paid/published before P5 approval. Headless Studio tests for upload lifecycle, bad/foreign/expired responses, no silent publish, no client AWS credentials, and real CSRF via existing request wrapper.

## P7 — Cross-layer convergence + operator runbook / 0.6.7

Build one deterministic integration harness from authenticated tenant/project/catalog to upload, worker, HLS inspection, approved release/public playback and revoke; exercise 2 principals, races, replay/expiry, failed multipart, malformed input, worker failure/retry, no cross-owner access, unsafe URI/protected source, backward P5 publications and inactive/failed asset denial. Add concise manual operator commands for S3+CloudFront infrastructure, secure credentials, worker on Linux Mint, deploy to staging by password-only SSH, artifact MIME, actual Vega SDK/VirtualDevice test, cost/budgets and rollback. Do not provision live AWS automatically, break Ngest, or claim on-device results. Target focused checks and affected builds, not full npm run check.

## P8 — Independent real qualification / 0.6.8

Manual (browser required): inspect candidate exact HEAD/tool versions, AWS region/bucket/CloudFront/OAC settings, rights-cleared creator video, source license and Ngest state. With approved AWS spend and valid operator credentials, actually upload from hosted Studio to private S3, verify private/direct access denial; run independently scoped FFmpeg worker, inspect adaptive HLS master/segments, CloudFront HTTPS delivery, versioned rights-checked publish, then run playback/pause/seek/Back/network loss on qualified Vega VirtualDevice using the actual installed app. Verify restart/persistence, cross-tenant access negatives, revocation/cache TTL limitations, budget/observed AWS metrics and no Ngest regression. Capture redacted evidence and one final Node 24/npm 12 `npm run check` (seven workspaces + kernel/Studio/runner counts/skips), `npm run codex:stack:validate -- p6`, and `git diff --check`. Write factual GREEN or NOT GREEN; blocked AWS rights/device evidence cannot be replaced by mocks or browser-only playback. No physical Fire TV, Fire OS/Roku, viewer subscription/IAP/DRM, P4 provider, S1–S6 production-security or Appstore approval is implied.

## Shared validation / release rules

- Prompt commits are runner-owned; implementation agents never commit or move HEAD. The owner controls activation and actual cloud provisioning. Only root package.json and root lockfile version entries advance in each P1–P8 checkpoint.
- Deterministic tests must be offline; injection/fakes are not live S3/CloudFront evidence. No undocumented AWS service claims. Each prompt should fit a bounded reviewable work unit; if a real code blocker requires a substantial redesign, stop and report/plan correction instead of broadening the prompt.
- Retain P2/c2 S1–S6, historical P4 NOT GREEN, P5 direct VirtualDevice outcome, future native Fire OS/Roku, P9 physical Fire TV and actual Appstore status as separate.

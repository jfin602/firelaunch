> **SUPERSEDED IN PART (2026-10-14):** [ADR 0011](0011-aws-vod-foundation.md) replaces this ADR's local FFprobe/FFmpeg encoding worker and custom job-orchestration decisions with AWS Video on Demand on AWS Foundation / MediaConvert for new FireLaunch-managed uploads. The remainder of this ADR (creator rights, private S3 upload, OAC CloudFront approved delivery, stable PublishedManifest, revocation and separate device qualification) stays authoritative. All original paragraphs below are retained as historical context. Correction: [c6-aws-vod](../tasks/c6-aws-vod/README.md); current root 0.6.7; AWS deployment not performed by this decision.

# ADR 0010 — AWS creator media delivery with FFmpeg and CloudFront

Status: Accepted for documentation and planned Phase 6; implementation and AWS qualification NOT STARTED
Date: 2026-10-11
Owner: FireLaunch
Scope: New launch-MVP P6 (0.6.x), following the existing P5 live-manifest phase
References: [roadmap](../roadmap/mvp-roadmap.md), [architecture](../ARCHITECTURE.md), [product model](../PRODUCT-MODEL.md), [AWS runbook](../integrations/aws-media-delivery.md), [ADR 0009](0009-live-channel-delivery.md)

## Decision

Use creator-authorized video masters -> direct upload to **private Amazon S3 original storage** -> independent **FFprobe/FFmpeg worker** -> verified HLS output stored in a **separate private S3 delivery origin** -> **Amazon CloudFront** with Origin Access Control -> platform player adapters. FireLaunch on muffinos remains the owner-scoped control plane and PostgreSQL catalog, **not** a transcoder, origin for bulk video, or CDN. FFmpeg may initially run on a developer-operated Linux host for controlled proof; a production service cannot depend on a personal laptop. Never execute untrusted client media or native builds in the API process.

Use HLS over HTTPS with H.264 video and AAC-LC stereo as the cross-platform first target. Probe before processing: stream-copy/remux only when codecs, keyframes/segment alignment, timing, dimensions and audio are demonstrably compatible; otherwise encode. Start with a **two-rendition 480p/720p development ladder**, optionally 1080p when source merits it. Six-second aligned GOPs/segments are an initial target, not a device qualification claim. Real devices and network tests can require additional renditions and changes. Preserve source aspect ratio; do not upscale small originals. Roku-specific caption, trick-play, bookmarking and native runtime requirements must be qualified separately before a Roku release.

No AWS Elemental MediaConvert or Mux is needed in initial P6. Leave a replaceable encoding-job/provider seam. Do not bind persistent ChannelSpec or creator-owned releases to private S3 URLs, expiring presigned URLs, credentials, or unreviewed uploads.

## Media identity, state and rights

Extend, do not replace, existing `CatalogItem`, `MediaAsset`, `ChannelSpec` and `PublishedManifest`. Owner-scoped stable media identity points to private master and versioned, content-hashed rendition set. Track upload session, probe metadata, job version/attempt, storage locations, checksum, processing state (pending/processing/ready/failed), publication approval and revocation separately from existing TV-display/TV-playback rights assertions. A ready transcoded file alone is never eligible for publication. Explicit creator consent and independently documented permissions remain mandatory; Amazon storefront, Prime Video and YouTube media URLs do not grant ingestion or TV streaming rights.

P5's published wire contract currently expects approved stable HTTPS URLs. P6 can resolve a verified, immutable CloudFront HLS *master playlist URL* at publication into that compatible contract, while retaining canonical asset identity and rendition provenance privately. Do not opportunistically change a deployed TV schema. Future paid/subscriber streams need authenticated viewer entitlements and a separately versioned playback-resolution contract; never put signing credentials, temporary S3 URLs, secret query tokens or private keys into immutable public manifests.

## AWS security and delivery

- Use distinct private originals and delivery buckets/prefixes, independent of P2/P3 private evidence/object storage; bucket public access blocked, encryption at rest and narrow per-role IAM. CloudFront Origin Access Control allows reads of only the approved delivery objects. Do not enable a public S3 website origin.
- Use short-lived, creator-bound, size/content-type constrained presigned multipart upload sessions with final-size/hash/object-verification. Handle abandoned parts and quotas. The creator cannot pick arbitrary object keys, another account's project, origin URLs or AWS credentials.
- Workers must be isolated from web serving, resource/time/disk/network limited, input probed and validated, idempotent and resumable, with bounded retries, failure reports and cleanup. Never pass arbitrary FFmpeg flags, shell commands or filesystem paths from tenants. Record provenance and processing-tool version.
- Upload HLS outputs under immutable release/rendition prefixes; set correct MIME types for `.m3u8` and segments; stage-verify all playlists and referenced objects before approving a release. Prevent direct public access to unapproved media. Manifest-only publication and CDN cache invalidation are different operations.
- Initially public free-to-view playback is in scope. OAC **does not** paywall CloudFront URLs. Viewer IAP/entitlements, signed CloudFront cookies/URLs, DRM, live streaming, 24/7 playout, advertising and revenue distribution are deferred, and must not be claimed from S3+CloudFront alone.
- Revocation must stop new publications and new authorization promptly; disable future delivery as technically supported, with explicit CDN cache TTL/offline-client limitations. Never promise instant removal of cached segments on disconnected televisions.
- Measure stored GB, encoded/output minutes, CloudFront transfer/requests, processing cost, failed jobs and per-creator quotas. Configure AWS budgets and alerts; AWS free-tier/flat-rate plan eligibility and future rates must be confirmed for the actual account before cost claims.

## Phase boundaries and qualification

Existing **P5 (0.5.x)** remains unmodified. Its P8 manual closeout must prove real installed-VPKG HTTPS remote manifest refresh/LKG/rollback, using controlled rights-cleared media or informational content; do not make P5 wait for P6. New P6 (0.6.x) owns bounded upload/encode/delivery and end-to-end Vega HLS proof. Former planned P6 sync becomes P7 (0.7.x), P7 publishing becomes P8 (0.8.x), and P8 launch becomes P9 (0.9.x). Historical closeout labels, including P5 P8 as a *prompt number*, never change.

P6 GREEN requires owner-authenticated direct S3 upload, duplicate/foreign/revoked denial, durable and restart-safe job state, FFprobe verification, at least one real FFmpeg HLS package, private S3 origin and verified CloudFront delivery, correct publication/revocation boundary, playback on the qualified Vega target, failure/retry recovery, and real cost/credential boundary observations. Browser Preview, generated manifests and unit mocks alone are insufficient. AWS credentials/paid calls must not be fabricated. Production hosted S1–S6, live P4 AI, physical Fire TV/Appstore, Fire OS/Roku player parity and later subscriptions remain separately OPEN until directly qualified.

## Consequences

This adds storage and background processing operational responsibility in exchange for avoiding managed-transcoding per-minute charges. CloudFront transfer, request, S3 and worker costs still apply. P6 implementation uses the normal `/prompt-ass` -> `/prompt-plan` -> `/prompt-write p6` workflow after docs application; this ADR does not authorize an unbounded service or change P5's authored prompts.

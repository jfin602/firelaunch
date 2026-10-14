# ADR 0011 — Managed AWS Video on Demand Foundation is FireLaunch's media processing dependency

Status: ACCEPTED for architecture and correction planning; implementation and live AWS/Vega qualification NOT YET PROVEN
Date: 2026-10-14
Scope: Creator-uploaded free-to-view VOD for FireLaunch launch MVP; correction `c6-aws-vod` at unchanged root `0.6.7`.
Supersedes: ADR 0010's FFprobe/FFmpeg worker, encode operations, custom HLS production and FFmpeg worker deployment decisions ONLY. ADR 0010's creator rights, authenticated upload, private-origin, CloudFront, publishing, revocation and device gates remain in force.
References: [AWS VOD Foundation](https://docs.aws.amazon.com/solutions/latest/video-on-demand-on-aws-foundation/solution-overview.html), [architecture](https://docs.aws.amazon.com/solutions/latest/video-on-demand-on-aws-foundation/architecture-overview.html), [AWS job workflow](https://docs.aws.amazon.com/solutions/latest/video-on-demand-on-aws-foundation/architecture-details.html), [reference source](https://github.com/aws-solutions-library-samples/video-on-demand-on-aws-foundation), [FireLaunch adapter runbook](../integrations/aws-vod-foundation.md), [P6](../tasks/p6/README.md).

## Decision

FireLaunch-managed creator video uploads SHALL use a reviewed deployment/customization of **Video on Demand on AWS Foundation**, powered by AWS Elemental MediaConvert, as the production encoding and HLS packaging service. Do NOT operate or deploy the existing dedicated FireLaunch FFmpeg/FFprobe transcoding worker in the new path. FireLaunch owns authenticated creator upload authorization, catalog identity, durable job association, source and display/playback rights, publication, revocation and Vega presentation; AWS Foundation owns managed transcode job orchestration and encoding. Muffinos retains API/PostgreSQL control-plane duties and never encodes or serves video bytes.

The Foundation architecture is a reference solution, not a fully managed FireLaunch-specific SaaS API. Its default S3 upload triggers job-submit Lambda, MediaConvert, EventBridge/job-complete Lambda and SNS and may make finished outputs available through its CloudFront distribution. Adapt its deployment so **finished but unapproved outputs remain private**. Reuse or reconcile existing private original/delivery buckets and existing OAC-protected CloudFront deployment, rather than blindly deploying parallel publicly exposed distributions. Output staging and final approved delivery are different security domains.

## Stable contract and state

Preserve existing MediaAsset/CatalogItem/ChannelSpec/PublishedManifest IDs, authorization, publication approvals and immutable HTTPS v1 playback contract. Maintain owner/project/asset-specific original object identity, SHA-256/size, upload session and AWS job ID + attempt, encoding settings/version, result staging key/manifest, observed status, verified rendition checksum and revocation. Provider completion is an observation, not publication or a rights grant.

Map existing pending/leased/ready/failed/revoked jobs by an additive migration or compatible adapter to managed states, with explicit provider submit/processing/completed/error and retry semantics. Verify the actual DB schema before altering it. Completion events can arrive twice, out of order or never: correlate trusted job ID to an authorized upload, verify account/region/source/output, handle retry or reconciliation and ignore duplicates. A client, SNS payload or S3 URL alone cannot mark assets READY or publish them.

## Publication and security invariants

- The existing private, short-lived, owner/CSRF-scoped multipart S3 upload remains. Strict owner and creator quotas, MIME/size/hash verification and aborted-upload cleanup remain. Avoid double processing via trigger prefix/filter and idempotent job admission.
- Use a tested lean 480p/720p H.264/AAC HLS VOD profile, adding renditions only when needed for source/device compatibility. Validate MediaConvert profile/job settings and output playlist, variants, segments, MIME, complete object graph and immutable hash; player/device proof is separate.
- Until creator review grants BOTH display and TV playback rights and the P5 approval transaction passes, all raw, intermediate and encoded staging media stay private. Never publish automatically upon upload/MediaConvert completion.
- Promote verified outputs to immutable rights-approved delivery prefixes on private S3 only after publication approval; only these prefixes are CloudFront-readable through OAC. CDN URL is public free-to-view, not paid entitlement; viewer IAP, DRM, territorial/paywall enforcement are out of scope.
- Preserve P5 release integrity, HTTPS public-only resolver, last-known-good, owner-authenticated publish/rollback and revocation rules. Cached CloudFront segments/offline clients may persist; state realistic invalidation and removal limits.
- No AWS secrets/signed S3 URLs in Studio, generated Vega source, ChannelSpec, public manifests, exported code or logs. Use least-privilege assumed roles and service principals; verify trust and encryption/config from actual deployed stack.
- AWS Budgets alerts are visibility, not a hard billing limit. Enforce upload/media duration/total bytes/in-flight job counts and quota throttles in FireLaunch; require explicit operator approval to provision, incur charge or expose a new CDN distribution.

## Transition

At the accepted decision GitHub main is at root `0.6.7` with completed P6 P1–P7 source for S3 multipart, leased FFmpeg worker, staging/publication, revocation, Studio and operator runbooks. That work is retained as historical context, not marked GREEN. Correction `c6-aws-vod` implements the managed provider migration without rerunning P6 P1–P7 or changing version. Safely retire FFmpeg scripts/roles only after provider path and regression proof; preserve historical files/commit references and existing uploaded assets and DB job rows. New Phase 6 P8 at planned `0.6.8` must qualify real S3 -> MediaConvert Foundation -> verified private staging -> authorized CloudFront HLS -> SAME installed Vega VirtualDevice, plus deferred P5/c5 gates where applicable. Existing P0/P2/c2/P4/P5/c5 outcomes and production S1–S6 are unchanged.

## Non-goals and consequence

No automatic AWS deployment/purchase, no media from Amazon/Prime/YouTube without independently documented rights, no provider-agnostic transcoding marketplace, no full Video on Demand on AWS Step Functions solution, no Fire OS/Roku/physical device certification. Additional MediaConvert charges replace worker operations; CloudFront/storage/request costs still apply. Use offline tests for implementation, with live cloud proof ONLY at authorized manual closeout.

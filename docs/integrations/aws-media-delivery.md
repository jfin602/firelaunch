# FireLaunch AWS Media Delivery — setup and qualification runbook

Status: APPROVED DESIGN / NOT PROVISIONED OR QUALIFIED by this document
Date: 2026-10-11
Decision: [ADR 0010](../decisions/0010-aws-media-delivery.md)

## Purpose and boundary

Creator-controlled originals are directly uploaded to private S3, converted by an independent FFmpeg worker into HLS, verified, and delivered from a private S3 origin using CloudFront OAC. Keep evidence/private media objects already used by P2/P3 separate. The existing `firelaunch.jfin.dev` Studio/API on muffinos is the control plane only: 2 vCPU is not an appropriate multi-tenant transcoding or video-delivery machine. A locally operated Linux worker is acceptable for **initial qualification**, not unattended production.

## AWS inventory (planned, no existing resources assumed)

| Resource | Purpose / permission boundary |
| --- | --- |
| Private `originals` S3 bucket | Owner-bound multipart uploads and worker reads; Block Public Access, SSE, lifecycle for incomplete uploads |
| Private `delivery` S3 bucket | Immutable HLS outputs; Block Public Access, SSE; only worker writes and CloudFront OAC reads |
| CloudFront distribution | HTTPS TV-facing HLS and artwork; standard S3 origin (NOT S3 website endpoint), OAC SigV4 and least-privilege bucket policy |
| Creator uploader role | Server-controlled presigned upload sessions; no wildcard public listing or access to other owners |
| Encoding worker role | Read authorized originals, write only staged/approved delivery prefixes, verify outputs, limited AWS permissions |
| FireLaunch control-plane role | Read/write project-specific metadata; issue uploader sessions; sign publication decisions; not a master encoding account |
| Metrics/budget | CloudWatch/usage monitoring, per-account and per-creator limits, AWS Budgets alerts |
| Optional independent restore target | Qualified S3+PostgreSQL backup/restore remains a separate hosted gate, not solved by media delivery buckets |

Use minimal IAM actions actually required by multipart upload and object verification; when direct-upload sessions are issued, validate expected size/type/hash and close/abort unused sessions. Use partitioned object names keyed to internal opaque owner/project/media IDs, not untrusted filenames. Never store AWS credentials in Studio code, public manifests, Git, or device packages.

## Initial media processing profile

1. Accept creator-owned source with separately reviewed TV rights. Probe container, H.264 profile/level, AAC audio, resolution, SAR, timestamps, duration, GOP/keyframe cadence, frame rate, bitrate and corrupt/truncated input with `ffprobe`.
2. Reuse source encoding only if genuinely compatible. A codec-matching MP4 can still have misaligned keyframes or timestamp defects; failed validation must trigger encoding or a safe failure.
3. Baseline development HLS ladder: 480p and 720p, preserve aspect ratio/no upscale. Use AVC/H.264 + AAC-LC stereo, aligned ~6-second segments and an adaptive master playlist; add 1080p only when needed. Test on actual supported Vega target. Additional low-bitrate rung, captions, trick-play or DRM may be required for future targets.
4. Enforce worker CPU, RAM, disk, process/network timeouts and concurrency; create staging artifacts outside public delivery prefixes. Validate each rendition, master manifest, segment existence, MIME, hashes, playback seeking and duration before publication.
5. Copy validated outputs into immutable, hash/versioned delivery prefixes. Use `application/vnd.apple.mpegurl` or other correctly supported HLS playlist MIME and correct segment MIME. Ensure CloudFront can read the full playlist/segment graph via OAC.
6. Record processing state, output hash/version, profile/rendition metadata, creator/project scope, errors/retries, and rights/publish eligibility in the database. A source upload is not an automatic published stream.

An HLS library has hundreds of segment objects per video even with two renditions. Request volume as well as transferred GB affects service sizing and cost.

## Public, private and paid content

Initially publish only **approved free-to-view content** with stable CloudFront HTTPS HLS locations. S3 direct URLs and draft uploads remain private. An unpredictable object key is not a purchase entitlement. CloudFront OAC restricts S3 origin access **but does not restrict public viewer access to CloudFront**; for future paywalled channels introduce authenticated viewer entitlements and a separate playback authorization flow. For multi-file HLS protected playback, evaluate CloudFront signed cookies/URLs carefully with native player capabilities; do not embed expiring tokens inside immutable PublishedManifest v1. DRM and platform purchasing integrations require separate explicit scope and device evidence.

Rights requirements: independently cleared television playback, imagery, audio, captions, territory and monetization rights; preserve evidence and revocation history. A public Amazon page, ASIN, Prime Video entitlement or YouTube embed does not authorize ingestion/download/rehosting. Do not scrape proprietary storefront video URLs or evade DRM. No AWS service conveys intellectual-property rights.

## Distribution / policy qualification

- **Vega OS:** P6 real-device-path test for CloudFront HLS; confirm player/API selection, buffering, seek/Back and network fallback on the actual installed Vega SDK/VirtualDevice combination. Never infer physical Fire TV compatibility from the simulator.
- **Fire OS:** Android media adapter is future independent work, not simply reuse the Vega binary.
- **Roku OS:** Separate SceneGraph/BrightScript renderer/player. Verify bitrate ladder, trick-play thumbnails for eligible long VOD, bookmarking, caption accessibility, DRM when relevant and Roku certification rules before claiming compatibility.
- **Publishing:** Creator's approved channel manifest and HLS manifest are distinct. Immutable channel release points to immutable, approved media rendition. Releasing another catalog/layout version must not mutate prior approved bytes.
- **Revocation:** Stop new publication, restrict future delivery and handle CDN TTL/invalidation explicitly. Already cached media and disconnected clients limit how promptly removal propagates.

## Cost model (do not hard-code pricing into contracts)

Variable costs: S3 originals+rendition storage (GB-month), S3 operations and retrieval, CloudFront bytes delivered by geography, HTTP requests (HLS is request-heavy), local/remote encoding worker resources, logs and backups. MediaConvert is deliberately absent from initial P6; compare it later only if FFmpeg operations cost outweighs managed encoding. Verify account eligibility for CloudFront free tier or flat-rate plans, their terms/allowances and potential performance policies directly in AWS before assuming any fixed streaming cost. Set budgets, account-level quotas and creator caps before opening public video uploads.

Official references:
- [Amazon S3 presigned upload](https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html)
- [S3 multipart upload](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html)
- [CloudFront Origin Access Control](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html)
- [CloudFront signed cookies](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-signed-cookies.html)
- [AWS pricing](https://aws.amazon.com/cloudfront/pricing/)
- [FFmpeg HLS muxer](https://ffmpeg.org/ffmpeg-formats.html#hls-2)

## P6 independent closeout evidence checklist

Record exact app and migration version/commit, encoding-worker tool versions, sanitized AWS region/resource classes (not secrets), controlled source proof, creator account and project isolation, private upload success/denial, processing/remux vs re-encode decisions, rendition manifest/sample checksum and verification, CloudFront HTTPS playback and cache behavior on Vega, revocation and failure/retry handling, observed request/transfer/storage metrics and budget guardrails, restart/restore boundaries and Ngest unaffected. Mark each step PASS, PARTIAL or BLOCKED. A website playing an MP4 or mocked HLS URL does not qualify native-TV delivery.

Existing historical NOT GREEN and P2/c2 hosted S1–S6 statuses remain untouched; P5 qualification is separate. P6 has no implementation prompts until the normal planning workflow.

# ADR 0013 - Hybrid free and protected video delivery

Status: OWNER ACCEPTED FOR DOCUMENTATION / NOT IMPLEMENTED OR DEVICE QUALIFIED
Date: 2026-10-17 UTC
Scope: FireLaunch Phase 6 initial free-to-view VOD, with future protected purchase/rental/subscription delivery.
Related: [ADR 0011](0011-aws-vod-foundation.md), [ADR 0010](0010-aws-media-delivery.md), [P6 live-VOD plan](../tasks/p6-live-vod/README.md).

## Context

The FireLaunch MVP serves rights-cleared, creator-owned free-to-view videos. Its existing PublishedManifest v1 stores a stable HTTPS media URL. The current Vega template initializes `VideoPlayer` by assigning `item.mediaUrl` directly; it has no qualified viewer entitlement exchange or evidence of native CloudFront signed-cookie propagation to all adaptive HLS requests. Later AWS integration notes have therefore held CloudFront disabled pending an unbuilt viewer-signing flow, even though ADR 0010/0011 explicitly selected free-to-view playback.

Paid videos are a future product goal. A purchase-screen UI without cryptographically enforced playback authorization is not access protection: anyone with a stable public CDN URL could fetch the segments.

## Decision: hybrid by access policy, not separate encoding systems

1. **Initial P6 supports only free-to-view publication.** Creator-approved, completely verified HLS renditions can be delivered via stable unsigned CloudFront HTTPS URLs. Anonymous viewers may fetch those *approved* delivery objects, but the original/staging objects remain private. This explicitly resolves the prior "viewer signature required before any CloudFront enablement" restriction **for free delivery only**. It does not authorize enabling CloudFront now; an operator must independently approve and qualify the real distribution and every access boundary.
2. **Future access modes** are `free`, `purchase`, `rental`, and `subscription`. This is a conceptual content-access policy interface/forward design, **not** a Phase 6 schema migration, creator-facing paid-video selector or assertion that any paid mode is implemented. If a typed policy is later introduced, `free` may be emitted only for explicitly approved free works; missing/unknown paid policy must fail closed and never default to public delivery.
3. **One managed processing path** remains: authenticated private S3 original -> AWS Video on Demand on AWS Foundation/MediaConvert -> privately staged and verified HLS rendition set. Access policy is enforced at *promotion, publication and playback authorization*, not by duplicating encoders or putting credentials into ChannelSpec.
4. **Free playback path:** owner, source, artwork-display and TV-playback rights checks; verified rendition graph; explicit creator P5 approval; immutable `delivery/` object promotion; approved PublishedManifest v1 stable CloudFront master URL. Enforce exact nested owner/project/asset canonical delivery-prefix policy, OAC-only S3 reads, protected S3 Block Public Access, viewer-path guard that excludes `original/`, `staged/`, malformed paths and other arbitrary keys. CloudFront OAC authenticates CloudFront to S3 **not viewers**; viewers of approved free bytes need no entitlement.
5. **Future protected playback path:** must use independently qualified verified purchaser/subscriber entitlement, scoped short-lived playback authorization and protected CloudFront HLS master/variant/segment requests. Evaluate signed cookies versus signed URLs with playlist/segment rewriting and renewal on the real Vega native player. Use a versioned playback resolution/exchange contract that does **not** embed expiring credentials or buyer identity in immutable public PublishedManifest bytes. Protected HLS is kept outside publicly readable free delivery paths, with an independently testable CDN cache and access boundary; do not assume one CloudFront distribution or signing approach is already selected.
6. **Fail closed for paid access:** no purchased/rented/subscriber work may be marked publishable or written to free/public delivery under a future policy. If protected delivery or entitlements are unavailable, leave it private and unavailable; do not use a misleading in-app paywall with open HLS URLs.
7. **Public-to-paid transition limitations:** an already public video cannot be retroactively made secret. Future conversion must stop the public resolver reference, revoke/remove approved free delivery keys with authorized bounded invalidation, move to a protected namespace, publish an explicitly approved new revision and document cache/offline/download persistence. No immediate erasure claim, and old immutable releases/bytes cannot be silently rewritten.
8. **Creator rights are distinct from viewer access:** the uploader's TV-display/playback attestation, catalog provenance and revocation remain necessary regardless of whether viewing is free or paid. An advertisement or sponsor on an otherwise publicly playable video does not require viewer entitlements; rental/purchase/subscription restriction does.
9. **Vega playback compatibility:** qualify the actual adaptive HLS player path (including MSE as required by the installed SDK), full segment graph, pause/seek/Back, lifecycle and error handling. Native viewer-signing compatibility is a later distinct paid-content gate and must never be claimed from free-video playback.
10. **Payment/platform compliance:** Amazon Vega IAP/service support, store policies, purchase verification, account binding, regional availability, DRM/content rules, refunds, renewal and entitlement revocation require new review and approval when paid delivery is scheduled. Do not claim that Amazon IAP, monetization, DRM or subscriptions exist in this MVP.

## Security and operational prerequisites for free CloudFront activation

A dedicated operator must inventory actual account/region, distribution/OAC and bucket policies, signing/function configuration, IAM role separation, cache/TTL and viewer-path rules. Require no new public S3 ACL, public bucket or auto-published Foundation output. A CloudFormation change set and its effects must be reviewed before any execution. Verify real 403/404 negatives for original/staged/unapproved/foreign/malformed paths and positive 200 only for an explicitly approved immutable delivery graph, with correct playlist/segment MIME. Check owner/CSRF rights, P5 immutable release pointer and recency after revocation; measure cache persistence honestly. Require budget/operator approval for paid AWS job and distribution activation.

Keep the existing CloudFront distribution disabled until Q2 prerequisites are directly qualified and approved. Do not add a signing key solely to enable free playback, and do not remove defenses needed for future protected assets. No raw AWS credential or private S3/signed capability leaks to viewer manifests, client source, exported code or logs.

## Consequences and boundaries

- ADR 0011 MediaConvert, private staging and ownership remain unchanged.
- ADR 0010 free-viewer semantics are reaffirmed; its superseded FFmpeg material remains historical.
- Existing signed-cookie/URL warnings continue to apply **to paid/protected playback**, not to approved free-viewer HLS.
- Phase 6 live proof is separated into Q1 private managed processing, Q2 approved public free release, Q3 real Vega playback; see [qualification matrix](../tasks/p6-live-vod/qualification-matrix.md).
- No schema, version, cloud stack, staging host, data, native client, or code changes are authorized by this decision.
- Current c6-video-publishing-ux staging GREEN and prior P5/c5/P6 NOT GREEN states remain as recorded.

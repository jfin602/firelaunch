# Phase 6 — Prompt Assessment: AWS Creator Media Foundation

Date: 2026-10-11
Status: approved design assessed and decomposed; source implementation NOT STARTED
Decision: ADR 0010, FFprobe/FFmpeg + private S3 originals and delivery + CloudFront OAC
Predecessor: P5 implementation source and migration 010 are integrated. P5 P8 and c5-vega P3 independent closeouts are NOT GREEN, although c5 produced a nonempty hash-verified example-bound fixture VPKG. On 2026-10-12 the owner deferred the real creator-owned HTTPS/same-installed-VPKG gates to P6 integration and explicitly cleared P6 P1–P7 implementation at 0.6.0. See deferred-qualification.md. No external/cloud/device qualification was granted.

## Gap / existing baseline

Current inspected contract boundaries: `packages/contracts/src/catalog.ts` already has strict `MediaAsset` with owner/project/catalog item, HTTPS/upload/private-object location and independent TV display/playback rights; `packages/contracts/src/publication.ts` validates HTTPS publication and MediaAsset provenance. P5 plans to repair information-only items and implement immutable published releases/public resolver/TV refresh. `apps/server/src/private-objects.ts` uses S3 for small, authenticated, approximately 1 MB private objects; **that is not a large-video ingest system**. `apps/server/src/hosted-repository.ts` uses migrations and owner-scoped transactions. `apps/server/src/api.ts` enforces cookie auth and CSRF in hosted mode. `apps/studio/src/sample.ts` still uses a loopback demo video URL; hosted editor defaults must be corrected. `packages/generator/src/index.ts` and Vega runtime handle TV generation independently of cloud media. Nothing reviewed establishes a deployed and qualified CloudFront+FFmpeg HLS pipeline.

## Requirements and alternatives

1. **Chosen:** direct S3 multipart original uploads, separate FFmpeg worker, immutable HLS outputs on private S3 behind CloudFront OAC. Favor creator-controlled video masters; no rights inferred from Amazon URL, ASIN, YouTube or Prime Video.
2. **Rejected for now:** Mux/MediaConvert per-minute processing, VPS-hosted transcoding/segment delivery, client-side extraction of third-party hosted streams, and publishing raw private S3 objects. All remain optional future provider implementations subject to rights and cost review.
3. **Media shape:** stable owner-scoped MediaAsset IDs and separate processing/upload/job/rendition state; make additive, versioned extensions preserving historical catalog, stored projects and ChannelSpec schema/TV LKG compatibility. Do not put transient AWS state inside published manifests.
4. **Media quality:** H.264/AAC HLS, initially two aligned renditions (480p/720p), optional 1080p; FFprobe detects safe remux potential, otherwise bounded FFmpeg conversion. Single MP4 can be a staging fixture but does not qualify adaptive delivery or future Roku requirements.
5. **Public vs private:** separate encrypted private originals/evidence from delivery origin, which stays blocked from direct public S3 reads. Public CloudFront URLs are *free-to-view only*. A paid stream needs future viewer entitlements, short-lived authorization and app-store billing, not OAC alone.
6. **Processing:** run independently of muffinos; bounded CPU/RAM/disk, concurrency 1 initially, deterministic idempotent retries and cancellation/abort; do not construct shell flags from untrusted creator input. Owner-controlled spend/quota limits are product constraints, not just documentation.
7. **Publish boundary:** existing P5 approved release is the only route to a TV player. Verified compatible HLS master URL must be stable, owned, rights-cleared and reference complete immutable output. Revocation invalidates future authorization/publication and planned cache lifetime; does not promise immediate removal of offline/Cdn-cached bytes.

## Architectural risk matrix

| Risk | Mitigation and test |
| --- | --- |
| Foreign account uploads or consumes another creator's media | Real owner principal, owned IDs, DB FK/CAS, presigned key scoping, denied foreign upload/finalize and public publication |
| Unbounded public upload / surprise costs | Max bytes/minutes, account quota, signed short expiry, multipart abort lifecycle, job concurrency/cost counters and AWS budget alerts |
| SSRF/host/path/command abuse in worker | Read only the owned S3 source, fixed ffprobe/ffmpeg argv, safe temp workspace, resource/time limits, isolated IAM/network; no arbitrary remote URL ingest |
| Broken HLS from codec-only assumptions | Probe keyframe cadence/timestamps, multi-rendition segment alignment, manifest graph and MIME verification, real device seek/Back |
| Leaked originals or unpublished media | Separate buckets/prefixes, OAC policy, unsigned S3 denied, prohibit unfinished prefixes in public distribution, no credentials/signatures in manifests |
| Stale or revoked rights | Publish-time revalidation, immutable release history, refuse newer publish, invalidate future access where possible, document CDN TTL/offline limitations |
| Broken P5 installed TV contract | Keep ChannelSpec/manifest version compatible; P6 stores stable HTTPs master HLS URL in the existing allowed public binding; explicit new client contract only if necessary with P5 regression |
| Worker/laptop outage and VPS overload | Persistent job state, bounded retry, external worker startup manual; no direct encoding/video served on muffinos; monitor Ngest |
| External unavailability | Offline injected S3 and stubbed FFmpeg fixtures in P1–P7; mandatory actual AWS/CloudFront/Vega evidence at manual P8, NOT GREEN if blocked |

## Open decisions held to P6 implementation

- Actual AWS account, verified budget, region, CloudFront pricing/free-plan eligibility, storage quotas, IAM credentials and bucket names are operator-owned; nothing is provisioned in this documentation task.
- P5 candidate may have changed data/migration/TV contracts. Implementation must inspect latest committed P5 work, choose the next migration dynamically and refuse to run on a mismatched baseline rather than assume migration 009 is final.
- Final client player and device specifics must be validated with installed Vega SDK, not assumed from browser preview; Fire OS and Roku platform adapters and certification remain future.
- Native free HLS doesn't establish a paid video product. Do not promote IAP, DRM, subscription viewer identities or regional control without a separately scoped rights and entitlement architecture.

## Decomposition / rationale

Seven implementation prompts isolate contracts+job persistence, AWS backend/IaC, upload API, FFmpeg worker, rights-safe publication, Studio UX and convergence. One manual closeout owns real AWS, browser and Vega device, operational and aggregate proof. Keep work targeted, prefer focused tests per prompt, one global check only at closeout. The historical P5 and c5 closeouts are reviewed, and the owner has explicitly approved P6 P1–P7 implementation at 0.6.0 while deferring the live device/HTTPS proof until P6 integration/P8; do not retroactively relabel historical P0/P2/c2/P3/P4 results or P5 on behalf of this P6.

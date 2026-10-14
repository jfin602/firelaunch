# c6-aws-vod — Prompt assessment

Date: 2026-10-14
Disposition: APPROVED architecture and assessed correction; NOT IMPLEMENTED or CLOUD QUALIFIED.
Decision: ADR 0011 supersedes ADR 0010 only for FFmpeg encoding/worker architecture.
Source baseline: GitHub main root 0.6.7 at review; actual execution must verify local HEAD, package version and dirty work.

## Existing implementation inspected

- `packages/contracts/src/media-pipeline.ts` encodes a fixed `hls-avc-aac-v1` profile with upload session, rendition and pending/leased/ready/failed/revoked job schemas.
- `apps/server/src/media-pipeline-repository.ts` owns creator-scoped upload, queue/retry/revoke; `apps/server/src/media-worker-repository.ts`, `media-worker.ts`, `media-worker-cli.ts` implement custom leases and local FFprobe/FFmpeg.
- `apps/server/src/media-storage.ts` signs scoped multipart upload, verifies originals, stages immutable HLS and promotes approved media to CloudFront delivery with strict path/host checks.
- `apps/server/src/publication-repository.ts`, `public-resolver.ts` and P5 contracts guard rights and live manifest publication. `apps/studio/src/VideoUpload.tsx`, `video-upload.ts` and related API integrate a creator-facing workflow.
- `infra/aws-media/template.yaml` provides custom S3 + private CloudFront OAC and IAM worker/uploader/publisher roles, but not a deployed AWS VOD Foundation.
- Existing P6 P1–P7 commits implemented code without proving real AWS/creator/Vega qualification. The historical P6 README and plans still describe FFmpeg; don't rewrite past evidence.

## Options considered

1. **Chosen**: AWS Video on Demand on AWS Foundation managed S3/Lambda/MediaConvert/EventBridge pipeline, customized to output private staging and reuse rights-approved delivery. Adopt as required FireLaunch-managed video processing.
2. Rejected: operating FFmpeg on laptop/VPS, maintaining custom worker capacity and FFmpeg command/tool dependency.
3. Rejected for this correction: full Video on Demand on AWS solution with Step Functions/DynamoDB/other extras; optional third-party encoder marketplaces; introducing new public playback contract, viewer paywall or DRM.

The AWS solution is reference IaC plus event-driven components, **not** a managed API that directly knows about FireLaunch creator accounts or approval states. Its default CloudFront output MUST be gated/reconfigured; naive deploy would violate private draft and revocation requirements. `jobs-manifest.json`, SNS or raw events alone cannot establish trusted owner/job correspondence.

## Primary risks and mitigations

| Risk | Mandatory mitigation and test |
| --- | --- |
| Auto-published unapproved VOD output | Private staging, CDN deny, approval-only promotion and negative anonymous fetch proof |
| Duplicate/out-of-order/missing AWS events | Durable correlation, idempotency, trusted source/account validation, reconciliation and lease/attempt safety |
| Incompatible old DB/worker rows | Forward-only additive migration, safe rollback/replay of legacy READY assets and explicit in-flight draining policy |
| S3 trigger processes foreign/unverified input | Prefix isolation, idempotent admission token and verified completed upload/rights boundary |
| Output playlist or missing segment | Verify actual HLS graph, MIME, version/checksum and S3 object membership before READY |
| CloudFormation removes existing assets | Operator change sets, no automatic deployment, explicit reconciliation of buckets/distribution and narrow IAM |
| Budget blowout | Short bounded profiles, per-account quotas, hard application admission, AWS Budgets monitoring (alerts not a spending cap) |
| Studio/TV regression | Unchanged P5 manifest v1/public-resolver/LKG and Studio rights; focused two-principal and native contract tests |
| False GREEN | Separate local correction closeout from actual managed AWS -> CloudFront -> Vega P6 P8 |

## Prompt split

Four runner prompts in dependency order: P1 provider/state seam, P2 Foundation infrastructure/security event boundary, P3 lifecycle/HLS/publishing, P4 legacy retirement + UI/regressions. P5 is a separate manual, independent code/security/aggregate review and Phase 6 P8 handoff. Prompts must fit bounded sessions (target 8 minutes each, cap 15) and stop on foundational blockers instead of weakening security. Do not rerun complete P6 P1–P7.

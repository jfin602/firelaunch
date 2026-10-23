# VegaLaunch Known Issues and Open Qualification Gates

Updated 2026-10-18. See [CURRENT-STATE](docs/CURRENT-STATE.md) and each dated closeout before considering a gate complete. Historical defects and old prompts remain in their original task records.

## Active qualification blockers

- **p6-live-vod Q1:** a real, authorized paid MediaConvert job, durable provider/event reconciliation and complete verified private HLS have not been observed. Existing Foundation stack/IAM simulation is not live encode proof.
- **Q2:** public-only creator manifest resolver and CloudFront delivery for an explicitly approved FREE video, full graph access-denial and revocation tests are unqualified. CloudFront last observed DISABLED.
- **Q3:** a fresh creator-bound actual Vega VirtualDevice install and native adaptive HLS start/pause/seek/Back, same VPKG v1/v2, offline/LKG, failure and v3 rollback are unqualified.
- **AWS/operator approvals:** queue activation, paid jobs, EventBridge, CloudFormation, public CDN, staging deploy, and creator publication each need specific authorization. AWS Budgets alerts do not hard-stop billing.
- **S3 media recovery:** encrypted staging database archives do not include managed-video original bytes in S3; independently verify their protection/restore plan.
- **Inherited release gates:** historical P5/c5 real TV evidence NOT GREEN; P4 real non-mock catalog-grounded provider and P2/c2 full hosted S1-S6 security not wholly qualified; physical Fire TV and actual Appstore approval remain pending.
- **Studio visual target:** Desert Heat baseline and its separate correction stack are documented, not qualified as the currently deployed UI.
- **Future restricted video:** purchase/rental/subscription entitlements, viewer signing, DRM and native playback protection are not shipped. Never serve restricted media through approved free CDN URLs.

## Qualified boundaries to preserve

- `c6-video-publishing-ux`: bounded staging GREEN for the tested real owner upload, Postgres rights/shelf, S3 private 403, reload and restart. Raw authenticated foreign/CSRF browser API negatives were not independently executed.
- `c6-aws-vod`: locally GREEN for managed provider implementation, not AWS live.
- Client `firelaunch-staging-foundation` nested-key correction: configuration/role-policy simulation qualified at its dated evidence, queue/rule/CDN not activated.
- The previous P0 `0.0.7` failure is historical and is **not** an assertion that no product exists.

Always recheck repo HEAD and current VPS/AWS state before changing operational systems.

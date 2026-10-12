# p6 — AWS Media Foundation

Status: 0.6.0 BASELINE / OWNER-AUTHORIZED P6 IMPLEMENTATION / P5-c5 LIVE QUALIFICATION DEFERRED
Date: 2026-10-11
Phase: Launch-MVP Phase 6 (new media foundation; former P6 catalog sync is now planned P7)
Repository baseline for authoring was 0.5.0. GitHub main now includes the original Phase 5 seven implementation checkpoints and independent P8 NOT GREEN closeout, integrated after the owner approved root `0.6.0`. Source publication/resolver/native-loader exists, but compatible creator-bound VPKG and on-device remote update were not qualified.
Execution entry (2026-10-12 owner decision): **P6 P1–P7 implementation may begin now at root `0.6.0`**. Historical P5 and c5-vega P3 closeouts remain NOT GREEN; the c5 example-bound VPKG build succeeded, but a real owner-approved public HTTPS release and same-installed-device v1/v2/fault/v3 proof were not obtained. Defer those LIVE gates to P6 integration and manual P8, not the security/rights code requirements. If actual P5 source publication/rights/resolver interfaces are absent or unsafe, stop/fix within scope instead of weakening checks. See [deferred gate ledger](deferred-qualification.md).
Implementations: P1–P7 `0.6.1`–`0.6.7`; P8 independent manual closeout `0.6.8`.
Primary target: hosted FireLaunch control plane and a REAL Vega VirtualDevice HLS playback run. Physical Fire TV / Fire OS and Roku qualification are later.
Models: GPT-6 Sol High for contracts/security/AWS/worker/publication and independent qualification; GPT-6 Sol Medium for bounded Studio UI.

## Mission

Ship the first creator-owned, rights-cleared, free-to-view video from **direct private S3 upload** through an independently operated **FFprobe/FFmpeg HLS worker** to **private S3 delivery plus CloudFront OAC**, then into an explicitly approved P5-style public channel release and real Vega playback. Keep FireLaunch Studio/API/PostgreSQL on muffinos as the control plane and **never** transcode large videos or serve HLS segments from the 2-vCPU VPS. The laptop is acceptable as a controlled early worker, never a claimed continuous production encoding service.

ADR 0010: [AWS media architecture](../../decisions/0010-aws-media-delivery.md). Setup/evidence: [AWS runbook](../../integrations/aws-media-delivery.md). P5 semantics: [ADR 0009](../../decisions/0009-live-channel-delivery.md).

## Prompt Stack

| Prompt | Focus | Version | Model | Browser |
| --- | --- | --- | --- | --- |
| P1 | Media lifecycle contracts + durable owner-scoped jobs | 0.6.1 | GPT-6 Sol High | no |
| P2 | AWS S3 and CloudFront provider/configuration infrastructure | 0.6.2 | GPT-6 Sol High | no |
| P3 | Authenticated direct multipart upload and verification API | 0.6.3 | GPT-6 Sol High | no |
| P4 | Deterministic FFprobe/FFmpeg worker and HLS verification | 0.6.4 | GPT-6 Sol High | no |
| P5 | Publish verified CloudFront HLS and rights-safe revocation | 0.6.5 | GPT-6 Sol High | no |
| P6 | Studio upload/processing UI and hosted media defaults | 0.6.6 | GPT-6 Sol Medium | no |
| P7 | End-to-end convergence, security regressions and live runbook | 0.6.7 | GPT-6 Sol High | no |
| P8 | Independent real S3/CloudFront/browser/Vega closeout | 0.6.8 | GPT-6 Sol High | **yes, MANUAL** |

Implementations must be bounded (target <=8 minutes per prompt, <=15 minutes worst case); inspect/reuse source before edits, perform focused tests and affected typecheck/build, and leave one comprehensive aggregate to P8. Runner owns all implementation checkpoint commits. Manual P8 never self-commits.

## Approved boundaries

- Creator has **independent legal rights** to source video, artwork and TV distribution; an Amazon storefront, Prime Video, YouTube embed or affiliate listing does not establish rights. No scraping/download/DRM circumvention.
- Keep private evidence P2/P3 S3 service separate from large originals and immutable HLS delivery storage. S3 buckets remain nonpublic; CloudFront OAC allows approved free media only and **does not paywall** its viewer URL.
- Use H.264/AAC HLS: FFprobe first, validated remux/stream-copy only when safe; initial 480p/720p two-rendition ladder with 1080p optional, no upscale, ~6s aligned segments. This is an early development profile, NOT automatic Roku/Fire OS certification.
- Handle upload quotas and multipart aborts, owner/project scope and CSRF, durable processing job/retries, worker resource isolation, signed AWS credential boundaries, content hashes/manifest validation and idempotence.
- Stable MediaAsset identity and existing ChannelSpec/PublishedManifest compatibility. Publication binds reviewed rights and an immutable, stable CloudFront master HLS URL, not raw private S3 references or temporary signatures.
- Publish approved free-to-view VOD first; signed viewer playback, entitlements, Amazon IAP/Roku Pay, DRM, Fire OS/Roku native adapters, live TV/EPG and industrial multi-tenant transcoding are outside P6. Revocation/new authorization can be prompt; cached/offline bytes cannot be instantaneously erased.
- No on-VPS build/transcode, AWS IAM key minting from prompts, silently opened cloud spending, disabled auth, or unattended SSH (muffinos password login remains as-is). Infrastructure provisioning and credentials are operator-controlled; deterministic tests do not need live AWS access.

## P6 acceptance / GREEN

P8 directly witnesses a consented creator upload to private S3 (not the 1 MB P2 private evidence route), owner/foreign denials, durable FFmpeg processing and validated HLS playlists/segments, safe release publication, real CloudFront HTTPS serving with private S3 denial, functioning playback/seek/Back and network recovery on a qualified Vega target, real cleanup/revocation/caching behavior and operational resource/cost tracking. It also checks Ngest unaffected on muffinos. Missing AWS credentials, working real CloudFront delivery, suitable source rights, browser or Vega device proof is a **NOT GREEN** closeout, not a reason to bypass guards or claim success from mocks.

Historical P2/c2 hosted S1–S6, original P4 non-mock provider, P5 installed-app refresh, physical Fire TV/Appstore and eventual Roku/Fire OS remain distinct gates. Record what was observed, not assumed.

## Run only when P6 is activated

From the actual owner's checked-out FireLaunch repository:

```bash
cd /home/jfin/dev/firelaunch
git status --short
node --version
npm --version
npm run codex:stack:validate -- p6
npm run codex:stack -- p6
```

The owner has authorized running P6 implementation now despite the c5/P5 live NOT GREEN outcome. Confirm clean/current main, root version `0.6.0`, Node 24/npm 12, available disk/memory and present docs. If `npm run codex:stack:validate -- p6` fails, correct the prompt stack before execution. No `set -e` or `pipefail` shell setup is required.

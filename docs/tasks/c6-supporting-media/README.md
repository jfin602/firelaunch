# c6-supporting-media — Immediate thumbnails, approved artwork and optional subtitles

Status: DOCS AND PROMPTS AUTHORED / NOT IMPLEMENTED OR QUALIFIED.
Owner approval: 2026-10-19 (US Central); October 23 noon deadline.
Version: root, lockfiles and package versions stay at 0.6.7 for this correction.
Authority: [ADR 0014](../../decisions/0014-video-supporting-media.md), [product model](../../PRODUCT-MODEL.md), [architecture](../../ARCHITECTURE.md), [AWS runbook](../../integrations/aws-vod-foundation.md), [assessment](prompt-assessment.md), [plan](implementation-plan.md).

## Creator behavior

One video has associated independent thumbnail and optional subtitle records with stable ownership, versions, checksum and rights. No new storage bucket or retroactive copying of opaque private objects. The normal video flow never asks a creator to host artwork externally. Immediately render an explicit selected JPG/PNG thumbnail, else a successfully generated still, else saved owned art, else an honest placeholder. Rendering is not blocked by active multipart upload, MediaConvert pending/failed/ready, channel draft or popup close. Persist chosen artwork early and after reload show it across Home, Catalog, Video popup, upload/processing cards and private TV Preview. Use a shared safe owner-scoped media preview; never embed capability tokens/private source URLs into public ChannelSpec or HTML image URLs.

Private artwork is distinct from published artwork. When the creator explicitly approves publication and rights/provenance/current revisions pass, publish a verified, immutable image object through existing delivery-only S3 publisher path and correctly limited CloudFront policy. Existing manifest v1 artwork fields/asset bindings should suffice through resolved server-side URLs. Do not auto-publish thumbnails at upload/READY; do not overwrite older public release artwork. Do not break existing published free release #1, old S3 media, or private staging. Legacy public artwork URL input may remain under advanced compatibility but is not a required normal-user step.

Optional subtitles are future-proofed as language-tagged private UTF-8 WebVTT (.vtt) child tracks with bounded upload, checksum and version. No captions = valid draft, encode, publication and export. No strict PublishedManifest v1 or native Vega changes, no public .vtt access, and no implication that actual TV subtitles are available. SRT conversion/multi-subtitle viewer UI comes later.

## Sequential Prompt Stack

| Prompt | Task | Model | Browser | Version |
| --- | --- | --- | --- | --- |
| [P1](P1-immediate-private-thumbnails.txt) | Immediate local + saved private thumbnail display everywhere | GPT-6 Sol High | no | 0.6.7 |
| [P2](P2-managed-artwork-publication.txt) | Local managed verified artwork delivery and publication resolver | GPT-6 Sol High | no | 0.6.7 |
| [P3](P3-exact-cdn-artwork-policy.txt) | Safe exact CloudFront/JPEG-PNG policy implementation and dry-run tests | GPT-6 Sol High | no | 0.6.7 |
| [P4](P4-optional-subtitle-foundation.txt) | Optional private WebVTT track contracts/storage and small Details UI | GPT-6 Sol Medium | no | 0.6.7 |
| [P5](P5-supporting-media-convergence.txt) | Integrated creator UX, linkages, focused security and regression tests | GPT-6 Sol High | no | 0.6.7 |
| [P6](P6-independent-supporting-media-closeout.txt) | Fast independent browser/local closeout; manual | GPT-6 Sol High | yes | 0.6.7 |

P1-P5 run sequentially with runner-owned commits; P6 is exactly one independent manual closeout and the runner stops before it. No /activate step. Target <=8 minutes / 15-minute hard maximum for each implementation prompt. Each implementation runs affected tests/typechecks; avoid repeat full checks until final convergence when warranted. If a major blocker exceeds budget, stop with a narrow handoff rather than breaking storage/publication rules.

## Coordination and authorizations

The actual local code or staged c6-usability runner may be newer than GitHub main. Before running this stack, inspect git status, branch, commits, dirty changes, P6 deploy status, and current product source; reconcile non-destructively and NEVER reset/clobber unfinished popup/playback fixes. Owner reports playback fixed, but this is not direct independent device/browser qualification. Address supporting media before calling client experience ready.

This stack is LOCAL IMPLEMENTATION/REVIEW only. Do not execute CloudFormation, IAM/CloudFront viewer/public path changes, paid MediaConvert jobs, create a public release, run destructive cleanup, relocate creator objects, migrate DB unsafely, deploy to VPS or change Ngest. The earlier owner preauthorization for MediaConvert queue/event **ingest readiness** does not authorize new public artwork CDN exposure. Store approved review-only AWS proposals until a precise operator permission is granted. Actual client data, old release #1 and future Q2 F7/Q3 evidence must remain intact.

## Entry point

    cd ~/dev/firelaunch
    git status --short
    node --version
    npm --version
    npm run codex:stack:validate -- c6-supporting-media
    npm run codex:stack -- c6-supporting-media

Reconcile GitHub documents with actual local checkout first. After P1-P5 finish, run P6 manually, capturing exact tested SHA/negative tests and whether separate CDN approval is pending. No prompt authoring is product implementation or live deployment.

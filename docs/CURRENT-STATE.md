# FireLaunch Current State

Last documentation reconciliation: 2026-10-19 UTC (staging installation only; other gates retain their own dated evidence).
Purpose: The current, evidence-linked operational and planning entry point. A dated observation is **not** a live health or AWS status check; reverify before changes.

## 2026-10-19 staging reconciliation

Fresh [host and HTTPS inspection](staging-consolidation-2026-10-19.md) found one active `firelaunch-staging.service` on port 4184, current release `/srv/firelaunch/releases/20261018T201026Z-4e4fde123451` (archive SHA-256 `4e4fde123451e75a8f5f211fe3a0805455a545adc9936d273d03209629b18d09`), PostgreSQL `firelaunch_alpha_067` at schema 13, and the retired 4185 service disabled. A fresh active-database dump was verified locally and off host. The Add Video UI remains in the current bundle; its 2026-10-17 authenticated upload qualification is in [its closeout](tasks/c6-video-publishing-ux/closeout.md). The later approved Q2 public pointer and CloudFront master returned 200 on 2026-10-19, so the older CloudFront DISABLED observation below is historical. [Q2 overall remains NOT GREEN](tasks/p6-live-vod/Q2-closeout.md); Q3 is unstarted. No deployment or AWS change occurred in this reconciliation.

## Current source and qualified staging baseline

- Repository: `jfin602/firelaunch`, `main`. The `docs/p6-live-vod-hybrid-20261017` documentation work was fast-forward merged to `main` on 2026-10-18; the documented merge head was `56813c8ebeade12337ce80bf370dd402f130b0f5`. This identifier is a historical merge checkpoint, not a guaranteed future HEAD.
- Root application version: `0.6.7` (as read from the repository on 2026-10-18); do not infer that an unreleased `0.6.8` exists.
- **Current inspected staging release (2026-10-19):** `/srv/firelaunch/releases/20261018T201026Z-4e4fde123451`, version `0.6.7`, archive SHA-256 `4e4fde123451e75a8f5f211fe3a0805455a545adc9936d273d03209629b18d09`. The earlier Add Video release `/srv/firelaunch/releases/20261017T025825Z-59a5a1e6921b` remains historical; its source was `86af42f4dc9ba48a8c5c823e59f100fa10698026`.
- Canonical hosted installation: `https://firelaunch.jfin.dev/` served by **one** `firelaunch-staging.service`, `/srv/firelaunch/current` and Nginx -> `127.0.0.1:4184`, PostgreSQL `firelaunch_alpha_067`, schema **13**. `/srv/firelaunch/previous` now points to `20261018T200727Z-d3063337ccc5`. The retired `firelaunch-alpha-067.service` on port 4185 remains disabled and the retired database is offline. Never start duplicate live FireLaunch installations.
- Authoritative Add Video evidence: [c6-video-publishing-ux final closeout](tasks/c6-video-publishing-ux/closeout.md). Its **bounded STAGING UX GREEN** covered authenticated creator MP4 upload, private S3 original and anonymous 403, Postgres rights/artwork/catalog/shelf, reload, Google reauthentication and canonical service restart. Live raw authenticated negative CSRF/foreign API calls were **not** independently performed; source/tests and real second-account Studio denial supplement that evidence. The later Q2 release retains this UI.
- The staging backup/archive covers its documented Postgres and private-object records; it **does not contain managed video originals in S3**. Verify protected S3 retention/backups independently before recovery or destructive operations. Use [staging release runbook](../scripts/staging/README.md), with actual host state reverified.

## Current qualification ledger

| Scope | Last evidenced status | Authority / remaining qualification |
| --- | --- | --- |
| Add Video minimal UX and owned private upload | **STAGING UX GREEN** | [Upload closeout](tasks/c6-video-publishing-ux/closeout.md) |
| PostgreSQL item/media/rights/shelf persistence, reload/restart | **GREEN for tested staging fixture** | Same closeout; not global production qualification |
| Managed VOD coordinator/MediaConvert provider code | **LOCAL GREEN only** | [c6-aws-vod closeout](tasks/c6-aws-vod/closeout.md); offline tests do not prove real encode |
| Deployed client AWS foundation nested-key/IAM correction | **Configuration qualified on 2026-10-16** | [Deployed correction](tasks/c6-aws-integration-contracts/foundation-change-set-review.md); verify live state |
| Real MediaConvert job and complete private HLS READY | **Q1 GREEN as owner reported; original source-bound record needs reconciliation** | [Q1 closeout](tasks/p6-live-vod/Q1-closeout.md) |
| Approved free CloudFront HLS, owned public manifest | **Q2 overall NOT GREEN; one approved FREE release live** | [Q2 closeout](tasks/p6-live-vod/Q2-closeout.md); F5/F7 remain partial |
| Actual creator-bound Vega VirtualDevice playback and v1/v2/v3 LKG | **NOT QUALIFIED** | [p6-live-vod Q3](tasks/p6-live-vod/Q3-vega-device-playback.txt) |
| P5/c5 creator-bound real device and HTTPS acceptance | **Historical NOT GREEN** | Retain [P5](tasks/p5/closeout.md), [c5](tasks/c5-vega/closeout.md); carried into Q3 |
| P2/c2 complete production hosting S1-S6, P4 live provider, physical Fire TV and Appstore | **Not fully qualified** | Historical closeouts and later launch gates remain independently open |
| Desert Heat Studio visual redesign | **Docs/prompt stack authored, not qualified as deployed** | [c6-desert-heat-studio](tasks/c6-desert-heat-studio/README.md) and [ADR 0012](decisions/0012-studio-visual-identity.md) |

## Historical AWS starting point for Q1 (checked 2026-10-16; later Q2 activation supersedes CloudFront state)

- **Client** AWS account `363242105231`, Region `us-east-2` (verify `sts get-caller-identity` before *any* operation). The old separate account `309403336615` and its unexecuted proposal are not the staging target.
- Existing **firelaunch-staging-foundation** stack reached `UPDATE_COMPLETE`; nested original/staged/delivery paths were evaluated via policy simulation. MediaConvert queue was `PAUSED`, processing EventBridge rule `DISABLED`, and CloudFront distribution `DISABLED`; no real encode, CDN playback, viewer entitlement or live published Vega release was proven. IAM simulation does not replace live positive/negative S3 calls.
- Use existing scoped Roles Anywhere/control, separate publisher role, S3 buckets, queue/SQS, distribution and operator runbooks. Do not deploy a second Foundation stack, unpause or incur paid costs without separate specific approval.
- [ADR 0011](decisions/0011-aws-vod-foundation.md) selects MediaConvert for managed HLS. The legacy dedicated FFmpeg worker is retired. [ADR 0013](decisions/0013-hybrid-video-access.md) permits **approved free-to-view only** CloudFront delivery after creator approval and separate operator/rights/security qualification. The future `purchase`, `rental`, `subscription` modes are conceptual and **not implemented**; do not use the free/public delivery path for restricted paid media.
- Existing/public delivery objects must not become accessible before an explicit qualified, controlled Q2 activation. S3 originals/staging remain private; OAC authenticates CloudFront-to-S3, not viewers.

## 2026-10-18 owner-reported encode and placement sequencing

The owner reports that a video encoded successfully on AWS; this statement **does not independently confirm** complete private HLS graph verification, durable READY, provider/event reconciliation, an updated Q1-closeout or any live Q2/Q3 gate. Verify source-bound Q1 evidence before declaring Q1 GREEN or running publication. The owner approved deferring new creator video-placement UX until **after Q3 GREEN**. Q2 may use the existing `Videos` shelf and repair only the minimum trusted READY managed-HLS to validated ChannelSpec/publication URL binding required for a single approved free video. No multi-shelf/reordering/featured/layout tools should be built before real Vega playback qualification. A future `c6-channel-video-placement` remains a proposed correction, not an active stack.

## Active work: p6-live-vod

Q1 has an owner-reported GREEN result; its original source-bound evidence still needs reconciliation. Q2 has one approved FREE release live but remains **NOT GREEN** overall while F5/F7 proof is partial. Q3 remains unstarted until Q2 GREEN. See [Q1 closeout](tasks/p6-live-vod/Q1-closeout.md), [Q2 closeout](tasks/p6-live-vod/Q2-closeout.md), [plan](tasks/p6-live-vod/README.md) and [matrix](tasks/p6-live-vod/qualification-matrix.md). The manual prompt files must not be run through the Prompt Stack runner.

The `/docs-apply` and prompt-authoring approvals **do not** authorize paid MediaConvert jobs, queue/event-rule activation, CloudFormation/IAM changes, CloudFront public exposure, DNS/Nginx changes, staging deployment, or creator publication. Each requires its own specific authorization at the prompt's stop gate. Keep root version `0.6.7` until separately approved. Preserve Ngest, backup/rollback integrity and all existing creator content.

## Source-of-truth hierarchy

1. **This document:** current dated status and next-work routing; refresh only from directly cited evidence, mark verification date.
2. [Roadmap](roadmap/mvp-roadmap.md): planned future phases, active correction and deferred gates, not observed live status.
3. [ADRs](decisions/): accepted decisions (ADR 0013 hybrid, ADR 0011 MediaConvert, ADR 0012 Studio design, ADR 0009 immutable live delivery).
4. [Current live VOD task](tasks/p6-live-vod/README.md) and [AWS runbook](integrations/aws-vod-foundation.md): active execution constraints; use actual cloud inventory and operator-controlled change sets.
5. Dated closeouts and older prompts: immutable historical scope and evidence. A historical command, provider, path, qualification or phase label is not active merely because it appears in an old file.

Reconcile the actual local checkout (git status/branch, uncommitted changes) and live AWS/staging state before executing commands. No documentation state should be treated as proof that the host was inspected after its evidence timestamp.

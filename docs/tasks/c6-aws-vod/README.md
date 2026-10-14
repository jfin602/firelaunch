# c6-aws-vod — Replace self-hosted FFmpeg with AWS VOD Foundation

Status: P1–P4 RUNNER CHECKPOINTS COMPLETE / P5 LOCAL GREEN / LIVE AWS AND P6 DEVICE NOT QUALIFIED
Date: 2026-10-14
Corrected phase: P6 — AWS Media Foundation.
Root version: `0.6.7` **UNCHANGED** throughout correction.
Authority: [ADR 0011](../../decisions/0011-aws-vod-foundation.md), [integration runbook](../../integrations/aws-vod-foundation.md), [assessment](prompt-assessment.md), [plan](implementation-plan.md).
Independent result: [P5 closeout](closeout.md) at `e207152` and unchanged root `0.6.7`.
Historical references: [ADR 0010](../../decisions/0010-aws-media-delivery.md), [P6 README](../p6/README.md), [P6 P8](../p6/P8-independent-media-closeout.txt), [P5 closeout](../p5/closeout.md), [c5 closeout](../c5-vega/closeout.md).

## Objective

Replace only the completed P6 custom worker/transcoder orchestration with an adapted **AWS Video on Demand on AWS Foundation** MediaConvert path. Keep existing secure direct S3 upload, owned MediaAsset and PostgreSQL records, Studio, rights/publish, immutable CloudFront HLS delivery and Vega client. Foundation output is private staging until explicit FireLaunch approval. This is a source migration, NOT restarting P6 P1–P7 or passing historical P5/c5/P6 qualification. Existing P6 code was committed at root 0.6.7; review current actual HEAD and local dirty state.

## Prompt stack

| Prompt | Focus | Model | Browser | Version |
| --- | --- | --- | --- | --- |
| P1 | Add managed provider boundary and durable AWS job correlation | GPT-6 Sol High | no | 0.6.7 unchanged |
| P2 | Adapt Foundation deployment and private staging event boundary | GPT-6 Sol High | no | 0.6.7 unchanged |
| P3 | Integrate managed encoding lifecycle, verification and approved HLS | GPT-6 Sol High | no | 0.6.7 unchanged |
| P4 | Retire active FFmpeg path; Studio, compatibility and regression convergence | GPT-6 Sol High | no | 0.6.7 unchanged |
| P5 | Independent correction closeout and P6 manual P8 handoff | GPT-6 Sol High | **yes, MANUAL** | 0.6.7 unchanged |

P1–P4 are runner-owned implementation checkpoints, bounded to focused verification with no cloud charges. The runner stops before manual P5. One final aggregate belongs to P5. Do not self-commit in implementation prompts; no root or workspace version bumps.

## Preconditions / gates

Inspect the actual 0.6.7 implementation (S3 upload, media pipeline tables, worker, publisher, CloudFront policy, Vega client) before editing. No AWS live credentials, public staging or native device are required for offline correction implementation. NEVER provision/delete AWS resources, overwrite legacy originals, publish unpublished assets or expose a public CloudFront path automatically. Preserve existing S1–S6 security carry-forward; P5/c5 VirtualDevice/HTTPS gaps remain separate.

Correction LOCAL GREEN means managed-only code path is coherent, FFmpeg no longer required in production, no public unapproved output, owner/rights/CSRF/security and retry/restart regressions pass, CloudFormation/integration runbook and offline provider emulation qualify, and final aggregate is clean. It **does not** imply deployed Foundation, real MediaConvert video, live CDN, Vega playback or P6 GREEN. P6 P8 at planned 0.6.8 still requires those real qualifications. A missing local/security gate is correction NOT GREEN.

## Execution (after integrating latest remote docs without overwriting local work)

```bash
cd /home/jfin/dev/firelaunch
git status --short
node --version
npm --version
npm run codex:stack:validate -- c6-aws-vod
npm run codex:stack -- c6-aws-vod
```

If the worktree is dirty or the branch has diverged, reconcile explicitly; do not force pull, reset or overwrite. Use Node 24/npm 12. The manual P5 can be run separately after all four implementation prompts pass; it writes `docs/tasks/c6-aws-vod/closeout.md` without commit or version changes. Then update **future** P6 manual P8 instructions only, retaining historical prompts and evidence.

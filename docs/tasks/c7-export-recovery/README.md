# c7-export-recovery — Hosted Vega export and real device recovery

**Status: authored for execution on 2026-10-20, not run. This correction is scoped to P7 failures documented in ../p7/closeout.md. Fixed version: 0.7.3 in root package.json and the two top-level package-lock.json version fields. Do not increment to 0.7.4 in this correction.**

## Mission and deadline

The October 23, 2026 noon America/Chicago (CDT) target remains. Deliver a real owner/deployment-bound x86_64 Vega release VPKG inside a downloadable authenticated Studio ZIP and run it independently on a stable Vega VirtualDevice with released creator branding/artwork and approved FREE HLS video/audio, pause/seek/Back and restart. A local SDK fixture, ZIP integrity unit test, browser Preview or successful staging HTTP response does not qualify the correction.

## Trusted starting point

- P7 P1-P3 runner checkpoints: `661ba6e` (0.7.1), `779d17f` (0.7.2), `0cec1c7` (0.7.3); original manual P7 P4 closeout **NOT GREEN**. Root remains 0.7.3. GitHub `main` at `88257d4` incorporates the closeout and Hls.js scanner repairs initially described as uncommitted.
- Owner-approved P7 staging 0.7.3 rollout left React `#root` empty, despite matching static hashes and HTTP 200. Protected rollback restored `0.6.7`/schema 14, with approved release #1 pointer/HLS master hashes unchanged. Original browser-console exception is unknown; do not guess root cause.
- P2 created build-input/ZIP verifiers and guarded `export-app` routes but deliberately left hosted export **blocked** because there is NO isolated worker host, job store or authenticated artifact delivery. Native Hls.js MSE code builds an example-origin VPKG but not an actual creator export.
- The graphical VirtualDevice launched momentarily then reported `running:false`, `qemu:-1` and no connected serial; P7 contains no independent Vega playback or authenticated creator ZIP.
- One P7 closeout aggregate: 341 tests, 326 passed, 0 failed, 15 skipped. That is local source evidence, NOT external qualification. Historical P5/c5/Q2 F7/P6-Q3 states stay unchanged.

Read [assessment](prompt-assessment.md), [plan](implementation-plan.md), [P7 closeout](../p7/closeout.md), [P2 worker blocker](../p7/P2-worker-blocker.md), [P3 evidence](../p7/P3-evidence.md), [current state](../../CURRENT-STATE.md), and [staging runbook](../../../scripts/staging/README.md).

## Four-checkpoint correction

| Prompt | Slice | Model | Browser/device | Version |
| --- | --- | --- | --- | --- |
| [P1](P1-studio-startup-recovery.txt) | Evidence-first blank Studio root repair; early VVD boot preflight | GPT-6 Sol High | no required | 0.7.3 unchanged |
| [P2](P2-isolated-vega-worker.txt) | Qualify/build safe worker host and real creator-bound VPKG receipt | GPT-6 Sol High | no required | 0.7.3 unchanged |
| [P3](P3-authenticated-zip-export.txt) | Durable owner-scoped ZIP jobs, API download and Studio states | GPT-6 Sol High | no required | 0.7.3 unchanged |
| [P4](P4-independent-export-closeout.txt) | Independent signed-in staging, real downloaded ZIP and VVD HLS acceptance | GPT-6 Sol High | **yes, MANUAL** | 0.7.3 unchanged |

P1-P3 are sequential implementation prompts, target <=8 minutes (15-minute hard cap), focused validation and runner-owned commits. P4 is the single independent manual closeout; the runner must stop before it. No `/activate` command. Do not make missing external worker/device access a reason to fabricate evidence or allow privileged fallback; report a precise external blocker and retain safe disabled states. A substantial independently identified blocker may require narrowly reviewed follow-up rather than oversized loops.

## Security and operator boundary

- Native build executes creator-supplied executable source: **never** run it under `firelaunch-staging.service`, VPS API/DB/AWS credentials or a weak subprocess-only isolation assumption. Require an actually qualified separate isolated host/VM/container policy: unprivileged user, no host/provider secret mounts, per-job disposable source, bounded CPU/RAM/disk/process/time, restricted outbound dependencies and HTTPS resolver, fixed commands, authenticated worker receipts/artifact transport, cleanup. A local test worker is not a hosted deployment.
- Jobs/ZIPs are per authenticated creator/project/deployment/release/revision, CSRF-protected for creation, owner-only on status/download, guarded against stale/expired/foreign/revoked artifacts, replay and path injection. A fake worker satisfies unit tests only, not live export.
- Preserve existing authorized FREE release #1, public/private rights boundary, private originals, schema 14, stable staging rollback, AWS budget, protected host permissions and Ngest. No new paid MediaConvert job, publication, IAM/CloudFront/CDN expansion, host provision, SSH privilege broadening, migration, VPS deployment or cache invalidation is authorized by docs/prompt writing. R4 requires explicit scoped operator and any separate creator approvals.
- For R4 GREEN, real production-like Studio must render, browser login must succeed, real isolated worker builds a fresh owner VPKG, browser downloads a hash-checked ZIP, an independently launched graphical VVD installs that exact VPKG and plays its published free HLS picture + audible sound, controls and restart. Browser-only playback or a fixture does not qualify. Broader P6 Q3 v1/v2/offline/fault/v3 remains separate.

## Execution

```bash
cd /home/jfin/dev/firelaunch
git status --short
git log -1 --oneline
node --version
npm --version
npm run codex:stack:validate -- c7-export-recovery
npm run codex:stack -- c7-export-recovery
```

If local tree is dirty, branch diverged or version differs from 0.7.3, reconcile *without reset/clobber* before runner execution. Run P4 separately after P1-P3. Only P4 writes a new `docs/tasks/c7-export-recovery/closeout.md`; leave P7 closeout unchanged. No code changes, version bump or deployment occur merely by authoring this stack.

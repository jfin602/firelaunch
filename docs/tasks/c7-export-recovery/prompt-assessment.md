# c7-export-recovery — Updated prompt assessment: single-VPS worker

Owner decision: 2026-10-20, deadline Friday 2026-10-23 12:00 America/Chicago (CDT). Root package.json and both top-level lockfile version entries remain 0.7.3. These are manually executed correction prompts; do not invoke the Prompt Stack runner, auto-commit implementation, or replay P7 P1-P3.

## What is already GREEN and must not be repeated

- **R1 SCOPED GREEN:** protected Studio release 0.7.3 and production-bundle smoke showed signed-out, authenticated Home and fresh tab with visible React root and no captured browser errors; exact R1 evidence in [R1-closeout.md](R1-closeout.md). The original blank-root exception is still historically unproven and needs no speculative new repair.
- **P7 P1-P3 implementation:** immutable creator-scoped `ReleaseBuildInput`, native build producer commands and VPT identity checks, ZIP checksum/entry validation, Hls.js adaptive MSE native source with local SDK fixture build. P7 P4 historically NOT GREEN because no real hosted ZIP or VirtualDevice installed playback.
- **Phase 6 source/video:** tested private browser playback and public approved free release #1 already exist; no paid repeat encoding or new creator publication needed for this sprint. Preserve historical Q2 F7 partial and native Q3 unqualified states.
- **Current production-like deployment:** 0.7.3 Studio success at `20261020T185232Z-2b17f1479a0e` with schema 14, verified backup and older 0.6.7 rollback. This is a dated observation, not live health query.

## Verified present missing parts

`apps/server/src/api.ts` explicitly responds 503 `NATIVE_WORKER_UNAVAILABLE` to hosted export POST; `hosted-workspace.ts` returns blocked status; `apps/studio/src/Delivery.tsx` displays disabled Download Vega ZIP. No dedicated service, durable queue, worker-attributable real creator VPKG or authenticated ZIP path is evidenced on inspected GitHub `main` (`c2569e7`). User reported local R2 evidence not yet published to GitHub; reconcile before new edits.

VirtualDevice previously printed Ready, then returned `running:false`, `qemu:-1` and no stable device serial. This is an R4 device proof blocker, **not a reason to block software implementation**.

## Explicit owner architecture decision (supersedes previous R2)

**One existing VPS, two services, one existing PostgreSQL instance, one job at a time.** Creator requests through the signed-in API; a tiny durable queue stores immutable build input/job state; independently run systemd worker claims one job and executes the P7 source producer inside a disposable OS-isolated sandbox. Worker returns verified package metadata and private artifact; API converts/serves checked ZIP through owner-only route. No second VPS or separate network queue service.

Use on-host *process separation* for availability and a *genuinely restricted child execution identity* for untrusted creator source. The worker's own DB/queue credentials must never be readable by npm/native build scripts. Same host can be safe for this bounded workload only after verifying the actual sandbox limitations/credential and namespace boundaries, not merely because the subprocess runs as a nonroot user.

Prefer a separate additive `firelaunch_build` schema in the **same database instance**, without incrementing the existing `firelaunch_schema_migrations` beyond 14 or altering any existing tables/rights. This protects the 0.6.7/0.7.3 app rollback path. Distinct PG grants: API submits/reads owned jobs; worker claims/completes only queue records via least privilege; child has NO DB reachability or credentials. If retaining `firelaunch_build` schema requires special privileged DDL, stage SQL and precise operator review; do not blindly execute it.

A separate cryptographically signed cross-host receipt system is unnecessary when API and worker communicate through local DB and protected owner-scoped artifact storage. Still require hashes/package inspection, row ownership and immutable input/release checks. A worker does not gain authority over creator ownership merely by controlling a job row.

## Three remaining manual prompts

**R2:** queue schema/repository and worker supervisor + sandboxed build runner, one real VPKG if SDK/capacity provisioned, focused failure/restart/limits/security tests. **R3:** actual API lifecycle + secure download and Studio UI; reuse R2 and existing ZIP generator. **R4:** delta-only acceptance with small post-deploy UI smoke and new queue/export/VVD evidence. R1 closed. No more prompts for completed P7 P1-P3 or unaffected systems.

## Main risks / minimal controls

1. **Host capacity:** the existing VPS also runs FireLaunch/Ngest; read actual free RAM/swap/disk/CPU and Vega CLI/SDK install availability before allocating jobs, and cap concurrency at one. If the hardware cannot safely run one build, state real constraints rather than invent a second VPS.
2. **Privilege boundary:** no staging env, AWS/PG/SSH/socket/key access from native build child, no ambient inherited supervisor environment, bounded network including cloud metadata/private address denial, resource cgroup/CPU/RAM/PID/time and temporary filesystem. Confirm denied access and measured limits within actual build sandbox.
3. **Queue safety:** lease/heartbeat and restart recovery, atomic claim via `SELECT ... FOR UPDATE SKIP LOCKED`, creator input/release fingerprint, finite state transitions, one-job concurrency, idempotency and cancellation. Prevent duplicate builds from two workers.
4. **Artifact safety:** checked true x86_64 VPKG, private disk root and safe path names, ZIP/sha verification, TTL cleanup, ownership and stale authorization checks; avoid unbounded in-memory handling of artifacts.
5. **Rollback:** main application schema stays at 14. New queue schema is additive/isolated; worker can be disabled independently and old Studio can roll back without schema-version mismatch. New privilege grants/deploy changes require scoped operator approval.
6. **Proof discipline:** no assertion of live worker, downloadable ZIP, Studio Green for new export, or Vega playback until observed. Only touched systems need focused regression; R1/P6/P7 previously GREEN parts are reused.

**Assessment:** Revise manual R2/R3/R4 in place; keep current `c7-export-recovery`, version 0.7.3, R1 PASS and the P7 historical NOT GREEN record. Prior multi-server-host assumptions are superseded by owner decision 2026-10-20.

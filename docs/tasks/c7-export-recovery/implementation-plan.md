# c7-export-recovery — Manual implementation plan: PostgreSQL queue and one-VPS Vega worker

Owner decision: 2026-10-20, deadline Friday 2026-10-23 12:00 America/Chicago (CDT). Root package.json and both top-level lockfile version entries remain 0.7.3. These are manually executed correction prompts; do not invoke the Prompt Stack runner, auto-commit implementation, or replay P7 P1-P3.

## Current state and ordering

R1 is SCOPED GREEN ([evidence](R1-closeout.md)); don't rerun it. P7 P1-P3 source/fixture validation is already committed at 0.7.3. The missing deliverable is an actual owner-scoped build queue/worker and downloadable creator ZIP. Finish in two **manual** implementation prompts and one **manual** delta closeout:

| Step | Implementation slice | Exit |
| --- | --- | --- |
| [R2 / P2](P2-isolated-vega-worker.txt) | additive Postgres queue, dedicated on-VPS systemd worker, restricted per-job native build sandbox, verified VPKG output | one claimed/finished job and source tests; real creator VPKG if host/SDK available; list exact remaining activation prerequisites |
| [R3 / P3](P3-authenticated-zip-export.txt) | owner+CSRF API endpoints, queue integration, private artifact packaging/download and Studio status/Download button | valid owner ZIP end-to-end where worker is available; otherwise tested truthful blocked state |
| [R4 / P4](P4-independent-export-closeout.txt) | one safe on-host deployment and direct creator ZIP -> independent Vega VirtualDevice run | new integration/device gates PASS or NOT GREEN without retesting unaffected GREEN systems |

Keep 0.7.3 fixed, no `/activate`, no runner or automatic commits.

## Architecture and source seams

**Existing:** `apps/server/src/release-build.ts` has `ReleaseBuildInput`, `produceIsolatedRelease`, fixed `npm`/Vega/VPT commands and checked artifact evidence; `native-export.ts` builds/verifies the 4-entry ZIP; `hosted-workspace.ts` scopes owner snapshots; `api.ts` guards hosted `export-app`; `apps/studio/src/Delivery.tsx` renders status. Do not rewrite those if a narrow adapter suffices. Check actual local R2 source/evidence and Git status before editing; the local `P2-evidence.md` is not in inspected GitHub main.

**New:** an application-independent build worker entrypoint and package script, minimal `firelaunch_build` queue SQL and repository, example `firelaunch-build-worker.service` with separate least-privileged Linux identity and no application env, isolated per-job build launcher, private artifact output directory with restricted permissions and TTL. Worker's queue role never inherits app's Postgres/AWS credentials. The executable child runs without ANY worker supervisor credentials.

```text
Existing Studio/API auth+CSRF (firelaunch-staging.service)
  -> API INSERT immutable queued build input (owner/revision/deployment/release)
  -> separate schema firelaunch_build.jobs in EXISTING PostgreSQL instance
  -> dedicated firelaunch-build-worker.service polls+claims one row, heartbeat/lease
  -> disposable sandbox native npm/Vega build, no access to app/DB/AWS credentials
  -> verify x86_64 VPKG, store in private artifact path, job ready/hash
  -> API current-owner/revision recheck -> 4-entry ZIP -> streamed creator download
```

## R2: database queue and worker implementation

1. **Storage:** Add separate additive schema/table `firelaunch_build.jobs` via idempotent reviewed SQL/runbook. Keep core `firelaunch_schema_migrations` and schema-14 ceiling untouched; old 0.7.3 or 0.6.7 releases must remain deployable on the same app schema. If any change to core migration ledger or incompatible table is actually needed, explicitly stop for migration/rollback review. Queue row stores opaque job ID, verified owner/project/deployment/package/release/revision/fingerprint, immutable source snapshot or controlled reference, status, attempt/lease/heartbeat, error category, private artifact reference/hash, timestamps and expiry. Limit source size, bytes, concurrent jobs and retention.
2. **Claim:** one live build globally initially. Transactional claim `FOR UPDATE SKIP LOCKED` with unique live-job constraint or equivalent, optimistic status change, lease and bounded heartbeat; on worker restart requeue expired lease safely or fail deterministically, never produce two conflicting artifacts. Explicit finite retry and failure/cancel state transitions. Worker role has narrowly scoped queue permissions, not general catalog/session/data rights.
3. **Process:** independent systemd `firelaunch-build-worker.service` launched as a dedicated locked-down OS identity, not within `firelaunch-staging.service`. Parent reads queue input and writes result without giving its credentials to the build. Child runs in OS-enforced restricted sandbox (verified rootless container/namespaces/systemd controls depending on installed tools) with disposable job filesystem, no systemd/db/AWS/SSH secrets, no app credential/env, explicit restricted network/dependency sources, CPU/memory/PID/disk/time ceilings, safe termination and cleanup. Prove actual cgroup and denied access from the sandbox where possible. A mere separate process with inherited env is NOT acceptable.
4. **Build:** Reuse `materializeReleaseBuildInput`, `produceIsolatedRelease`, `RELEASE_BUILD_COMMAND`, pinned CLI/VPT validation, source fingerprint and package identity. Verify actual Node/npm/CLI/SDK versions on VPS; do not assume laptop binaries exist on muffinos. Measure host free RAM/disk/CPU; one active job and practical resource caps prevent disrupting Studio/Ngest. If the existing VPS cannot safely hold the SDK or limits, report facts and a minimal same-host adjustment needed; never invent a new VPS as the default.
5. **Artifact:** worker writes only to private bounded artifact root, stores SHA/size and verifies receipt via job status/queue permissions. Same-host worker/API do not need cross-server signing; never trust an unsigned client claim, user path, or unverified result. Tests: race double-claim, stop/restart lease, timeout, failure and cleanup, source/release mismatch, tampered ZIP/package, privilege denial, no credentials, unknown source paths. Fake worker tests not substitute for live VPKG.
6. **Deployment prep:** create reviewed host installation/rollback instructions for operator-approved worker service and additive schema; no automatic sudo, additional host, secrets or AWS. R2 may run nonlive local worker/sandbox tests; a live operator setup needs actual independent permission. Record real vs blocked status, not generic infrastructure demands.

## R3: authenticated API and Studio ZIP

1. Reuse existing owner/CSRF middleware, add minimal `POST /api/projects/:id/export-app` (idempotent job creation), `GET` status and owner-scoped `GET .../download` with opaque job reference. Do not allow arbitrary source, endpoint or shell commands in request. Verify owner/release/revision/fingerprint at submission, worker handoff, receipt and download; stale/revoked/foreign/expired objects denied.
2. On ready job, re-check `NativeBuildEvidence`, VPT ID and current source/release, then use `createNativeExport` and `verifyNativeExport`. Return a real VPKG, README, export-info and SHA256SUMS ZIP with bounded artifact memory/disk and meaningful content-type/disposition. Keep artifacts outside Studio/static web root; store privately with cleanup.
3. Wire Studio Build/Export App to truthful queue state, retry/cancel, download and session/project-switch safety. If worker capability isn't proven, show actual blocked reason; no fake Ready or fixture ZIP.
4. Focused tests only: two principals, unauthenticated+CSRF, duplicate/race/lease, stale/expired/revoked, mismatched job ownership, tampered package, ZIP hashes/headers, UI status/reload. Test affected API/Studio builds. Preserve R1 hashed-asset startup smoke as a quick regression only if frontend is modified.

## R4: delta-only manual final qualification

R1 already passed; do not re-run comprehensive login/blank-root causality investigation. Preserve original P7 P4 NOT GREEN closeout. If new deployment required, run only one newly authorized protected archive/DB/worker activation with verified backup, rollback compatibility and a **short actual signed-out + signed-in render sanity check**. No fresh paid encode; reuse unchanged release #1 hashes and permission. Directly observe a real job claimed/finished under measured sandbox limits, signed-in Studio ZIP download, exact VPKG SHA, fresh external extraction, stable graphical VVD serial/install/native published artwork and HLS **moving video and audible sound**, pause/resume/seek/Back/restart. If laptop audio unavailable, record it unverified. Run targeted checks of changed components, not unchanged full project matrices. Use a single appropriate broader aggregate **only if changed surfaces or a real failure warrants it**; do not automatically repeat historical P7 full test run.

R4 writes new correction `closeout.md` with per-gate status and links to reused R1/P6/P7 evidence, real queue/worker artifact hashes, protected rollout/rollback state and outstanding historical Q2 F7/P5/c5/Q3. Green only for directly observed new end-to-end behavior. Physical Fire TV/Appstore, paid access, automatic catalog synchronization, AWS infrastructure redesign all excluded.

## Constraints

No change to root or workspace versions. Manual prompts: no runner, no automatic agent commits, no reset/force pull. Operator review required for actual schema/install/systemd/host changes and protected deployment; creator approval required for any new content publication. Preserve schema 14, original release #1 and currently working Studio. Aim <=8 minutes per bounded source prompt, stop/record blocker by 15 minutes rather than expanding into new unrelated work.

# c7-export-recovery — P7 continuation: single-VPS native export

**Status:** [C7 final closeout PARTIAL / NOT GREEN](closeout.md) on 2026-10-20. [R1 Studio startup SCOPED GREEN](R1-closeout.md); R2 isolated native worker GREEN; R3 authenticated owner ZIP export SCOPED GREEN; R4 native Vega playback NOT GREEN because the installed app never completes its first approved HLS TS fragment and times out. P7 original [P4 closeout](../p7/closeout.md) remains NOT GREEN. Deadline Friday 2026-10-23 12:00 America/Chicago (CDT). Root package.json and both top-level lockfile version entries remain 0.7.3. Manual correction prompts only; no runner or agent commits.

## Current deployment / trusted evidence

At the 2026-10-20 23:39 UTC readback, protected 0.7.3 staging release `/srv/firelaunch/releases/20261020T233126Z-d375ee6f1709` and the separate worker were active with core schema 14. The approved release #1 pointer and HLS master retained their verified hashes. Owner job `job_ec7ec7a188b54a6095e214ecb9f20e30` produced a VPT-valid VPKG and downloadable four-file ZIP. The exact ZIP-extracted package installed on Vega VirtualDevice and showed creator branding/artwork after restart, but playback timed out at HLS segment request. See [final closeout](closeout.md) for current evidence; the earlier 22:02 R2 failure in [R2 evidence](R2-evidence.md) is preserved as historical.

The protected R1 release `20261020T185232Z-2b17f1479a0e` is recorded as having run Studio 0.7.3 with schema 14, authenticated and signed-out Home smoke passing and previous 0.6.7 release available for rollback. The old blank-root exception is historically UNPROVEN. The R1 closeout and source are committed on GitHub through `c2569e7`. **Reuse R1 PASS without rerunning its full qualification.** The early Vega VirtualDevice preflight still reported `running:false`, `qemu:-1` and no serial; this is an R4-only blocker.

The P7 [source/build contract](../../tasks/p7/P3-evidence.md) includes immutable creator/deployment/release source input, a checked native Vega x86_64 build command, native package verification, licensed Hls.js/MSE player and four-file ZIP validation. Its original P2 API/Studio reported `NATIVE_WORKER_UNAVAILABLE`; C7 has now connected those foundations to the separate worker and authenticated owner ZIP. This does not establish successful device playback.

[R2 bridge evidence](R2-bridge-evidence.md), [R2 final evidence](R2-evidence.md) and the [C7 closeout](closeout.md) distinguish the earlier failed jobs from the later ready native package and device result. Inspect actual local HEAD, dirty files and host readbacks before a later continuation; never replace completed local code blindly.

## LOCKED architecture: ONE existing VPS

```text
Creator Studio/API (existing firelaunch-staging.service on muffinos)
       | authenticated owner/CSRF, immutable source/release
       v
Existing PostgreSQL instance, separate additive firelaunch_build.jobs queue
       | one lease-based job at a time
       v
firelaunch-build-worker.service (separate process/service and OS identity)
       | per-job disposable restricted build sandbox; NO API/AWS/PG secrets
       v
Verified native x86_64 .vpkg + private ZIP artifact
       | owner-only download from existing API
       v
Studio Export App -> ZIP download -> independent Vega VirtualDevice
```

No second VPS, Redis, external queue broker, remote worker HTTP API, Kubernetes or cross-server signing service. The **worker supervisor** may hold a narrowly scoped queue role; the **untrusted build child** must have no access to it or to the staging app's credentials, service account, home directories, PostgreSQL socket or host filesystem. A different Node process without a tested OS restriction is not sufficient isolation. Use the lightest supported on-host sandbox (restricted service child / verified namespace/container) that actually enforces this boundary. A private artifact directory is explicitly outside the public web root.

**Queue migration compatibility:** Use an additive dedicated `firelaunch_build` schema/table(s) **within the existing Postgres instance**, separately versioned or idempotently installed, with least-privilege API and worker roles. Do **not** bump or invalidate the main app's schema-14 migration ledger: both current Studio 0.7.3 and the previous 0.6.7 rollback must continue to recognize schema 14. If an operator migration would break rollback, do not apply it. No automatic live database or systemd changes are authorized by prompt authoring.

## MANUAL implementation sequence (no runner)

| Step | Prompt | Deliverable / focused exit |
| --- | --- | --- |
| **R1** | [P1 Studio recovery](P1-studio-startup-recovery.txt) | **SCOPED GREEN; do not repeat** |
| **R2** | [P2 same-VPS queue + worker](P2-isolated-vega-worker.txt) | DB queue, service, isolated disposable build and real verified VPKG when SDK/host available; focused worker checks |
| **R3** | [P3 owner ZIP export](P3-authenticated-zip-export.txt) | authenticated submit/status/download and real verified ZIP through Studio, using the R2 queue/worker |
| **R4** | [P4 delta closeout](P4-independent-export-closeout.txt) | one new integrated worker/ZIP-to-actual-VVD proof; reuses unaffected green evidence |

All steps use GPT-6 Sol High manually. Target one bounded work unit (normally <=8 min, 15 min hard stop); if actual host provisioning/SDK access needs a separate operator privilege, state the exact blocker and continue only safe local implementation, never propose a new VPS by default. No `/activate` or runner command.

## R2 work boundaries

Use the existing P7 `ReleaseBuildInput`, `NativeBuildEvidence`, VPT validation, `createNativeExport`, `hosted-workspace` ownership and Postgres foundation. Implement worker queue/claim/lease/failure/recovery and a separate `firelaunch-build-worker.service`. Exactly one active build by default, measurable admission/resources, 15-minute timeout, per-job scratch/cleanup and no credentials in executable child. A queue table is not proof the worker has run; a source-built fixture is not proof the creator has exported.

## R3 work boundaries

Creator-only API job creation/status/cancel/download, CSRF on mutations, revision/release fingerprint and owner checks at submission, worker result acceptance and download. Private retention and TTL; no foreign/stale/revoked/expired ZIP access. Studio shows truthful states and download after exact VPKG+ZIP verification. If the on-host sandbox is unavailable, keep Export App blocked rather than executing user code with the API privileges.

## R4 delta acceptance — NO repeated broad gates

**Reuse without retesting if untouched:** R1 visible signed-out/signed-in/fresh-tab Studio and production assets, scoped Phase 6 private video pipeline, existing free release #1 pointer and HLS master hashes, P7 producer/ZIP/Hls.js focused tests, unrelated catalog/editor/agent/security suites. A *short* live Studio-render sanity check after any new deployment remains necessary to detect regressions from new assets.

**New direct proof only:** worker queue claim/finish/restart behavior and true process isolation, actual qualified native VPKG and owner ZIP, authenticated download/foreign denial, stable graphical Vega VirtualDevice serial, install of ZIP's exact VPKG, approved public artwork/HLS moving picture and audible sound plus pause/seek/Back/restart. R4 records PASS/NOT GREEN with exact evidence; it does not relabel historical Q2 F7, P5/c5 or the comprehensive p6 Q3 update/offline/rollback matrix.

Read [assessment](prompt-assessment.md), [plan](implementation-plan.md), [R1 closeout](R1-closeout.md), [staging runbook](../../../scripts/staging/README.md), [P7 P4 historical closeout](../p7/closeout.md), and the actual source/host evidence. No docs approval permits a new paid MediaConvert encode, new public creator release, CloudFront/IAM expansion, independent infrastructure provisioning, Ngest changes or unapproved staging deployment. Preserve release #1 bytes and current rollback.

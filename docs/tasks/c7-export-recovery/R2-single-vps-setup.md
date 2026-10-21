# R2 single-VPS worker setup review (host setup applied; build qualification open)

This is an operator-reviewed plan for **muffinos only**. The build worker is a separate unprivileged service and PostgreSQL role on the existing VPS. It does not change core migration 14, the live staging service, published release #1, Ngest, or AWS. Do not enable the unit until the checks below pass. The source currently leaves Studio export disabled.

## Database

Back up the existing database using the protected staging backup path and verify recovery before any DDL. As a database administrator, inspect `apps/server/migrations/build_queue_001.sql`, then apply it once to the existing database. It creates only `firelaunch_build.jobs` and indexes; `firelaunch_schema_migrations` must still report max version **14**. Rollback: stop the worker and disable export first, preserve artifacts/evidence as required, then `DROP SCHEMA firelaunch_build CASCADE` only after proving no pending jobs or required receipts remain. Do not use the core migration runner for this schema.

Create a dedicated `firelaunch-build` PostgreSQL login mapped by local peer authentication to the `firelaunch-build` OS account. Grant it `USAGE` on `firelaunch_build`, `SELECT` on `firelaunch_build.jobs`, and `UPDATE` only on `state, attempt, lease_token, lease_until, heartbeat_at, updated_at, error_code, artifact_name, artifact_sha256, artifact_bytes, evidence`. It needs **no rights on primary application tables**. Grant the existing API database role `USAGE` on the schema and `SELECT, INSERT, UPDATE` on jobs; the API must derive owner identity from the verified session and call `HostedWorkspaceService.releaseBuildInput`. Grant neither role schema creation, DDL, database superuser, or access to the other role's credentials. Verify the effective grants with `has_table_privilege` and `has_column_privilege`. A worker credential is never mounted into a build child. Use a UNIX socket DSN in `/etc/firelaunch-build/worker.env`; `PrivateNetwork=yes` denies TCP from the worker supervisor.

After inspecting the real API role, the operator can review grants equivalent to:

```sql
GRANT USAGE ON SCHEMA firelaunch_build TO "firelaunch-build", existing_api_role;
GRANT SELECT ON firelaunch_build.jobs TO "firelaunch-build";
GRANT UPDATE (state, attempt, lease_token, lease_until, heartbeat_at, updated_at,
  error_code, artifact_name, artifact_sha256, artifact_bytes, evidence)
  ON firelaunch_build.jobs TO "firelaunch-build";
GRANT SELECT, INSERT, UPDATE ON firelaunch_build.jobs TO existing_api_role;
```

`existing_api_role` is a placeholder; the inspected host API role is `firelaunch_staging`. Use the actual inspected role and verify no `PUBLIC` grants.

## Filesystem and runtime image

Install Node **24.21.0**, npm **12.2.0**, Vega CLI **1.4.4**, SDK **0.24.12112**, VPT and all libraries required by the pinned build in a reviewed, read-only runtime root at `/opt/firelaunch-build-runtime...`. The image must contain `/usr/bin/node`, `/usr/bin/npm`, `/usr/bin/vpt`, `/opt/vega/bin/vega`, `/opt/firelaunch-build-app/apps/server/dist/native-build-child.js` and its compiled imports, `/job`, `/artifact.vpkg`, `/proc`, `/dev`, `/tmp`, `/sys/fs/cgroup`, and `/opt/npm-cache` preloaded with all locked dependencies. Each sandbox copies that vetted cache into its quota-limited private job directory before offline npm commands. The version/identity check must run **inside** the image. No host `/srv`, `/home`, `/root`, `/run/postgresql`, AWS credentials, signing material, SSH sockets, or private media may be copied into it. Do not use an unreviewed copied host root filesystem as the image.

Provide a dedicated 1–20 GB filesystem, mounted at `/var/lib/firelaunch-build`, owned by `firelaunch-build`. A directory on the current 116 GB host root filesystem intentionally fails the worker's disk-bound check. Keep `/var/lib/firelaunch-build/jobs` mode 0700 and inaccessible to the API. For R3, a dedicated `firelaunch-export` group may traverse only the build root and `artifacts` directory (0750); the staging service receives this group as a supplementary group, while the worker uses it as its primary group. The worker writes artifact files mode 0640. No other group or public web root gets access. The child gets only its disposable job directory at `/job` and a read-only image root. The worker receives only the local queue DSN, storage root and runtime image path. Sample non-secret `worker.env` fields: `FIRELAUNCH_BUILD_DATABASE_URL=postgresql:///firelaunch_alpha_067?host=/var/run/postgresql&user=firelaunch-build`, `FIRELAUNCH_BUILD_STORAGE_ROOT=/var/lib/firelaunch-build`, `FIRELAUNCH_BUILD_RUNTIME_IMAGE=/opt/firelaunch-build-runtime-v1`. Inspect the actual database name before setting the DSN.

Install the trusted supervisor code and its Node 24 runtime at `/opt/firelaunch-build-app` for the example unit. This directory is read only to the worker; the creator-controlled build source is never placed there. Restrict the environment file to the service manager and worker identity.

Install `/usr/bin/bwrap` from the trusted OS repository. The child launcher uses a private user/PID/network/IPC/UTS namespace, read-only runtime image, no host network, minimal `/dev` and `/proc`, empty environment and no shell. Build dependencies must come from the offline cache. The child inherits the service's CPU, memory and task limits; the job filesystem enforces disk capacity. Check that the VPS kernel permits unprivileged user namespaces for the dedicated account. Test an actual running child from that account and inspect `/proc`, mountinfo, effective cgroup `cpu.max`/`memory.max`/`pids.max`, filesystem capacity, routes, DNS, `/run/postgresql`, staging paths and environment. `bwrap` being installed alone is not proof of isolation. A failed probe must leave the worker disabled.

## Service and acceptance

Review `scripts/staging/firelaunch-build-worker.service.example` for host-specific paths and `systemd-analyze security`; install it as an independent `firelaunch-build-worker.service` only with scoped operator approval. Use a dedicated `firelaunch-build` OS user with no login shell, sudo or staging group membership. Verify the service cgroup really caps 100% CPU, 2 GiB memory and 128 tasks, and that the mounted job filesystem is at most 20 GB. On a 3.8 GiB VPS, monitor the existing staging service while measuring a build; an OOM or slowdown is a failed qualification, not permission to lift limits silently.

The queue permits one running job globally; the example unit also holds an OS `flock` on the private worker filesystem so a second local supervisor cannot overlap a still-running child during lease recovery. Each claim has a 90-second lease, 15-second heartbeat and at most three attempts. A crashed service can reclaim only after lease expiry. Cancellation or a lost heartbeat kills its sandbox process group; no receipt is accepted afterward. Ready artifacts expire after 24 hours and the worker removes them by fixed opaque basename. Terminal row retention/deletion remains a reviewed API/operator task; the worker has no table `DELETE` grant. Review owner/account authorization and current published release at submission, result acceptance and download in R3. R3 should revalidate the VPKG hash and inspect package identity before ZIP creation. The browser must never receive an artifact path.

Before calling R2 green, capture a real creator-owned snapshot, child mount/egress/resource readbacks, fixed command and dependency cache evidence, fresh x86_64 VPKG bytes/SHA-256, independent post-build VPT `info`/`validate`, queue claim/lease/cleanup, and a staging health readback. No synthetic fixture qualifies that gate. R3 owns Studio ZIP integration. Rollback is to stop/disable only the worker, keep Studio export blocked, retain safe evidence, then follow the reviewed database and filesystem retention plan.

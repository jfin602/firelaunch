# C6 staging recovery qualification — NOT GREEN

Date: 2026-10-16. Repository HEAD `01069f0dedc7275136f88bbc9e2d0628ff5edf66`, root `0.6.7`, with pre-existing unrelated working-tree changes preserved. This report covers a safe preparation and isolated **database** rehearsal. It does not authorize the 0.5.8 → 0.6.7 live cutover. No live migration, service restart, systemd reload, Nginx change, AWS IAM change, media job or publication occurred.

## 1. Live staging architecture and state

- SSH as `deploy` to `muffinos` succeeded. `firelaunch-staging.service` is active as `deploy`, working in `/srv/firelaunch/current`, whose target is `/srv/firelaunch/releases/20261011T163833Z`, version `0.5.8`. Its Node is `/home/deploy/.nvm/versions/node/v24.15.0/bin/node`.
- PostgreSQL 16 is active on loopback port 5432. A read-only query of the service's database returned migration **10**, approximately 9.4 MB, one creator, two projects and **zero** `private_objects`. The database role `firelaunch_staging` cannot create databases. Its 0.5.8 migrations end at 010; candidate 0.6.7 has 011–013.
- Nginx terminates HTTPS for `firelaunch.jfin.dev` and proxies to `127.0.0.1:4184`. Local and public HTTPS unauthenticated `/api/auth/session` returned 401; the service remained active after backup. This is limited health evidence, not authenticated storage smoke coverage.
- The service environment is root-owned mode 0600 at `/etc/firelaunch/staging.env`. The AWS drop-in is root-owned, but `NeedDaemonReload=yes` and it is not loaded. The existing explicit S3 object credentials were preserved. `FIRELAUNCH_OBJECT_STORE=s3`; the bucket's `HeadBucket` returned HTTP 403, which could mean missing list permission and does not prove object-read failure or success. No S3 object was referenced by the current database, so object copy was not exercised.
- `/var/lib/firelaunch` is persistent and separate from the release path. The host had 75 GB free. `pg_dump`, `psql`, `pg_restore` and GPG are installed; no FireLaunch backup directory/timer existed under `/var/backups/firelaunch-staging`. The candidate package build uses Node 24/npm 12.
- The active release tree, releases directory and Node 24 binary are deploy-owned. A root script executing them would cross an unsafe privilege boundary. Current staging scripts now fail closed on that layout. `deploy` has interactive supervised sudo but no FireLaunch passwordless sudo; root SSH is unavailable.

## 2. Script changes and backup scope

- `deploy-release.sh` rejects **every schema-changing candidate**, including the supplied 0.6.7. This removes its former `--allow-schema-upgrade` path, which could take a live backup while writes continued and then leave only a schema-incompatible binary rollback.
- `backup.sh`, `backup-preflight.mjs` and `inspect-archive.mjs` provide a repeatable root-operator backup: check release/schema/configuration and estimated archive/disk capacity; create a new encrypted `.flrec` with the running release's CLI; decrypt and validate its database/object hashes; write mode-0600 SHA-256 and non-secret release/schema/size metadata. They refuse existing backup labels. `require_layout` now checks trusted executable/release ownership and links before privileged execution. The legacy timestamp-only 0.5.8 release name is accepted for compatible symlink rollback.
- Recovery v1 uses AES-256-GCM with the existing environment-held 32-byte key. It captures a PostgreSQL exported snapshot and each S3 object referenced by `private_objects`, validating SHA-256 and size. It does **not** currently prove S3 originals/delivery-bucket recovery for future schema-13 media, nor does a hot backup include writes accepted after its snapshot. A final cutover must quiesce the app and take a fresh backup before migration.
- An actual encrypted **preflight** archive was created under `/home/deploy/firelaunch-recovery/20261016T140030Z-schema10-preflight.flrec`, with directory mode 0700 and file mode 0600, without changing the service. It is 121,986 bytes; archive SHA-256 is `9741bdc7e463242fefbb4e59c180a7b0a1b522082051575bac0acddd66b87504`. Decryption and manifest validation passed: format `firelaunch-recovery-v1`, zero objects, database dump SHA-256 `a9fd3e7a05f7eb2daf2be7044a3649a59f90eb85292f8a5a830c6b0e4ee9336e`. This deploy-owned preflight archive is **not** the required root-owned, quiesced cutover backup. It was not deleted or overwritten.

## 3. Isolated restore, migration, and rollback evidence

A separate PostgreSQL 16 cluster was initialized locally under a private mode-0700 `/tmp` directory, with TCP disabled and a private Unix socket. The encrypted archive was decrypted on the VPS; only its verified database dump crossed the SSH stream into the isolated cluster. No database secret, recovery key, or plaintext dump was written to the repository or report. The temporary cluster and data were stopped and removed after the rehearsal.

| Check | Result |
| --- | --- |
| Restore original backup into isolated database | PASS: migration 10, 10 migration rows |
| Run copied live 0.5.8 repository against restored data | PASS: 1 creator, 2 projects, 0 private objects |
| Apply candidate 0.6.7 migrations 11–13 in isolation | PASS: migration 13 in 126 ms; creator/project counts preserved |
| Run 0.5.8 against schema 13 | PASS: rejected as incompatible |
| Re-restore original archive to a fresh isolated database | PASS: schema 10, old repository reopened; core project row hash matched the migrated copy |
| Recovery time | 4 seconds for the second local database restore and old repository connection; excludes object transfer, VPS database swap, application startup, traffic drain and validation |
| Isolated object restore and authenticated HTTP/storage smoke | **NOT RUN**: source had zero referenced objects; no separate private S3 restore bucket or isolated service configuration was available |

The database restore was real, but full application/object-storage rollback is **not qualified**. The production `ops restore` command requires a disposable `firelaunch_restore_*` database and separate private bucket, and the current staging database role cannot create that database.

## 4. Validation

- `npm run check` with Node 24/npm 12: PASS, including typecheck, production builds and repository tests. The real Postgres recovery integration test in that suite was **SKIPPED** because its dedicated test environment was absent; the separate real-data database rehearsal above was performed instead.
- Production release packaging: PASS; generator runtime import succeeded and the final package contained the new staging scripts. Artifact: `/tmp/firelaunch-c6-staging-recovery-candidate-final.tar.gz`; SHA-256 `206139e9d7e5521cc370e8ddd213fbdbf1ba69c615441a176c776e5cf5e0bc11`. Any later source edit requires a new build/hash. This is local packaging evidence, not a deployed release.
- Focused staging tests: PASS, 4/4, including schema ceiling/gap, schema-incompatible rollback, release links and traversal rejection. A direct invocation also confirmed that `--allow-schema-upgrade` is rejected before privileged actions. Shell syntax and Node syntax checks: PASS. ShellCheck was unavailable. `git diff --check`: PASS.
- Current staging remains on 0.5.8/schema 10 and its local/public unauthenticated health checks still returned 401. No real candidate service or object-store smoke test was run.

## 5. Required privileged operations and cutover plan

The next operator must use **interactive supervised sudo**. Do not add blanket passwordless sudo or enable root SSH. Before any root execution, review and install the scripts in a root-owned, non-writable operator directory; establish a root-owned Node 24 binary and root-owned release tree, update and validate only the staging unit path under a separate approved maintenance action, and rerun script checks. The current guards intentionally reject the live deploy-owned layout.

The following is the necessary order for an **unimplemented live cutover**, not permission to execute it:

1. Obtain explicit operator approval for the exact candidate hash, maintenance window, reversible DB/object strategy and downtime/data-loss boundary. Check live schema 10 and authenticated API/storage health. Confirm the intended AWS services remain paused/disabled.
2. Prepare a separate private restore bucket with proven access and an operator-controlled disposable database path. Rehearse the complete archive restore, object hashes, 0.5.8 and 0.6.7 HTTP/storage checks, and a schema-10 recovery on staging-equivalent data. Record timing and failure threshold.
3. Announce/drain the maintenance window. Stop only `firelaunch-staging.service`, prevent other writers, and take a **new** root-owned encrypted database/object backup. Verify archive decryption, hashes, release/schema metadata and free space while the service is stopped. Do not accept writes after this point until the recovery choice is settled.
4. Apply migrations 11–13 with the candidate against the live database **only after** the above proof and explicit approval; select a versioned root-owned 0.6.7 release atomically, reload the reviewed unit, restart only the staging service and qualify authenticated creator/project/object operations and local/public HTTPS. Do not invoke MediaConvert, Bedrock or publication.
5. If any migration/health/storage check fails or exceeds the approved threshold, keep the service stopped. Restore the original encrypted archive to a **new** database and separate object destination; verify schema 10, counts, hashes and 0.5.8 behavior; then perform an operator-reviewed database/object cutover and reactivate the old binary. A symlink-only rollback across schema 13 is forbidden.

Expected downtime starts at step 3 and ends only after step 4 or completed step 5. Its upper bound cannot be stated from the 4-second local DB-only test; object transfer, VPS privilege/database swap and authenticated service tests are unmeasured. The restore point is the final quiesced backup. Any writes accepted after that snapshot would be lost on rollback, so the service must remain quiesced until go/no-go.

### Exact commands currently safe to stage or run

```bash
# Build workstation, after validation; record the printed independent hash.
PATH=/tmp/firelaunch-npm12-preflight/node_modules/.bin:$PATH bash scripts/staging/build-release.sh /tmp/firelaunch-c6-staging-recovery-candidate-final.tar.gz

# Supervised VPS operator, only after securing root-owned runtime/release paths:
sudo /opt/firelaunch-staging-ops/backup.sh "$(date -u +%Y%m%dT%H%M%SZ)-precutover"

# The current candidate command is intentionally rejected before activation:
sudo /opt/firelaunch-staging-ops/deploy-release.sh /home/deploy/firelaunch-incoming/release.tar.gz EXPECTED_SHA256

# Binary-only rollback is valid only when the live schema is at or below the
# previous binary's migration ceiling; schema 13 -> 0.5.8 is rejected:
sudo /opt/firelaunch-staging-ops/rollback.sh
```

There is **no approved executable 10→13 live cutover or full VPS database/object rollback command yet**. Inventing one before the isolated S3/application rehearsal and operator-reviewed DB cutover would risk live staging data. The cutover threshold, restored database ownership/rename procedure, separate object destination and service wiring must be made concrete and rehearsed first.

## 6. Blockers and recommendation

**NOT GREEN.** Database-only backup/restore/migration/return-to-schema-10 passed, but a real isolated private-object restore and both releases' authenticated service checks did not. The current VPS role cannot create the restore database, no separate private object bucket is available, and root-owned executable paths plus supervised operator preparation remain outstanding. The candidate 0.6.7 is not deployed; the live service remains available on 0.5.8/schema 10. Independent AWS IAM correction does not change this disposition. Obtain the missing isolated storage/database and root-operation prerequisites, then complete the full rehearsal and approve a concrete cutover/rollback procedure before changing live schema.

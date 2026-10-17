# C6 staging recovery qualification — GREEN (isolated gates only)

## 2026-10-16 AWS synthetic S3 follow-up

The client-owned S3 recovery leg and the one-time developer cleanup have now completed for two approved 69-byte synthetic objects. The returned client archive passed integrity/hash checks, and `muffinos` produced two source current-key delete markers without version-targeted deletion. The app role returned 403 for both destination current keys after the client had already delete-marked them; this does **not** independently prove denial of a present current object. Full AWS object-bearing archive restoration, real Google/HTTPS candidate testing, timed service rollback and live cutover remain open. The bounded evidence, exact version IDs, access-check interpretation and shortest remaining path are recorded in [the cutover qualification](../c6-staging-cutover/qualification.md) and its evidence files. The isolated recovery preparation result below is unchanged; no 0.6.7 deployment, migration or restart occurred in this follow-up.

---

## 2026-10-16 staging recovery iteration (current disposition)

The earlier database backup/restore and migration evidence below remains valid. This iteration completed the **isolated private-object and authenticated-service rehearsals** and the supervised privileged host preparation. The three requested **recovery preparation gates are GREEN in their bounded, isolated scope**. This does not qualify or authorize live cutover. No live service, release link, unit, database schema, staging object store, IAM policy or Nginx configuration was changed. The live service remained on 0.5.8/schema 10 with PID `486903` and `/srv/firelaunch/current` still targeting `/srv/firelaunch/releases/20261011T163833Z` at the final read-only check. Repository HEAD at this iteration was `7bf2c332bf9169246c3139c7c2c2c8791e091b22`, with the staging helper edits listed below left in the working tree; the 0.6.7 application modules are unchanged.

### 1. Private-object restore evidence

- A read-only fresh PostgreSQL custom-format snapshot of the live schema-10 database (SHA-256 `18ca90be4cb45300ac84299a23bf35469d435ae298ff560583602d9a2051a02e`) was streamed into a private local rehearsal area. Its baseline was one creator, two projects and **zero** private objects. The temporary plaintext dump was removed after the rehearsal; no fixture record or object was created on live staging.
- On the restored local copy, two synthetic owners and two synthetic private objects were created through the 0.5.8 repository and S3 storage implementation: one PDF evidence object and one PNG media object. The source and restore targets were separate private local MinIO buckets, `firelaunch-source` and `firelaunch-restore`, on loopback only. Database `object_key`, content type, byte size and SHA-256 matched the original bytes.
- The 0.5.8 AES-256-GCM `FLREC1` archive included both objects and the database snapshot. The format and object metadata were independently read by 0.6.7; plaintext fixture bytes did not appear in the ciphertext. The final in-memory archive's database-dump digest was `f788cced918a85a0dd9646e65c47d52849ce14972bdcb4334d5585276006d6ad`. Restore into a new database and separate bucket reproduced both checksums. The archive was ephemeral rehearsal material, not a new live backup or retained recovery point.
- Missing source bytes and altered source bytes both caused backup failure. Tampered archive ciphertext failed inspection. A destination that returned corrupted bytes caused restore failure, removal of the partially written objects, and removal of the disposable database. Repeating a successful restore to the same destination was rejected; the existing restored objects retained their checksums.
- A separate real CLI test, `FIRELAUNCH_LOCAL_S3_TEST=1 ... local-s3-recovery.test.ts`, passed against local PostgreSQL and private MinIO buckets. This complements the versioned-module rehearsal with the product `ops backup`/`ops restore` entrypoint. The test cleans its fixture databases and objects.

These are **synthetic object** results using the current S3 API implementation and recovery format. The real staging database had no referenced objects, so this does **not** prove access to the client AWS private bucket, real customer-object restoration, or future schema-13 media originals/delivery recovery. The existing encrypted schema-10 preflight archive described below remains the only actual live-data archive and has zero object payloads.

### 2. Authenticated service and migration results

Four isolated loopback HTTP server instances were started from copied versioned release modules, each with its own disposable database and private storage destination. A local OIDC fixture signed RS256 ID tokens; each instance exercised the release's **real verifier, callback, account mapping, session, CSRF guard, API routes and private-object capability path**. No session was injected and no caller-supplied owner ID was trusted. Fixture endpoints, credentials, storage and ports were separate from live staging. The production `index.js` Google configuration and a real Google account were not exercised.

| Instance | Database/storage | Authenticated result | Health/compatibility |
| --- | --- | --- | --- |
| 0.5.8 source | Restored live schema 10 plus synthetic objects / source MinIO | PASS | PASS, migration 10 |
| 0.5.8 recovered | Encrypted-archive restore to new schema 10 / restore MinIO | PASS | PASS, migration 10 |
| 0.6.7 candidate | Same recovered data migrated to schema 13 / restore MinIO | PASS | PASS, migration 13 |
| 0.5.8 rollback | Fresh independent archive restore to schema 10 / isolated private filesystem backend | PASS | PASS, migration 10 |

At each phase: signed login and session returned 200; owner project read, object metadata and byte-exact capability download succeeded; anonymous requests returned 401; foreign project/object/capability requests returned 404; missing capability returned 404; invalid CSRF returned 403. The product health function reported database and object-store `ok` at the appropriate migration ceiling. The rollback phase restored the fixture-bearing **schema-10 encrypted archive**, not merely the original zero-object live snapshot. The earlier 0.5.8/schema-13 rejection and separate database-only migration/rollback results below are preserved.

The test provider proves the authentication implementation under signed OIDC. It does not qualify real Google callback registration, HTTPS secure-cookie behavior, the live S3 bucket, or the exact production `index.js` wiring. Those remain release/hosting gates rather than simulated successes.

### 3. Privileged release preparation

Read-only host inspection found `/srv/firelaunch/releases` and its live 0.5.8 tree owned by `deploy`; the active Node 24.15.0 binary is under deploy's writable home. `/etc/firelaunch/staging.env` remains root:root mode 0600. The staging service has `ProtectSystem=strict`, runs as `deploy`, and still points at that existing binary. `sudo -l` shows supervised interactive sudo for `deploy`, but no passwordless permission to restart `firelaunch-staging.service`; a noninteractive restart authorization probe was rejected **before execution**. The unit still reports `NeedDaemonReload=yes`. Root SSH was not changed.

`scripts/staging/lib.sh` now requires a root-owned Node path, `/opt/firelaunch-staging-runtime/node24/bin/node`. New `scripts/staging/prepare-privileged.sh` is a bounded operator preparation step: it verifies the exact candidate and Node hashes, active PID/link and protected environment; stages root-owned copies of the old and candidate releases under `/srv/firelaunch/recovery-prep`; installs reviewed helpers under `/opt/firelaunch-staging-ops`; creates a root-only backup directory; and checks ownership, permissions, links and version. It does not switch `/srv/firelaunch/current`, change the unit or restart the service. `build-release.sh` excludes this operator-only script from the runtime package, avoiding a circular artifact hash.

The reviewed package and preparation script are present in deploy-owned `/home/deploy/firelaunch-incoming` with mode 0600. Their independent hashes are:

| Item | SHA-256 |
| --- | --- |
| 0.6.7 prepared package | `672450904c2ae959dbaf4e0c59a0c5ee2014ff066e9e0817ac6b146691453289` |
| supervised preparation script | `c29c4288d0d39287e93144cf09ef358e8cd9a7bfcdb8c280f8fdbe6fe2f3cb12` |

The corrected supervised run **passed**. The operator command checked the script hash before and after installing it in the root-owned operator directory, then reported: `Prepared root-owned runtime, two release copies, operator and backup directories. Live PID and release link unchanged.` The script validated both release copies' owner, file modes, contained links, version and required files before reporting success. Independent read-only host checks confirmed root-owned `/opt/firelaunch-staging-ops` mode 0700, `/opt/firelaunch-staging-runtime/node24/bin/node` mode 0755, `/srv/firelaunch/recovery-prep` mode 0700, `/var/backups/firelaunch-staging` mode 0700, and the unchanged PID/link. The root-only directory contents cannot be enumerated by unprivileged `deploy`; the supervised script's own checks are the direct evidence for those contents. No passwordless sudo or root SSH was added.

The live `/srv/firelaunch/releases` and active 0.5.8 tree remain deploy-owned by design until a separately approved, quiesced cutover. The unit still uses the old deploy-owned Node path and reports `NeedDaemonReload=yes`; the protected environment remains root:root mode 0600 and was never printed or copied. These changes are intentionally **not** part of this no-live-modification qualification. The reviewed candidate and rollback copies are secured in the root-only preparation directory. Backup archives use unique labels, mode 0600, 30-day retention metadata and no overwrite; no scheduled rotation/deletion or actual quiesced cutover backup has been performed. Atomic link changes, rejection of unsafe paths, schema-incompatible binary rollback and safe preparation failure passed focused tests. Supervised sudo was demonstrated by the successful preparation run, but no live restart/switch was attempted.

The owner's first sudo attempt used the superseded `ce66515e…` script hash and failed its **first** checksum check. Subsequent read-only inspection confirmed the staged script's actual `380f994b…` hash, no root-owned preparation paths created, and the same live service PID/release link. That failed attempt is not preparation evidence.

The next supervised run reached `Prepared release contains writable code`. Investigation found that `find -perm /022` treated safe root-owned symbolic links as writable because Unix link mode displays `0777`; the temp copy was removed by the failure trap. The new predicate still rejects non-root link ownership, checks link targets stay inside the release, and rejects group/other writable regular files/directories. A focused link-mode regression test passed. This is the second bounded preparation repair; the root-owned directories/runtime created before the failure remain and were read-only verified.

The following single bounded command was **executed successfully** by the owner from the `deploy` shell on muffinos. It is retained as evidence; do not rerun it against already staged release destinations:

```bash
sudo /bin/bash -c 'set -euo pipefail; f=/home/deploy/firelaunch-incoming/prepare-privileged.sh; h=c29c4288d0d39287e93144cf09ef358e8cd9a7bfcdb8c280f8fdbe6fe2f3cb12; test "$(sha256sum "$f" | cut -d " " -f1)" = "$h"; install -D -o root -g root -m 0700 "$f" /opt/firelaunch-staging-ops/prepare-privileged.sh; test "$(sha256sum /opt/firelaunch-staging-ops/prepare-privileged.sh | cut -d " " -f1)" = "$h"; exec /opt/firelaunch-staging-ops/prepare-privileged.sh /home/deploy/firelaunch-incoming/firelaunch-c6-staging-recovery-candidate-prepared-v3.tar.gz'
```

### 4. Validation and safe cutover boundary

- Focused release tests: 6/6 PASS, including the root-owned Node path and link-mode assertions. Shell syntax validation and `git diff --check`: PASS. The packaged 0.6.7 runtime import: PASS. Local S3/CLI recovery integration: 1/1 PASS. The versioned HTTP/object rehearsal above: PASS. The prior full `npm run check`, schema migration and packaging results below remain valid for unchanged application code; the new shell helper changes were checked with focused tests and a fresh package build.
- The earlier live preflight `.flrec` remains encrypted, checked and untouched; its archive hash, database digest and object count are recorded below. The fresh read-only dump used for this rehearsal is not a replacement for a root-owned, quiesced final backup. No stored backup or credential was deleted.
- **Safe cutover, after separate approval only:** (1) receive the supervised preparation result and review the root-owned copies and hashes; (2) establish the exact root-owned `/srv/firelaunch/releases` layout and update the staging unit to the prepared Node path in an approved maintenance window; (3) prove a disposable database/private-bucket restore using operator credentials and record a maximum downtime threshold; (4) drain writes and stop only `firelaunch-staging.service`; (5) create and verify a new root-owned encrypted backup while quiesced, and keep writers stopped; (6) migrate live schema 10→13 only after that go/no-go; (7) atomically select the reviewed 0.6.7 release, reload/restart only the staging unit and verify authenticated API/object and HTTPS health; (8) if any check fails, keep writes stopped, restore the final archive to a **new** database and separate private object destination, verify schema 10 and hashes with 0.5.8, make an operator-reviewed database/storage endpoint cutover, then restart the old binary. Never use a binary-only schema-13→0.5.8 symlink rollback. The current `deploy-release.sh` correctly rejects schema-changing candidates, so this is a human-controlled plan, **not** an executable cutover authorization.

**Remaining limitations / disposition:** Gates 1, 2 and 3 passed for the explicitly requested **isolated fixture and no-live-modification preparation scope**. Real Google/HTTPS staging identity, client AWS object recovery, root-owned quiesced cutover backup, actual service restart, operational rollback and the wider release gates are still open. **GREEN for C6 isolated recovery preparation; live cutover remains NOT QUALIFIED and is stopped.** No 0.6.7 deployment or live schema migration occurred.

---

## Earlier preflight and database-only rehearsal (historical NOT GREEN evidence preserved)

The following earlier findings describe the state before the isolated object, HTTP and privileged-preparation work above. They are preserved as recorded; their earlier `NOT GREEN` recommendation is historical and does not describe the bounded current disposition.

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

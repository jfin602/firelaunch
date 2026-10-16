# muffinos staging release workflow

Status: **recovery qualification NOT GREEN; no rollout authorized**. These scripts replace the obsolete PM2 `/srv/firelaunch-staging` path. They target only `firelaunch-staging.service` on muffinos. Production and other PM2/systemd services are outside this workflow.

## Verified layout (2026-10-16)

- `firelaunch.jfin.dev` terminates HTTPS in the `firelaunch-staging` Nginx site and proxies to `127.0.0.1:4184`; unauthenticated `/api/auth/session` returns `401`.
- `firelaunch-staging.service` runs as `deploy`, with `WorkingDirectory=/srv/firelaunch/current` and Node `/home/deploy/.nvm/versions/node/v24.15.0/bin/node`. `ProtectSystem=strict` and `ReadWritePaths=/var/lib/firelaunch` are active. The root-owned `/etc/firelaunch/staging.env` is mode `0600`.
- `/srv/firelaunch/current` points to `/srv/firelaunch/releases/20261011T163833Z`, version `0.5.8`; `/srv/firelaunch-staging` is absent. The old PM2 deployment scripts targeted a nonexistent tree and port `4175`.
- The active release tree, `/srv/firelaunch/releases`, and Node 24 binary under `/home/deploy/.nvm` are deploy-owned. Privileged scripts must not execute that writable code as root. `require_layout` now rejects this state. A supervised operator must prepare a root-owned Node 24 runtime and secure the release tree, review ownership and update the staging unit/runtime path before privileged deployment. Do not change the live unit in this qualification task.
- The VPS app process still has `FIRELAUNCH_OBJECT_ACCESS_KEY_ID` and `FIRELAUNCH_OBJECT_SECRET_ACCESS_KEY`. Those explicit credentials serve existing private object storage; the new AWS SDK profile must not replace or remove them. `/var/lib/firelaunch` is separate persistent storage; the hosted database was at migration `10` at preflight.
- `/etc/systemd/system/firelaunch-staging.service.d/aws.conf` exists, root owned, but systemd reported `NeedDaemonReload=yes`; the drop-in is not loaded in the running unit. Its `AWS_PROFILE` and `AWS_CONFIG_FILE` apply only to this unit after an authorized reload/restart.
- No FireLaunch-specific backup timer was observed. Do not treat unrelated system backups as FireLaunch recovery proof.

## Before any rollout

1. Finish the three-layer source-identity IAM correction in [the client handoff](../../docs/tasks/c6-aws-integration-contracts/source-identity-client-handoff.md). Test the live publisher role hop from the VPS service user and retain direct app-role delivery-write denial. Keep MediaConvert PAUSED, EventBridge completion DISABLED, CloudFront DISABLED and Bedrock disabled.
2. Review the root-owned staging environment **without printing values**. Add only verified media resource IDs and `FIRELAUNCH_MEDIA_PUBLISHER_ROLE_ARN`; preserve the two existing private-object credentials. Confirm the intended service-only AWS drop-in and no production unit changes.
3. Rehearse the encrypted PostgreSQL-plus-private-object archive on a **separate disposable database and separate private object bucket**. Record a successful restore, object hashes, isolated 0.5.8 and 0.6.7 application checks, and restoration back to schema 10. The current 0.5.8 binary accepts schema versions through 10; the 0.6.7 candidate has migrations 11–13. `deploy-release.sh` now refuses **all schema-changing releases**, including `--allow-schema-upgrade`. This gate must remain until an independently rehearsed, operator-approved quiesce/backup/migration/cutover/rollback procedure exists.
4. Confirm Node 24/npm 12, focused/aggregate tests, production builds, artifact SHA-256, exact source commit and clean release contents. Inspect the archive and its included staging scripts. The `.sha256` companion is an integrity check; the operator must also enter the independently recorded build hash.
5. Ensure an authorized VPS operator can run the audited scripts as root after securing the executable paths above. The current `deploy` SSH account does **not** have passwordless sudo for FireLaunch; root SSH is unavailable. Interactive supervised sudo is available, but no unattended deployment is possible until this access path is arranged. Do not loosen global sudo or alter unrelated services.

## Controlled release

On the build workstation, run `build-release.sh /absolute/path/release.tar.gz` after the tests. Record the SHA-256 printed by the build. Copy the archive and `.sha256` file to `/home/deploy/firelaunch-incoming/` on muffinos. Separately install the reviewed staging scripts into a root-owned operator directory, or run the reviewed repository copies from a trusted root-owned checkout. Do not execute scripts from a deploy-writable directory as root without independent review.

The root operator may run `backup.sh YYYYMMDDTHHMMSSZ-label` on muffinos after installing the reviewed scripts. It checks schema, archive capacity and disk space, then writes a fresh mode-0600 AES-256-GCM recovery archive under `/var/backups/firelaunch-staging/`. The archive covers a PostgreSQL snapshot and every S3 object referenced by `private_objects`; it decrypts and checks the manifest and writes a checksum plus non-secret release/schema/size metadata. Existing backups are never overwritten. A hot backup is a point-in-time snapshot; final cutover needs quiescence and a new backup.

The root operator can run `deploy-release.sh /home/deploy/firelaunch-incoming/release.tar.gz EXPECTED_SHA256` **only for a schema-compatible release**. It verifies the exact unit/layout, root-only environment, artifact contents, existing health and independent hash, creates a verified backup, then atomically switches `/srv/firelaunch/current`, reloads systemd and restarts **only** `firelaunch-staging.service`. It records `/srv/firelaunch/previous` after successful health checks. The 0.6.7 candidate is intentionally rejected because its migration ceiling is 13.

After activation, inspect `systemctl status firelaunch-staging.service`, the two `401` health responses, authenticated creator storage functionality, runtime AWS STS identity and publisher assumption. Check logs for IAM failures without printing environment values or signed URLs. Do not submit jobs, publish media or enable disabled AWS services in this rollout.

## Rollback

For a schema-compatible bad release, run the reviewed `rollback.sh` as root on muffinos. It checks the live schema against the previous binary's migration ceiling, switches the symlink atomically, restarts only the staging unit and requires local/HTTPS health. If the previous binary fails, it restores the original symlink and restarts it. The symlink and schema guards are exercised in `scripts/staging/test/deployment.test.mjs`; a real service rollback has **not** been performed.

For a 10-to-13 migration failure, **do not run a binary-only rollback**. Keep the staging service stopped. Verify the encrypted pre-deployment archive and use the separately rehearsed database/object recovery procedure to restore schema 10 in an isolated destination, verify ownership and object hashes, then perform an operator-approved database cutover and start the 0.5.8 binary. The repository `ops restore` command intentionally restores only into a disposable `firelaunch_restore_*` database; it does not replace the live database. Until that cutover has been designed and rehearsed on staging-equivalent data, the schema-upgrade deployment remains blocked. The current staging role cannot create a disposable database, and no separate private object bucket was supplied.

No backup or rollback was executed on the live VPS while preparing this workflow. Existing secrets, database, Nginx routing and other services remain untouched.

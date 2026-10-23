# VegaLaunch staging operator workflow

The canonical application endpoint is `https://vegalaunch.jfin.dev`. The active application service, protected release tree, environment file, database ledger and native worker use VegaLaunch names. Historical operator notes are preserved in [the dated archive](../../docs/tasks/rebrand-vegalaunch/staging-history-2026-10-23.md).

Build and test a source commit before packaging it. Use `build-release.sh` with the active Studio `index.html` to retain the bounded cache asset window. Verify the archive SHA-256 independently, upload it to `/home/deploy/vegalaunch-incoming/`, and invoke the root-owned `/opt/vegalaunch-staging-ops/deploy-release.sh` with that exact SHA-256. The installed standing sudoers rule permits this guarded deploy and `/opt/vegalaunch-staging-ops/rollback.sh` only. The operator script checks the root-owned release, matching schema, environment, health, and an encrypted backup before switching the release pointer.

The one-time schema-15 naming cutover requires the separately rehearsed `rename-database-objects.up.sql` transaction and its reverse script. An old binary needs the reverse transaction, prior environment and service identity, and the original release tree; the normal compatible-release rollback cannot cross that naming cutover. The protected pre-cutover archive and original 0.9.4 release must remain available until the new service is qualified.

The client separately manages live S3 CORS. This workflow never overwrites the live bucket CORS rule or changes the public FREE release #1 pointer.

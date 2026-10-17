# muffinos staging release workflow

## Live layout (verified 2026-10-17)

- `https://firelaunch.jfin.dev` serves the Studio build from `/srv/firelaunch/current/apps/studio/dist`. Nginx proxies `/api/` to `127.0.0.1:4184`.
- The only active FireLaunch application is `firelaunch-staging.service`. It runs as `deploy` with root-owned Node 24 at `/opt/firelaunch-staging-runtime/node24/bin/node`, a root-owned release tree and `/etc/firelaunch/staging.env` (root mode `0600`). The systemd AWS drop-in selects the `firelaunch-staging-app` profile.
- `/srv/firelaunch/current` points to `/srv/firelaunch/releases/20261017T012123Z-96a7a631f956`, version `0.6.7`. The reviewed upload-UI archive has SHA-256 `96a7a631f9569ac0d3446be0cfadad677d41a0f5c409a422729123462b76c049`.
- The application uses `firelaunch_alpha_067` at schema 13. The old `firelaunch_staging` database is retained with connections disabled. It must stay offline unless an operator explicitly restores the retired installation.
- `firelaunch-alpha-067.service` (port 4185) is stopped and disabled. Its 0.6.7 release and protected environment remain for manual recovery. The older 0.5.8 release `/srv/firelaunch/releases/20261011T163833Z` and schema-10 database also remain offline. Do not use the 0.5.8 binary against schema 13.
- The private-object store uses the named AWS profile and the client originals bucket. Browser multipart uploads use the same private originals bucket. Its S3 CORS rule permits PUT from `https://firelaunch.jfin.dev` and exposes `ETag`. MediaConvert is paused, EventBridge processing disabled and CloudFront delivery disabled. Upload completion is private and awaits later source verification/processing; it is not publication.

## Recovery copies

- Pre-cutover hot database dumps for both databases are under `/home/deploy/firelaunch-backups/` on muffinos and `/home/jfin/.local/share/firelaunch-backups/20261017/` on the workstation. They were checked with `pg_restore` and SHA-256. At the time, the two installations had identical creator/project/catalog records and no private-object or media-asset rows.
- Original root-owned units, Nginx site and environments are under `/var/backups/firelaunch-staging/20261017T012142Z-upload-consolidation/` (mode `0700`; secret files mode `0600`). Do not print or copy their values into Git.
- A post-cutover encrypted schema-13 archive is `/var/backups/firelaunch-staging/20261017T013100Z-postcutover-schema-13.flrec`, SHA-256 `6bd44ce4c764eb833e4f45161ed6dcda3161f7c862feb2f1117b41212d01013c`; a mode-`0600` copy is in the workstation backup directory above. The archive validates its database and referenced `private_objects`. The disposable direct-upload video original remains in private S3 and is outside this archive format.

## Subsequent releases

The reviewed operator scripts are installed as root-owned files at `/opt/firelaunch-staging-ops/` on muffinos. Build an archive with `build-release.sh`, record its SHA-256 independently, copy the archive and `.sha256` companion to `/home/deploy/firelaunch-incoming/`, and run `deploy-release.sh` from the protected operator directory with the independently recorded hash. It accepts only schema-compatible releases, verifies the protected layout and HTTPS health, makes an encrypted backup, then switches `/srv/firelaunch/current` atomically. The scripts must not run from a deploy-writable checkout.

For a schema-compatible bad release, `rollback.sh` uses `/srv/firelaunch/previous` after a later successful scripted deployment. The 2026-10-17 consolidation was a manual switch and has no scripted `previous` target. To recover this cutover, stop `firelaunch-staging.service`, restore the backed-up Nginx site, reload Nginx, and start `firelaunch-alpha-067.service` on port 4185 against the same schema-13 database; confirm authenticated Studio and catalog behavior before routing traffic. Keep the schema-10 service/database offline. Never try a binary-only rollback from schema 13 to 0.5.8.

The backup helper currently archives the database and `private_objects`, not managed-video originals. Protect and verify those S3 objects separately before any future media recovery or destructive storage change. Do not infer production or playback qualification from this staging upload deployment.

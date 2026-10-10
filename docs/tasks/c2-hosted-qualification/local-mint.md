# Local Linux Mint hosted qualification

This is a local development candidate for c2. It uses real Google authorization-code/PKCE login, a user-owned PostgreSQL 16 cluster, and a real MinIO S3 API. It does not change the original P2 or c2 NOT GREEN closeouts. Production still requires HTTPS for the public origin and all remote object endpoints.

## One-time setup

1. Install the repository's Node 24/npm 12 dependencies with `npm ci`. Install PostgreSQL 16 client/server tools (`initdb`, `pg_ctl`, `pg_dump`, `pg_restore`), `curl`, and Go 1.24 or newer. `npm run hosted:local:minio` downloads a pinned MinIO source archive, verifies SHA-256, and builds a local executable. The executable, source and Go build cache stay outside Git. An existing trusted MinIO binary can be selected with `MINIO_BIN=/absolute/path/to/minio` instead.
2. Run `npm run hosted:local:setup`. It creates only `.codex-runs/c2-local/` and `.env.c2-local` (mode 0600), starts a PostgreSQL cluster on loopback port 55437 and MinIO on loopback port 9000, creates `firelaunch_c2_source`, and creates the private `firelaunch-source` and `firelaunch-restore` buckets. The restore database is deliberately absent until the CLI creates a disposable `firelaunch_restore_*` database. Setup is safe to rerun with its existing local state; it does not overwrite databases or the generated environment file. The existing system PostgreSQL cluster is left untouched. The generated file contains random local database, MinIO, KMS and recovery secrets; never copy it to Git or support output.
3. In [Google Auth Platform](https://support.google.com/cloud/answer/15548748?hl=en), configure a project and consent screen. Create a **Web application** OAuth client in [Clients](https://support.google.com/cloud/answer/15549257?hl=en). Register authorized JavaScript origin `http://127.0.0.1:4173` and **exact** redirect URI `http://127.0.0.1:4173/api/auth/callback`. Google's [web server OAuth guide](https://developers.google.com/identity/protocols/oauth2/web-server) documents the authorization-code flow and exact redirect matching. If the app is in Testing, add two separate, consented real Google accounts as [test users](https://support.google.com/cloud/answer/15549945?hl=en). Enter the resulting client ID and secret only in `.env.c2-local`, in `FIRELAUNCH_OIDC_CLIENT_ID` and `FIRELAUNCH_OIDC_CLIENT_SECRET`. Do not send them in chat or put them in a shell command.
4. Run `npm run hosted:local:check`, then `npm run hosted:local:start`. Open `http://127.0.0.1:4173/` in a normal browser. Use two separate browser profiles to sign in with the approved accounts. The Vite `/api` proxy retains the browser Host; the Google callback and Studio cookies stay on port 4173. Keep the chosen hostname identical through login, callback and Studio use. To use `localhost` instead, change the local public origin to `http://localhost:4173`, register its corresponding origin and callback in Google, and ensure Vite listens on that loopback name. Avoid switching between hostnames within one session because host-only cookies will not follow.

The local launcher validates the Google variables before opening Studio. It prints the exact redirect URI. It never supplies a mock hosted identity. The Google client, consent configuration and two account logins are manual owner steps; Codex cannot create or authorize those accounts.

## Storage and recovery proof

`npm run hosted:local:check` probes PostgreSQL, both buckets and anonymous denial. The MinIO process is bound to `127.0.0.1`, uses random local credentials and a local KMS secret, and starts with no public bucket policies. The FireLaunch `S3PrivateObjectStore` still sends SSE-S3 requests. The HTTP exception applies only when `FIRELAUNCH_LOCAL_HOSTED=1`, `NODE_ENV=development` and the endpoint is exact loopback; remote or production endpoints require HTTPS.

Run the repeatable S3 and real CLI drill with:

```sh
FIRELAUNCH_LOCAL_S3_TEST=1 node --env-file=.env.c2-local --import tsx --test apps/server/test/local-s3-recovery.test.ts
```

The drill creates a separate disposable source database, writes a private object through `S3PrivateObjectStore`, runs the actual `operations-cli.ts` `health`, `backup`, and `restore` commands, verifies the archive checksum and restored object bytes/revision/owner denial, then removes its test object and databases. It checks that source and restore buckets differ and that the source object remains unchanged. Its synthetic storage-drill identity does **not** count as a Google login or c2 live isolation evidence.

For an owner-operated recovery drill on real test-account data, use the [P2 recovery runbook](../p2/recovery-runbook.md). Run `node --env-file=.env.c2-local --import tsx apps/server/src/operations-cli.ts health`, then `backup --out <restricted-path> --retain-days 1`, then `restore --in <restricted-path>`. Restore requires its new disposable database name and the distinct restore bucket. Do not reuse an existing database or store a recovery archive in Git. Verify restored owner reads and private bytes before claiming G3 PASS.

## Qualification boundary

The local environment removes the need for a VPS, public TLS endpoint or paid object service for this c2 development run. The live identity gate remains **BLOCKED** until two authorized real Google accounts complete login in separate profiles and the cross-account browser/API matrix is recorded. The storage drill proves S3 and the recovery CLI, but its synthetic account is not live identity evidence. Production deployment still needs reviewed TLS, persistent backups and proper secrets management.

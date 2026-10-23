# VegaLaunch naming and compatibility audit

VegaLaunch is the product name in Studio, browser metadata, generated Vega app titles, source trees, and new export metadata. Version remains `0.9.4`.

The installed staging system predates the product rename. Its technical identifiers stay in place because renaming them would require a separate infrastructure or data migration. In particular:

| Legacy identifier | Locations | Reason retained |
| --- | --- | --- |
| `FIRELAUNCH_*` environment keys | `apps/server/src`, `packages/agent/src`, `.env*.example`, `scripts/local-hosted.mjs`, `scripts/staging` | The protected host and worker environments still supply these keys. Changing source readers would prevent startup, OIDC, media, backup, or native export. |
| `__Host-firelaunch_session` and state cookies | `apps/server/src/auth/sessions.ts` | Preserves existing browser sessions and the Google callback flow. |
| `firelaunch_schema_migrations`, `firelaunch_build.jobs`, SQL function names | `apps/server/src/hosted-repository.ts`, `apps/server/src/native-build-queue.ts`, `apps/server/migrations`, staging schema checks | These are installed PostgreSQL objects and the existing migration ledger; a source-only rename would create a second ledger or lose the worker queue. |
| `firelaunch-vega-build-input-v1`, worker claim/receipt formats, recovery and account archive formats | `apps/server/src/release-build.ts`, `apps/server/src/native-worker-protocol.ts`, `apps/server/src/recovery.ts`, operations scripts | Queued jobs, receipts, and encrypted backups may predate the rename. Existing readers and signatures must remain compatible. |
| `@firelaunch:lkg:v1` and `firelaunch-video-page:` | Vega remote release template and `apps/studio/src/video-pages.ts` | Stable client storage keys preserve the last verified TV release and unsaved Studio draft edits. |
| `firelaunch:kind` and `firelaunchIntent` metadata | `apps/server/src/catalog-feed.ts`, `apps/server/src/media-convert-provider.ts` | Existing creator feeds and MediaConvert jobs use these keys. |
| `firelaunch` service, profile, path, bucket, domain, and public package IDs | `scripts/staging`, `infra/aws/staging`, installed host configuration and saved deployments | Existing Nginx, OIDC redirect, AWS resources, source paths, and installed app identities remain in service. No infrastructure migration was authorized. |
| Historical occurrences | `docs/tasks`, dated roadmap/current-state sections, decisions, earlier closeouts, and Git history | Preserve evidence and references as originally recorded. |

New source exports use `vegalaunch-source-export-v1`; the materializer still accepts the prior format. New native ZIP metadata uses `vegalaunch-vega-export-v1`. Existing deployed package IDs remain bound to their saved channel deployments. The generator only assigns a VegaLaunch package ID to a new, unbound channel.

The product rename does not authorize a new public release, DNS/OIDC change, service rename, AWS policy update, database migration, or installed-app update.

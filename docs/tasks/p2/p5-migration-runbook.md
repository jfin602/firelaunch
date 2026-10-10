# P5 local P0 import and source export

The operator selects a verified creator account ID from `creator_accounts` and a local P0 data root. The importer is CLI-only; no hosted API request can select a destination account or adopt a local directory. Use a database backup before applying. Local originals are read-only.

```bash
FIRELAUNCH_DATABASE_URL=postgresql://... npm run migration:p0 -- --data-root /absolute/path/to/.firelaunch-data --creator-account cr_0123456789abcdef0123456789abcdef
```

This defaults to dry run and reports each project as `ready`, `already-imported`, `collision`, or `error`. Review changed file names, excluded build/dependency/submission outputs, destination account, and rights before applying the same command with `--apply`. Apply writes the project, ownership, optional generated text source and baseline hashes, fingerprint marker, and per-project audit in one Postgres transaction. A repeated apply of the same local snapshot is idempotent, including concurrent attempts. A changed local snapshot or another account's identical channel ID is a collision; there is no automatic merge or reassignment. Failed apply attempts and collisions produce a redacted audit event where the destination account exists.

The importer rejects symlinks, unsafe IDs/paths, malformed ChannelSpec, missing generation baselines, non-UTF-8 or binary generated files, oversized source, and previously successful build artifacts. Recover those projects manually with their original files intact. `node_modules`, generated build output, failed build records, and submission bundle output are not imported and are explicitly listed as excluded. Hosted builds remain disabled. A legacy VPKG is never represented as a hosted verified build. No Amazon source, artwork, media, playback, or product license is inferred by import.

An authenticated owner can download `GET /api/projects/{id}/code/export`. The JSON contains every hosted source text file and a SHA-256 for each file. Save the response as `source.json`, then verify and materialize an ordinary standalone Vega project:

```bash
node scripts/materialize-source-export.mjs source.json /path/to/empty-output-directory
```

The materializer checks the format, project ID, revision, paths, size limits, complete file inventory, and every digest before writing. It refuses a nonempty or symlink destination. The export does not include private media/evidence, server secrets, Amazon credentials, generated build artifacts, or a rights grant. The hashes verify file integrity against the downloaded manifest; the JSON is not a signed provenance statement.

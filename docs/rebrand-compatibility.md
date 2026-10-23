# VegaLaunch rename migration audit

The previous compatibility exception for FireLaunch technical identifiers is retired. New source, cookies, environment keys, database objects, worker protocol, recovery archives, and generated projects use VegaLaunch names. Version remains `0.9.4`. The database rename is an explicit schema-15 transaction with a reverse script in `scripts/staging/rename-database-objects.{up,down}.sql`; it was rehearsed on a copy of staging data before live use.

## Deliberate reads of existing data

These old strings are read only to preserve existing records. They are not aliases for creating new branded output.

| Existing data | Migration behavior |
| --- | --- |
| Encrypted `firelaunch-recovery-v1` and account-export proofs | New writes use VegaLaunch formats. Readers still accept intact historical archives and proofs. |
| MediaConvert `firelaunchIntent` and `firelaunchProfile` job metadata | New jobs write VegaLaunch keys. Recovery reads metadata already attached to AWS jobs. |
| Imported `_firelaunch_kind` and `firelaunch:kind` | New feed metadata uses VegaLaunch keys. Existing external catalog records remain readable. |
| Browser `firelaunch-video-page:` draft key and `@firelaunch:lkg:v1` TV cache key | Existing local values are copied to new keys on read. New writes use VegaLaunch keys. |
| `__Host-firelaunch_session` browser cookie | A successful new login clears this cookie. Sessions are process-local, so a service restart requires login regardless of the cookie rename. |

## External and historical identity

AWS bucket names, IAM role ARNs, MediaConvert queue and EventBridge resources, old installed Vega package IDs, and signed client certificates are physical external identities. They require a separately verified resource and client migration. Do not edit these strings in persisted records, opaque object keys, or CloudFormation parameters by text replacement. The current public FREE release #1 pointer must retain its original bytes. Any remaining active external identity is a **NOT GREEN** rename blocker and must be enumerated in the final closeout.

The exact `firelaunch.jfin.dev` application DNS record was removed on 2026-10-23. `tv.firelaunch.jfin.dev` is a separate public resolver record used by already installed clients; retiring it requires a compatible client update and verified pointer migration. Immutable Git history, dated closeouts, inactive archived releases and genuine creator-authored names are historical evidence, not application branding. Generated test fixtures and saved generated source should be migrated only after their provenance and bound package identity are verified.

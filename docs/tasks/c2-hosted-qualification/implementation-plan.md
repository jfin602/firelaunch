# c2-hosted-qualification — 5-cycle qualification and repair plan

Status: ready for manual browser qualification after owner checks in the separate P2 P7 0.2.7 closeout
Version invariant: exactly `0.2.7` throughout (root package.json and root package-lock.json). Do not alter workspace versions.
Candidate baseline: implementation HEAD `eb881a9a9b1102ab3931cf1538b46bcdc838af9e`; final correction starting HEAD must be captured **after** the owner commits the P7 closeout.

## Preflight / hard prerequisites (before cycle 1)

1. Read `docs/tasks/p2/closeout.md` **from the actual local checkout**, its test logs and original NOT GREEN gates. Confirm explicit 0.2.7 committed baseline and clean tree, record exact HEAD (don't assume eb881... is the new baseline).
2. Read `apps/server/src/auth/config.ts`, `auth/oidc.ts`, `auth/sessions.ts`, `api.ts`, `hosted-repository.ts`, `hosted-workspace.ts`, `private-objects.ts`, `recovery.ts`, `operations-cli.ts`, `docs/tasks/p2/recovery-runbook.md` and relevant tests. Inspect live configs for **presence/validity only**.
3. Require a user-controlled Google OAuth client and two independently authenticated permitted real creator accounts; configured HTTPS public origin, matching callback redirect URI, valid TLS, least-privileged session browser profiles. Use the existing Google live OIDC verifier, not a mock/fake/test-header issuer. If unavailable, G1 is BLOCKED. Do not request/store password or OAuth client secret in the correction output.
4. Require a real Postgres 16 (or compatible version), a private S3-compatible source bucket and a **distinct** private restore bucket reachable through the S3 API; valid TLS for custom endpoints. Require a third, disposable empty database for restore; do not point at production. Bucket names/credentials are not stored in repo.
5. Capture network controls and consent for authorized account login, limited negative testing, backup/restore, database and bucket provisioning, and cleanup. Do not touch production accounts or buckets without explicit owner authorization. Use isolated staging wherever possible.

If prerequisites are missing, still test independently provisioned evidence gates where safe, then stop BLOCKED/NOT GREEN with a precise owner action. Never start a purposeless five-round loop to solve external identity/approval by editing code.

## Six acceptance gates

| ID | Gate | Direct evidence required |
| --- | --- | --- |
| G0 | Baseline / environment | unchanged 0.2.7, clean preflight HEAD, Node/npm, real issuer/HTTPS readiness, genuine S3 and DB identities (redacted) |
| G1 | Live OIDC | both separate creator accounts successfully login via real Google OIDC, callback/PKCE/session/cookie/CSRF/logout/expiry checks |
| G2 | Tenant/security | A and B each authorized for own projects but denied list/read/update/mutate/agent/status/code/file/export/generate/build/readiness/bundle/deployments/private assets of the other; no cross-owner resource existence leak or build execution |
| G3 | S3 recovery | fresh private source and different restore bucket, source SQL+private-object archive checksummed/encrypted, successful restore into distinct disposable DB/bucket, verified content hash, revision, object read, owner isolation, source untouched, failed-write cleanup |
| G4 | Browser / regressions | two profile Studio session switch/logout, project create/edit, Preview & remote navigation, reload/restart persistence, source export, no regression of local legacy ChannelSpec or protected code |
| G5 | Final validation | focused repaired checks, one root `npm run check`, `npm run codex:stack:validate -- c2-hosted-qualification`, `git diff --check`, exact counts/versions/worktree/HEAD, closeout evidence |

Original P7's local Studio and filesystem-storage tests are context only. G1 and G3 require live qualification on the **same integrated hosted candidate** used for G2/G4.

## Five-cycle algorithm (maximum, not mandatory)

For cycle N = 1 through 5:
- **Qualify:** capture starting HEAD/diff and current gate matrix, attempt all available real gates, store sanitized command/browser details and result in `qualification-loop/cycle-N.md`; name direct defect, environmental blocker and already-passing evidence distinctly.
- **Triage:** external missing OAuth account/client/redirect or private S3 resources are BLOCKED and require owner action; do **not** change authentication/production safeguards to evade them. A reproducible source/config bug in G1–G4 may be repaired if bounded, with regression tests. No speculative feature work.
- **Repair:** make only the minimal source/config/runbook change directly explaining a failing observed check. No architecture rewrites, P3/P4/P5/P6/P7 features, identity test bypass or unsafe endpoint. Keep all changes uncommitted; capture changed files and exact focused test counts.
- **Requalify:** rerun the failed gate(s) on the repaired hosted candidate and targeted cross-tenant/CSRF/secret leakage negatives. A passing focused unit test alone is **not** a G1 or G3 pass. Where earlier evidence invalidated by code changes, rerun it.
- **Decide:** if all G0–G5 PASS, stop early GREEN; if a hard external prerequisite cannot be provisioned, stop with BLOCKED/NOT GREEN (log fewer than 5 executed cycles); otherwise carry forward the smallest known repair to the next cycle, up to 5. Never reset user files or silently discard improvements.

Suggested priority if a round cannot exercise every gate: cycle 1 live identity and S3 preflight, cycle 2 source/restore integration, cycle 3 tenant attacks, cycle 4 browser/recovery regressions, cycle 5 final converged repeat. These are **triage emphases only**; they do not turn one passing gate into acceptance of the others. Each completed cycle updates the entire gate matrix.

## Evidence naming

`qualification-loop/README.md`: sanitized environment, candidate SHA and evidence methodology.
`qualification-loop/cycle-1.md` ... `cycle-5.md`: write only files for cycles actually executed (not blank templates), with start/final SHA, short diff summary, commands/exit statuses, observed browser steps, gate results, defects and repairs.
`closeout.md`: disposition GREEN / QUALIFIED or BLOCKED / NOT GREEN, cycles used, all gates with direct source/location and limitations, final HEAD/root version, root test results, corrections awaiting owner commit, security controls, and P3 handoff.

Keep raw logs/screenshots only in restricted ignored `.codex-runs/c2-hosted-qualification/` or a designated secure external evidence store; no login email, OAuth cookie/token, secret keys, database passwords, private object paths or bucket credentials. Public docs may include hashes, counts and redacted aliases.

## Do not rewrite historical qualification

Do not alter `docs/tasks/p2/closeout.md` to GREEN. Its P7 NOT GREEN outcome is historically true. The bounded correction adds new evidence at the same 0.2.7 version. No unrelated `c0` or P0 historical closeout reclassification.

# Correction 2 / P1 hosted qualification — BLOCKED / NOT GREEN

Date: 2026-10-10. **One of five allowed qualification cycles attempted.** Candidate HEAD `cd64347bd60db65f4d898c5021981909e447e0e8`; root version `0.2.7` throughout. The starting worktree was clean, and the original P2 P7 version and NOT GREEN closeout were independently committed before this run. This closeout makes no commit and does not change historical P2 P7, P0/P7 or c0 dispositions.

## Gate disposition

| Gate | Result | Evidence and limitation |
| --- | --- | --- |
| G0 baseline/environment | BLOCKED | Version/HEAD preflight passed. No configured HTTPS deployment, live Google OIDC client, two approved real creator identities, S3 source/restore buckets, scoped object credentials, recovery key or disposable restore DB. Loopback PostgreSQL was listening, but no c2 database connection was configured. Owner confirmed the external setup is unavailable for this run. |
| G1 live OIDC | BLOCKED | Zero real Google logins, provider callbacks, sessions or cookie/CSRF/PKCE/state/nonce/expiry probes. No fixture identities were substituted. |
| G2 tenant isolation | NOT TESTED | No authenticated A/B browser or HTTP sessions, so no current positive-owner or foreign-denial matrix. The prior P2 P7 fixture route results are baseline context only. |
| G3 S3-backed recovery | BLOCKED | No source/restore S3 API calls, `ops health`, encrypted backup, cross-bucket restore, archive checksum or restored owner/object verification. The earlier filesystem-store drill is baseline context only. |
| G4 hosted Studio | NOT TESTED | The in-app browser had no hosted target; the usual local Studio port refused connection. No live two-profile editing, Preview, restart, signout, source export or code-override check was possible. |
| G5 final validation | BLOCKED | Stack grammar validator and `git diff --check` passed. One complete root check passed typechecks and builds with 175/179 tests passing and four Postgres-dependent skips, zero failures. No source repair was made; focused repaired-path test count is 0. This cannot complete the hosted acceptance matrix. |

## Independent observations

- Node `v24.21.0`; PATH npm `11.19.0` was below the declared npm 12 range, so the one root check used npm `12.2.0`. Seven workspace typechecks and seven builds passed. Kernel 63 pass/4 skip, Studio 8/8, runner 104/104: **175 pass, 4 skip, 0 fail**. The skipped kernel cases cover real PostgreSQL ownership/restart, importer, private objects and recovery.
- `npm run codex:stack:validate -- c2-hosted-qualification` exited 0 and reported VALID. `git diff --check` exited 0. Restricted ignored logs are `.codex-runs/c2-hosted-qualification/root-check.log` (SHA-256 `f08c1b80b30eea5eb792506e4ff15f61c4d5ec0748e4f24cb0d3eaed08b8b828`) and `stack-validate.log` (SHA-256 `24ac4ee42144c6fb0af00f001bc50c227d872133bdc2c1526fd470785a68a84d`).
- Browser target inventory found no existing tabs; an in-app attempt to open `http://127.0.0.1:4173/` returned `net::ERR_CONNECTION_REFUSED`. This is availability evidence only, not a hosted Studio test.
- Original P2 P7 reported 179/179 aggregate and 10/10 focused fixture/PostgreSQL passes. Those results were on its earlier candidate and do not replace current real OIDC or S3 evidence. No email address, token, credential, object key, database URL or private media was recorded here.

## Worktree and next action

Only `docs/tasks/c2-hosted-qualification/qualification-loop/README.md`, `cycle-1.md` and this closeout were added. There were **no source repairs**, no manual Git commits and no version change. The detailed gate trace is [cycle 1](qualification-loop/cycle-1.md).

To resume qualification, the owner must supply an approved HTTPS staging target with a configured Google OAuth client/callback, two distinct consented test accounts, a scoped private S3 source bucket and **different** restore bucket, a disposable source/restore PostgreSQL pair and recovery configuration accessible to the operator without placing secrets in chat or Git. Then run a fresh c2 qualification cycle on that integrated candidate, including live A/B isolation, cross-bucket recovery, hosted Studio and final checks. Do not relabel this blocked run GREEN.

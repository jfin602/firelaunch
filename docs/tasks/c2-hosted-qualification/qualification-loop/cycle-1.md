# Cycle 1 — environment preflight and independent checks

Start: 2026-10-10 19:15 UTC. Candidate HEAD `cd64347bd60db65f4d898c5021981909e447e0e8`; root version `0.2.7`; working tree clean before this record. The P2 P7 NOT GREEN closeout and version are independently committed in this HEAD.

## Starting gate matrix

| Gate | Start | Basis |
| --- | --- | --- |
| G0 baseline/environment | BLOCKED | Committed version and clean Git state pass; required external identity and two-bucket staging environment not configured. |
| G1 real Google OIDC | BLOCKED | No configured client, HTTPS target or two authorized creator identities. |
| G2 cross-account isolation | NOT TESTED | Requires G1 authenticated A/B on the hosted candidate. |
| G3 genuine S3 recovery | BLOCKED | No configured source/restore buckets, scoped credentials or disposable restore database. |
| G4 hosted Studio regression | NOT TESTED | No hosted target or two live sessions. |
| G5 final validation | NOT TESTED | Independent local checks pending. |

## Results

- Preflight: `git rev-parse HEAD` returned the starting SHA; root package version is `0.2.7`, and the original tree was clean. The committed P2 P7 closeout is historical **NOT GREEN**. The correction starts with only this cycle's documentation changes. `pg_isready` reported a listening PostgreSQL service on loopback, but neither source nor disposable restore database was configured for this task.
- Configuration presence: `FIRELAUNCH_MODE`, public origin, OIDC client ID/secret, hosted and operations database URLs, source/restore bucket configuration, S3 credentials and recovery key were all absent in this process. Values were neither read nor printed. The owner confirmed there is no approved HTTPS staging deployment with two real authorized identities and distinct S3 buckets available for this run.
- Browser: the in-app browser had no existing tabs. Opening the usual local Studio address `http://127.0.0.1:4173/` returned `net::ERR_CONNECTION_REFUSED`. This is only target-availability evidence; no hosted login or Studio workflow occurred.
- Source inspection: Google-only hosted issuer, HTTPS callback, session/CSRF checks, owner-scoped repository and private-object access, S3 adapter, separate restore bucket guard, recovery implementation and hosted build block were inspected. No defect was demonstrated by a live failing gate, so no source code was edited.
- `npm run codex:stack:validate -- c2-hosted-qualification`: exit 0, prompt grammar VALID, unchanged `0.2.7`; restricted log SHA-256 `24ac4ee42144c6fb0af00f001bc50c227d872133bdc2c1526fd470785a68a84d`.
- One complete root check using supported npm 12.2.0 (`npx --yes npm@12.2.0 run check`): exit 0; seven workspace typechecks and seven builds passed. Tests: kernel 63 pass/4 skip/0 fail, Studio 8 pass/0 skip/0 fail, runner 104 pass/0 skip/0 fail; **175 pass, 4 skip, 0 fail out of 179**. The four skipped tests require a configured PostgreSQL test database and cover ownership/restart, importer, private objects and recovery. Restricted log SHA-256 `f08c1b80b30eea5eb792506e4ff15f61c4d5ec0748e4f24cb0d3eaed08b8b828`.
- Focused repaired-path tests: 0 run; there was no observed source defect or repair. Original P2 P7's 10/10 focused passes are historical only. `git diff --check` passed on the documentation worktree.

## Ending gate matrix

| Gate | End | Direct limit |
| --- | --- | --- |
| G0 baseline/environment | BLOCKED | Committed version/HEAD pass, but no approved real OIDC and two-bucket recovery environment. |
| G1 real Google OIDC | BLOCKED | No live client/target or two test accounts; zero browser logins. |
| G2 cross-account isolation | NOT TESTED | Zero authenticated A/B owner or foreign requests on a hosted candidate. |
| G3 genuine S3 recovery | BLOCKED | Zero S3 API, health, backup or restore operations; no two buckets or restore DB. |
| G4 hosted Studio regression | NOT TESTED | No reachable hosted target or two live browser sessions. |
| G5 final validation | BLOCKED | Stack validator, aggregate typecheck/build and diff check passed; four DB integration tests skipped, and the full hosted gate matrix cannot be finalized. |

Cycle decision: **stop after 1/5** on confirmed external prerequisites. No code repair, no commit and no HEAD/version change. Do not count the original 179/179 P2 P7 or 10/10 focused results as current proof.

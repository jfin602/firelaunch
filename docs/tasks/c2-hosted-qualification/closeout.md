# Correction 2 / P1 hosted qualification — BLOCKED / NOT GREEN

Date: 2026-10-10. **Two of five allowed cycles attempted.** Final candidate HEAD `eada42fbe2ef5ce70e44c0683d9a4b1671dfa9e3`; root version `0.2.7` unchanged. Original P2 P7 NOT GREEN and cycle 1 were committed before this run. Cycle 2 made no source repair, commit or HEAD movement. Historical P2 P7, P0/P7 and c0 dispositions remain unchanged.

## Gate disposition

| Gate | Result | Direct evidence and limit |
| --- | --- | --- |
| G0 baseline/environment | BLOCKED | Local PostgreSQL 16, real Google client settings and two private distinct MinIO S3 buckets were ready. Callback and S3 endpoint were HTTP loopback, not approved HTTPS staging. Only one browser profile was available. |
| G1 real Google OIDC | PARTIAL | Two approved account aliases completed real Google login and logout sequentially. No simultaneous separated profiles, HTTPS secure-cookie observation or complete replay/forged/expired/state/nonce/PKCE negative matrix. |
| G2 tenant isolation | PARTIAL | Both owners created separate hosted projects; B's initial list was empty and foreign Studio project selection reverted to B's own project. Three spoofed-header unauthenticated probes returned 401. The full live positive/negative API, deployment and private capability matrix was not completed. |
| G3 S3-backed recovery | PARTIAL | Genuine local MinIO S3 API and owner-data `ops health`/backup/restore passed with separate buckets and disposable database, archive and SQL/object hashes, two account records, protected source edit, owner/foreign checks and unchanged source bytes. The endpoint was HTTP loopback; failed-write cleanup was not exercised on an HTTPS staging backend. |
| G4 hosted Studio | PARTIAL | Account A edited Design, opened Content, used Preview remote detail/Back, reloaded revision 9, generated/edited source with regeneration protection and saw hosted Build blocked. Account B created a separate project. Two-profile, server restart, portable export and complete session-expiration checks remain. |
| G5 final validation | PARTIAL | Focused security/recovery **10/10** and separate local S3 **1/1** passed. One root check passed **181**, skipped **1**, failed **0** of **182** tests; seven typechecks and seven builds passed. Stack validation and `git diff --check` passed. Hard external gates remain incomplete. |

## Evidence and limits

[Cycle 1](qualification-loop/cycle-1.md) recorded the unavailable starting environment at HEAD `cd64347bd60db65f4d898c5021981909e447e0e8`. [Cycle 2](qualification-loop/cycle-2.md) records current browser, PostgreSQL, S3 and validation observations with exact log/archive SHA-256 values. Raw logs and the encrypted 0600 recovery archive are ignored under `.codex-runs/c2-hosted-qualification/`. The source test object and disposable restore resources remain only in the local test environment for inspection. No credentials, account emails, tokens, database URLs, object keys or private media are in these documents.

Account A's initial create attempt returned a CSRF error; an identical retry after reload succeeded, and no repeatable source defect was established. The browser exposed one profile and blocked direct API navigation before a live foreign request could be observed. Fixture auth and tenant tests in the root suite do not replace the live route matrix. The local MinIO drill used the explicit loopback HTTP development exception; it does not prove HTTPS staging. Original P2 P7's 179/179 aggregate and 10/10 focused results are baseline context only.

## Next action

Provide an approved HTTPS staging origin with matching Google callback, two isolated browser profiles for the approved accounts, private HTTPS S3-compatible source and different restore buckets, and a disposable restore database. Repeat the complete G1/G2/G4 browser and HTTP matrix and G3 recovery/failed-write cleanup on one final candidate, then rerun G5. Preserve BLOCKED / NOT GREEN until every gate passes. No source repairs await commit; these c2 evidence documents are the only tracked worktree changes.

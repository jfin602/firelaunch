# Phase 3 — P2/c2 deferred security qualification

Status: OPEN / NOT QUALIFIED (2026-10-10)
Inherited evidence: [P2 P7 NOT GREEN](../p2/closeout.md), [c2 BLOCKED / NOT GREEN](../c2-hosted-qualification/closeout.md), [c2 cycle 2](../c2-hosted-qualification/qualification-loop/cycle-2.md)
Source baseline: P2 `0.2.7`; P3 activated at `0.3.0`

## Existing qualified subresults (not full gate success)

- Two authorized real Google accounts each completed login/logout in **one sequential browser profile**, and isolated lists/projects were observed. This is not simultaneously separated session proof.
- Actual local MinIO S3 API + PostgreSQL cross-bucket restore passed, including source and restored data hashes and owner denial on the tested local HTTP environment. This is not an HTTPS S3 staging drill.
- P2/c2 targeted security tests (10/10), local S3 test (1/1), and root aggregate (181 passes, 1 skipped, 0 failures at c2 cycle 2) passed on their candidate. A separately skipped external integration check remains a skip, not a pass.
- Studio local/hosted project edits, Preview navigation, reload and protected source overrides were observed; hosted restart/export and full live foreign route matrix remained open.

## Gate ownership and acceptance

| Gate | Required evidence | Owner in P3 | Status |
| --- | --- | --- | --- |
| S1 local live two-profile identity | Distinct real Google A/B login in independent simultaneous profiles; session/CSRF/replay/expiry/logout negatives | P3 P1 upfront security checkpoint | OPEN |
| S2 local live tenant authorization | Test positive owner and foreign denial across project, agent, source/file, export, build, deployment metadata and private asset/capability APIs; then every P3 source/import/media/collection route | P3 P1 baseline and P3 P7/P8 regressions | OPEN |
| S3 local hosted persistence | Restart/reload after both accounts, source custom edit and portable export; safe hosted Build remains blocked | P3 P1 and P3 P8 | OPEN |
| S4 HTTPS staging auth | Approved real HTTPS callback/proxy and secure-cookie/CSRF/session security with two browser identities | P3 P8 independent qualification; otherwise retain as preproduction blocker | OPEN |
| S5 HTTPS S3 recoverability | Approved HTTPS S3 source and distinct restore private buckets plus distinct disposable Postgres DB; actual backup/restore and object/hash/revocation/foreign-denial proof incl. failure cleanup | P3 P8 independent qualification; otherwise retain as preproduction blocker | OPEN |
| S6 catalog endpoint security | Imported source and media APIs enforce owner and scope, safe URL fetch, private upload access, negative cross-account browser/API tests | P3 P2–P7, P3 P8 | NOT IMPLEMENTED |

## Delivery rules

Implementing P3 catalog features may proceed without S4/S5 external staging credentials. **Do not** waive S1/S2 before exposing new tenant media and import routes, or represent a failing foreign access check as an environmental blocker. Missing S4/S5 must be explicit in P3 P8 disposition and must block production security qualification. If P3's own critical import/security acceptance fails, P3 closes NOT GREEN. If catalog gates pass but S4/S5 are unavailable, report bounded P3 catalog qualification separately from unresolved hosted release gates; do not present the complete hosted platform or launch as GREEN.

A local MinIO S3 drill is valid evidence for its tested local backend; no requirement to replay the same drill merely for repetition unless affected implementation changed. Remote HTTPS staging proof must still be obtained for the release gate. No secrets, raw Google credentials, tokens, private URLs or personal account identities may be committed as evidence.

Historical `docs/tasks/p2/closeout.md` and `docs/tasks/c2-hosted-qualification/closeout.md` remain **NOT GREEN**, even if P3 closes its own bounded gates. No unapproved reassignment of P0/c0/real TV/Appstore gates.

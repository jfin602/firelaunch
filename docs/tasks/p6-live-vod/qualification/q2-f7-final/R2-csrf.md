# Q2 F7 follow-up — cycle 2 / R2 authenticated CSRF

Date: 2026-10-19 15:49 UTC. **Result: BLOCKED at live qualification.** R1 remains PARTIAL because exact full-ID parity for the earlier owner/foreign reads and a real foreign mutation denial are absent. This report records the R2 preflight in the owner's newly requested three-cycle loop; it does not label source tests or Studio UI as real CSRF HTTP evidence.

## Source and disposable target

At the cycle's start, HEAD was `489e28289a6838f147e52937d9322bfd48c24297`, root version `0.6.7`, and the working tree held the previously reconciled R1 report plus untracked `R2-csrf-preparation.md`. Read-only staging inspection showed the active compiled `api.js`, `auth/sessions.js`, and `hosted-repository.js` matching local `dist` byte for byte before the later R3 source repair. The current hosted API requires an authenticated session for `/api/projects`; every mutating method calls `SessionManager.authorizedMutation` before route dispatch. That method checks the exact Studio Origin and a session-matching `x-csrf-token`. A valid `PUT /api/projects/<id>` also checks ownership and expected revision before updating the spec. These are source contracts, not R2 live responses.

Owner A's separate private draft `ch_afc823551f2a4a52bb065507874e44c4` is revision 1 with zero catalog items and no observed deployment. It is the suitable title-only mutation target if live request inspection becomes available. The draft was created under the owner's explicit instruction to create the test environment; no R2 title change was made. Chrome B and the in-app owner session remained separate. No cookie or CSRF token was exported or logged.

## Required live matrix and observation

The planned matrix in [R2-csrf-preparation.md](R2-csrf-preparation.md) remains: owner valid-CSRF PUT success; owner missing, invalid and supported stale/mismatched CSRF denials; B's valid-CSRF foreign mutation denial; unchanged revision/catalog for all denied requests. The connected browser controls expose no supported same-origin HTTP request/response inspector. They cannot issue these requests or capture sanitized status/error classes. Consequently **no R2 live request was sent**, and none of A–E has a real HTTP result. R1's reported GET 404s and the existing local CSRF tests cannot fill that gap.

Focused tests in this R2 preflight: **0 run, 0 passed, 0 failed, 0 skipped**. Source repair: **none in R2**. No AWS, publication, media, release, staging service or schema change occurred. The later R3 local API addition is not deployed and requires final-source validation before any overall GREEN claim.

**Cycle 2 R2: BLOCKED.** Exact dependency: a supported way to send and inspect authenticated same-origin requests in each independent session, followed by a positive and negative before/after API readback on the disposable draft. F5 PASS, F6 PASS, F7 PARTIAL, Q2 NOT GREEN, Q3 UNSTARTED. R2 is not PASS.

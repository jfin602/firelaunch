# R1 - Real browser private-API read-isolation evidence (owner-reported)

Date: 2026-10-19 (conversation report; exact test clock time not supplied)
Source: User-provided Chrome/Firefox developer-console HTTP results in the FireLaunch qualification conversation.
Status: **Read-isolation portion PASS based on reported real HTTPS responses; overall R1 completion pending review of required foreign mutation-denial coverage and source-bound evidence.**
Q2: **NOT GREEN** (F5 PASS, F6 PASS, F7 PARTIAL). Q3 unstarted.

## Scope and evidence provenance

Two different authenticated Google identities were signed in simultaneously in separate browser sessions:
- **Account A**: owner of the test FireLaunch project.
- **Account B**: different, nonowner account.

The user executed a same-origin, credentials-included `fetch()` read-only test from `https://firelaunch.jfin.dev/`. This bypassed the earlier **browser navigation** limitation and returned actual HTTP statuses and JSON error codes. The user shared sanitized console output, not raw HTTP archives. The repository edit did **not** independently execute browser requests, inspect either session's cookies, check the live database or collect the original network HAR. The exact same full owner project ID should be independently reconciled from the two saved local browser logs; the project identifier is intentionally abbreviated in this public repository note (`ch_f9502ef...`).

## Observed request matrix (reported)

| Request | Account A, owner | Account B, foreign | Interpretation |
| --- | --- | --- | --- |
| `GET /api/auth/session` | HTTP **200** | HTTP **200** | Both browser sessions authenticated |
| `GET /api/projects/<owner-project-id>` | HTTP **200** | HTTP **404**, JSON `NOT_FOUND` | Owner-positive / foreign-denied private project read |
| `GET /api/projects/<owner-project-id>/catalog` | HTTP **200** | HTTP **404**, JSON `NOT_FOUND` | Owner-positive / foreign-denied private catalog read |
| `GET /api/projects/<owner-project-id>/deployment` | HTTP **200** in final owner run | HTTP **404**, JSON `NOT_FOUND` | Owner-positive / foreign-denied private deployment read in final comparison |

An **earlier owner-side deployment request returned 404**, making that first owner/foreign deployment comparison inconclusive. A later owner-side invocation returned **200 for deployment** alongside 200 for the project and catalog. Keep both observations; do not erase the earlier 404 or assert its cause without request logs.

Reported `Promise { <state>: "pending" }` was the normal console display of an asynchronous request, followed by the completed result table. For all Account B private-resource denials, the returned error code was `NOT_FOUND` and content type `application/json`. Owner-side reads returned 200 and `application/json`. The owner/foreign comparison is consistent with nonenumerating cross-account read authorization rather than a client-side navigation or transport block.

## What this evidence does *not* qualify

- It does **not** independently establish that both browser requests used byte-for-byte identical full project IDs; preserve exact URLs locally (redacted in any publicly committed report) for final R1 review.
- It does **not** establish a real foreign-account **write/mutation** denial. The R1 acceptance requirements should be checked against the original locally uncommitted `R1-foreign-api.md` without substituting a read-only 404 for a denied mutation.
- It does not prove missing/invalid CSRF protection, a successful valid-CSRF mutation, or absence of side effects from malicious mutations. These belong to **R2** and any remaining R1 write scope.
- It does not prove video revocation or CloudFront cache behavior; **R3** still requires a separately approved rights-cleared disposable fixture.
- It does not qualify a new application's source fingerprint, test run, or AWS changes. No tests or direct AWS calls were performed by this documentation change.

## Suggested qualification recording

- **R1 owner/foreign read isolation:** **PASS (owner-reported, HTTP responses observed)**, conditional on reconciliation of the exact project ID/request paths with locally retained evidence.
- **R1 entire checkpoint:** **PARTIAL until required foreign mutation-denial evidence is reviewed or safely exercised.** Do not close R1 solely on these reads if the active contract requires an actual denied write.
- **F7:** **PARTIAL**. **Q2:** **NOT GREEN**. **Q3:** **unstarted**.

## Next step: targeted R2

Proceed with an independently authorized **R2 real authenticated CSRF** test using a disposable draft/project, and complete any outstanding R1 foreign mutation denial against that same safe fixture. Use same-origin browser requests with `credentials: 'same-origin'` and `Origin` matching the Studio origin, never exposing cookies or CSRF tokens in logs. The actual server requires the `x-csrf-token` header and exact Origin match on mutating `/api/projects` routes. Capture actual HTTP responses plus before/after state; never use the current creator video, existing live release #1, or a cross-account write that could damage data if unexpectedly allowed.

The developer-local R1 evidence file was reported at `/home/jfin/dev/firelaunch/docs/tasks/p6-live-vod/qualification/q2-f7-final/R1-foreign-api.md`. This **separate supplemental GitHub file deliberately does not overwrite that uncommitted local report**. Reconcile/append from it without resetting the user's checkout.

## Preservation and change boundary

The user reported release #1 unchanged during the API checks. This note makes no inference about unrelated current AWS/runtime state. Saving the note makes no AWS, creator-content, database, staging, source, credential, or release change.

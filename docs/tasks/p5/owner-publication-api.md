# P3 owner publication API

All routes below are hosted, session authenticated, and owner scoped. POST requires the session CSRF token and exact origin. `:projectId` and `:deploymentId` identify the owned deployment; the server derives the creator account from the verified session. Responses use `Cache-Control: no-store`. These routes do not submit a native package or Developer Console listing.

Base path: `/api/projects/:projectId/publication/:deploymentId`.

| Method | Suffix | Purpose |
| --- | --- | --- |
| GET | `/status` | Current channel/catalog revisions, live release ID/sequence, and explicit native submission separation. |
| POST | `/readiness` | Check the candidate snapshot and current rights without recording approval or publishing. |
| POST | `/approve` | Record an explicit approval for the checked draft and bindings. |
| POST | `/publish` | Activate an approved snapshot with repository revision and live-pointer CAS. Retrying the same approval returns the same release. |
| GET | `/history` | Owned immutable release IDs, sequences, digests, timestamps, lineage, and live ID. |
| POST | `/rollback` | Approve a prior release against current rights. A separate `/publish` call creates and activates a new higher-sequence release. |

`/readiness` and `/approve` accept only `{ "revisions": { "channel": number, "catalog": number }, "expectedLiveReleaseId": string | null, "bindings": PublicationBindings }`. `/publish` accepts only `{ "approvalId": string }`. `/rollback` accepts only the revisions, expected live release ID, and `rollbackSourceReleaseId`. Unknown fields and caller-supplied owner or rights claims are rejected. A changed draft, catalog, live pointer, approval, or revoked/insufficient right yields a conflict. No approved catalog selection yields a conflict; no edit automatically publishes.

Anonymous public manifest reads belong to P4. Hosted native Build remains disabled. The P2/c2 S1–S6 hosted proof, original P4 non-mock provider proof, and P5 VirtualDevice/HTTPS proof remain open at this checkpoint.

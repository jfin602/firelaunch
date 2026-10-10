# Phase 3 / P8 independent catalog qualification

Date: 2026-10-10 CDT. Candidate HEAD: `110dd985f682db3b64efff1bc3a7e169f829ba68` (`0.3.7` P7 checkpoint). The preflight working tree was clean. This closeout advances only root `package.json` and the two root entries in `package-lock.json` to `0.3.8`; internal workspace versions are unchanged. No commit or HEAD rewrite was made.

## Checkpoint and inherited gate audit

The runner-owned Phase 3 implementation checkpoints are in order: P1 `2880df5c2ec3d7d40ce7a0aed5c16f1c221f1c7b`, P2 `c1a93bc2831e627bdc8253e9cb2635ff3050fa9b`, P3 `37bc33baed52b21c530cdf2a09743ffa0347d769`, P4 `e046f596042003ff0b61ef897cbc42e559843e38`, P5 `2426bb0b92890f4b0eee9d6263493c376f30f3c3`, P6 `d419c30e88f0059cf223fb7e9ed9b17165e61314`, and P7 `110dd985f682db3b64efff1bc3a7e169f829ba68`. P2 P7 remains [NOT GREEN](../p2/closeout.md), and c2 remains [BLOCKED / NOT GREEN](../c2-hosted-qualification/closeout.md). Historical P0/P7 and c0 dispositions are unchanged.

Reviewed the current hosted auth/session, API, catalog repository/import/feed, private-object, recovery, Studio catalog/Preview and test boundaries before closeout. The task had a configured local Google OIDC client, PostgreSQL 16 on loopback and actual private MinIO S3 buckets on loopback HTTP. No approved external HTTPS Google callback or HTTPS S3 staging source/restore resources were supplied. The browser inventory exposed one Codex in-app browser profile, not two isolated simultaneous profiles.

## Direct local observations

| Area | Observed result and limit |
| --- | --- |
| Real Google browser identity | Two consented Google identities logged in **sequentially in one browser profile**. The first identity created a private P3 qualification channel; after its successful logout, the second saw only its own existing project. Opening the first identity's project query URL in the second session returned to that second identity's own project. This is a useful UI isolation observation, not simultaneous two-profile or full foreign API denial proof. No account identifiers, tokens or cookies are retained here. |
| Import and review | In the first live hosted session, a synthetic CSV containing video, audio and book rows plus a duplicate external ID previewed three candidate rows and one `AMBIGUOUS` issue; approval was disabled. Corrected CSV previewed three creates and zero issues; explicit approval made three draft items. Repeating the same file previewed three unchanged rows and approval reported 0 new, 0 updated, 3 unchanged. |
| Curation and rights | Saved a creator title override while the imported source title remained visible separately. Created a bookshelf with the book. Uploaded a synthetic 1×1 PNG through the hosted private media UI with unknown display/playback rights; UI showed delivery disabled. Asserting display rights changed display to cleared, left playback unknown and delivery disabled. This is a synthetic rights assertion, not evidence of a real media license. |
| Restart and source | Stopped and restarted the hosted server, then reauthenticated. The browser showed all three items, creator override, bookshelf and artwork rights state persisted. Source generation exposed an ordinary Vega source file list. Direct browser navigation to the authenticated `code/export` API was blocked by the browser client, so no live-browser export result is claimed. The PostgreSQL convergence test exercised owner export, catalog account export, secret/object-ID exclusion, foreign export denial and hosted Build blocked. Sessions are process-local, so reauthentication after restart was expected and observed. |
| CSRF and logout | A first logout attempt after restart showed `Could not sign out`; reloading refreshed the session and the next logout succeeded. No repeatable defect was established from this transient result. The live browser did not complete a missing/wrong-CSRF or replay/expiry negative matrix. Focused automated auth tests covered CSRF, rotation, replay, expiry and logout, but are fixture evidence. |
| TV behavior | On the existing hosted sample project, the virtual remote Down then Select opened the Field Notes detail view; Back returned Home. The qualification catalog itself remained draft and did not appear as TV content. No new VPKG, physical Fire TV or Appstore result is claimed. |
| Direct API limitation | The browser client blocked opening the protected export URL directly (`ERR_BLOCKED_BY_CLIENT`). The full positive-owner/foreign-denial browser/API matrix for project, agent, source, build, deployment metadata, catalog and private capability routes was not completed. Automated route/repository tests are reported separately below. |

## Validation

Node `v24.21.0`; installed PATH npm `11.19.0` is below the declared npm 12 range. The **one** root aggregate used `npm@12.2.0` through `npx`, with actual local PostgreSQL and MinIO integration switches enabled.

- Focused auth, catalog, file/feed import, convergence, private-object and actual MinIO S3 recovery tests: **17 passed, 0 failed, 0 skipped**. These used disposable PostgreSQL databases; the S3 test used distinct real local MinIO source/restore buckets and the operations CLI backup/restore. Tests used synthetic principals rather than real Google browser profiles.
- One `npm run check` aggregate: kernel **80/80**, Studio **12/12**, runner **104/104**; **196 passed, 0 failed, 0 skipped** overall. Seven workspace typechecks and seven builds passed. Focused tests overlap the aggregate kernel count and are not additional aggregate tests.
- `npm run codex:stack:validate -- p3`: **VALID**, eight prompts recognized with P8 as the manual browser closeout.
- `git diff --check`: passed.

Local, untracked logs: `/tmp/firelaunch-p3-p8-focused.log` SHA-256 `56481b5b9e69888a64810279e1f88b65187b353fb31266cfb1ca4dfc3649f049`; `/tmp/firelaunch-p3-p8-root-check.log` SHA-256 `2fe9d43dabd9e95ccbcd1a4681d8786a050d8dfbb2397a0544ce19b3bee90467`; `/tmp/firelaunch-p3-p8-validator.log` SHA-256 `df480252013656a263d1680473a6104bac797828f0934fd08fac4af14dbf114a`. Logs and test media are outside Git.

## Disposition and remaining gates

**CATALOG GREEN (bounded local evidence) / HOSTED RELEASE NOT QUALIFIED.** No core catalog or local automated security failure was observed: real-browser CSV review/curation/private upload, PostgreSQL persistence, local MinIO and the full regression suite passed within the tested scope. This does **not** qualify the inherited live two-profile security gate or production hosting. An observed reproducible catalog or authorization failure would instead require NOT GREEN.

| Gate | P8 status |
| --- | --- |
| S1 local live two-profile identity | **OPEN.** Two real accounts were sequential in one browser profile. Simultaneous separated sessions and live replay/expiry/CSRF negatives remain unproven. |
| S2 local live tenant authorization | **OPEN.** Foreign project URL returned to the second account's own project; full live positive/foreign API route and capability matrix was blocked by the browser API-navigation limitation and absent second profile. Automated two-principal denial tests passed. |
| S3 local hosted persistence | **PARTIAL.** Live catalog survived server restart after reauthentication; source/account export and hosted Build blocking passed in PostgreSQL-backed automated tests, not a complete live-browser export/restart matrix for both accounts. |
| S4 HTTPS staging Google auth | **OPEN.** No authorized HTTPS callback/proxy target, secure-cookie observation or two-profile staging run. |
| S5 HTTPS S3 recoverability | **OPEN.** Actual local HTTP MinIO S3 backup/restore passed, but no independent HTTPS S3 staging source/restore drill or failure-cleanup proof. |
| S6 catalog endpoint security | **PARTIAL.** PostgreSQL-backed owner/foreign, CSRF fixture, private-object/capability, safe feed, rights and import tests passed; full real-account live API matrix remains open. |

Preproduction must complete S1/S2/S3/S6 live checks with two independent simultaneous browser profiles and authorized accounts, plus S4/S5 on approved HTTPS staging with independent private S3 source and restore resources. Preserve P2/c2 historical NOT GREEN; this bounded catalog result does not promote the hosted platform or launch.

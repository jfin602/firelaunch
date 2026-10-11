# c4-fix / P4 independent local correction closeout

Date: 2026-10-11 CDT. **c4-fix LOCAL GREEN for the tested 0.4.8 candidate. Original Phase 4 remains NOT GREEN. Hosted release remains NOT QUALIFIED.** This is a local correction result, not a production, provider, Vega, or Appstore qualification.

## Candidate and checkpoints

Tested HEAD: `131e4b454060b5ba53a528bbbc2f57fabf10d5e0` on `main`, with a clean tree before this manual closeout. The GitHub P4 historical closeout commit `3a0a0de1639723ec70d3877fc6a5f455f2506365` is an ancestor. Root `package.json` and both root `package-lock.json` version entries are `0.4.8`; internal workspace versions were not changed. P1–P3 runner commits are P1 `c1c156d5f0adb21c886510699d12c1718f21f66e`, P2 `f59ba000dc04bb37f7ee0e66e8e66c10d7aa079e`, and P3 `131e4b454060b5ba53a528bbbc2f57fabf10d5e0`. This closeout makes no commit or HEAD movement.

P1 replaced the stale fixed migration-7 assertion with an assertion derived from the ordered, contiguous migration files. The final aggregate exercised the real PostgreSQL source and isolated restored database, checking all current migrations **1–9** before repository startup could run migrations on the restored copy; restore failure cleanup, snapshot behavior, ownership and privacy assertions also passed. P2 retained the existing Bedrock Converse adapter, added fail-closed guardrail/malformed-turn behavior and truthful configuration status, and documented the server-side AWS SDK credential-chain setup. Its injected-client tool and save tests are offline. P3 added regression assertions for distinct video/audio/writing drafts, informational book and synthetic eligible media TV transitions, excluded rights-ineligible content, manual edits and stable selection across regeneration/restart, owner/revision denial, and export redaction. Synthetic media is not licensed browser playback evidence.

## Direct validation

Node `v24.21.0`; the final check invoked cached npm `12.2.0` CLI. Local PostgreSQL accepted connections on `127.0.0.1:55437`; loopback MinIO was available. `FIRELAUNCH_TEST_DATABASE_URL` was set from the existing local hosted database configuration for the single final aggregate. No AWS request was made.

| Required check | Observed result |
| --- | --- |
| `npm run codex:stack:validate -- c4-fix` | VALID; P1–P3 implementation and manual browser-required P4; unchanged `0.4.8` |
| **One final** `npm run check` under npm 12.2.0 | Passed: **7/7 workspace typechecks, 7/7 workspace builds**; kernel **97 passed, 0 failed, 1 skipped / 98 total**; Studio **18 passed, 0 failed, 0 skipped**; runner **104 passed, 0 failed, 0 skipped** |
| `git diff --check` | Passed after closeout write |

The one kernel skip is the pre-existing opt-in `actual MinIO S3 buckets and operations CLI backup/restore stay separate` test, guarded by `FIRELAUNCH_LOCAL_S3_TEST=1`. It was not enabled in this aggregate; local MinIO availability alone is not a passed CLI restore drill. The final aggregate did run the real PostgreSQL recovery test and the three-catalog convergence test. Aggregate log: `/tmp/firelaunch-c4-p4-check.log`, SHA-256 `edfd597c6c7c8ba29a8bee786438107339a9a55d732b04584f92f1dbb1ca6a45`. Earlier runner handoffs reported P1 focused 6 passed/1 skipped, P2 focused 14 passed/1 skipped, and P3 focused 21 passed plus Studio 18 passed; these are checkpoint reports, not additional final aggregate counts.

## Direct local browser observations

An authenticated Google session in one Codex in-app browser profile reached the local hosted Studio at `http://127.0.0.1:4173`; this did not exercise an independent second profile or HTTPS staging. In an existing private catalog, selecting the film under Video and the track under Audio each showed the warning that one selected audio/video item lacked eligible playback media or rights and would be excluded. No licensed HTTPS playback was attempted.

In a separate new private qualification project, a manual writing item generated Author and Bookshelf pages and saved revision 2. Opening the book showed its informational detail; virtual remote Select stayed on detail and Back returned to the channel. A creator catalog title override appeared in Preview after regeneration at revision 3. A manual TV text edit saved at revisions 4–5; repeat Generate saved revision 6 with **0 added, 0 updated, 0 removed** and retained the edited text. Browser reload still showed revision 6, the edited title and the edited TV text. This directly checks one identity and one writing browser path; video/audio focus, eligible playback, two-account browser denials, restart after this browser edit, and a full source export leakage audit were not directly observed here.

## Disposition and open gates

**c4-fix LOCAL GREEN**: the migration mismatch is repaired against the current contract, offline provider and rights/owner/regeneration regressions pass, the one required final aggregate passes with its disclosed existing skip, the validator and diff check pass, and the observed local writing/rights UI behavior agrees with the bounded correction. This does not reclassify earlier phase results.

**Original P4 remains NOT GREEN under ADR 0008.** No successful non-mock provider request has been observed with actual imported catalog context, a returned `inspect_catalog` tool result, a validated **SAVED** ChannelSpec revision, provider identity, and a visible Preview effect. Bedrock model configuration, `configured: true`, injected-client fixtures, or STS identity would not establish that trace. The existing opt-in [P4 provider smoke](../p4/provider-smoke.md), using the safe local [Bedrock setup](bedrock-local.md) if AWS verification/model entitlement/permissions and spend approval become available, is a **later optional live qualification**, currently NOT EXECUTED. Phase 4's remaining real-browser video/audio and directional-focus product gates also stay open. Historical P0/c0 and P2/c2 remain NOT GREEN; P3 remains bounded CATALOG GREEN / HOSTED RELEASE NOT QUALIFIED. The [historical P4 closeout](../p4/closeout.md) and [ADR 0008](../../decisions/0008-launch-ai-provider-policy.md) are unchanged.

**Hosted release remains NOT QUALIFIED.** S1 simultaneous independent real Google browser profiles and session negatives: OPEN. S2 full live owner/foreign API and capability denial matrix: OPEN. S3 browser persistence/export across both accounts: PARTIAL. S4 approved HTTPS Google callback and secure-cookie staging: OPEN. S5 independent HTTPS private S3 source/restore qualification: OPEN (prior loopback MinIO evidence is narrower). S6 complete live catalog endpoint security: PARTIAL. Rights-cleared device-reachable video/audio and production source/media permission evidence also remain open.

P5 owns the next television delivery proof: **the same real installed VPKG** on a qualified Vega target (VirtualDevice accepted for P5) must receive an approved compatible remote manifest revision without reinstall and retain safe refresh, last-known-good/fallback, and incompatible/network-failure behavior. This correction provides no VPKG, device, public manifest, physical Fire TV, Developer Console or Appstore claim.

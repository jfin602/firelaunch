# P7 convergence evidence and P8 handoff

Date: 2026-10-10 CDT. Starting HEAD `da457095c0a95f103d57055a7e22c3e2c1a93edd` (`0.4.6`, runner-owned P6 checkpoint); starting worktree clean. P7 leaves root version `0.4.7` in the working tree for the runner to commit. Internal workspace versions remain unchanged.

## Observed local behavior

The new PostgreSQL-backed [convergence test](../../../apps/server/test/catalog-generation-convergence.test.ts) creates three synthetic, separate creator accounts and projects. Each imports a JSON catalog after preview and explicit approval. Video has a cleared film/episode and withheld trailer; audio has a cleared track and withheld track; writing has an informational book and withheld reading. The test checks owner-scoped selection, blocked items, stable composition and IDs, TV focus/Select/Back (book detail has no Play), creator title/brand/navigation edits, repeat generation, deterministic fixture-provider inspect and saved brand tool action, durable spec and baseline across repository restart/re-identity, Vega source export, private-field exclusion, and foreign catalog/project/export denial. The writing import also retains a creator title override and bookshelf. The fixture provider is offline and **is not live non-mock evidence**.

The hosted API security regression test separately exercises CSRF, foreign agent/draft/preview and code routes, logout, stale session rejection after API restart, relogin and export. The catalog projection test covers missing approval, foreign IDs, stale revisions, revoked rights and signed media rejection. Existing TV, generator and Studio tests cover legacy video migration, audio/informational semantics, Vega parity, source custom edit protection, virtual remote/keyboard parity and Preview behavior. These are automated fixture observations, not real browser or external service results.

One directly observed defect was repaired: hosted readiness copy said “featured videos” and promised playback for audio/writing drafts. It now derives video/audio/book copy from the actual ChannelSpec presentation types. The convergence test failed on the old wording and passes after the repair.

## Validation

Node `v24.21.0`; npm `12.2.0` invoked with a writable `/tmp` cache. Tests used a disposable local PostgreSQL 16 cluster and databases; no external AI or media service was contacted.

- Focused server/kernel/security/TV/Vega tests: **34 passed, 0 failed, 0 skipped**. Log `/tmp/firelaunch-p4-p7-focused.log`, SHA-256 `f2afc394a98fb957d1f69b1e91f84c2e6a56bacbf5500bba8e022c6bbafe6099`.
- Focused Studio tests: **15 passed, 0 failed, 0 skipped**. Log `/tmp/firelaunch-p4-p7-studio.log`, SHA-256 `7e446a8bb302602d2c82c37a6f3ff7e499cdf94d22a48cdbe86d1bf8a63fc44c`.
- Seven workspace typechecks passed. Log `/tmp/firelaunch-p4-p7-typecheck.log`, SHA-256 `b14cee649762c7715e8fb7e5b5e8bf61087c1938c42936665d7977b8c24b8512`.
- Seven workspace builds passed. Log `/tmp/firelaunch-p4-p7-build.log`, SHA-256 `7c15b479148024649bc91e7e8532e45f69d4fe7ef06dba4679f2cdbf9162dcf4`.
- `git diff --check` passed. Root `npm run check` and P4 stack validator finalization are reserved for P8.

## Independent P8 work

Use the [fixture and browser runbook](p7-handoff.md) and [provider smoke](provider-smoke.md). P8 must observe three real browser drafts and one actual successful non-mock, catalog-grounded provider request with a validated saved ChannelSpec revision and usable Preview. No such browser/provider call, physical device, VPKG, Appstore, public TV delivery or production hosting result was obtained in P7. P4 GREEN cannot be inferred from these offline tests.

P2 P7 remains NOT GREEN and c2 BLOCKED / NOT GREEN. P3 remains CATALOG GREEN for its bounded local workflow / HOSTED RELEASE NOT QUALIFIED. S1 and S2 live two-profile/authz checks remain open; S3 live persistence/export is partial; S4 HTTPS Google callback/cookie and S5 independent HTTPS S3 restore remain open; S6 live endpoint security is partial. P8 must report these separately and cannot silently promote them.

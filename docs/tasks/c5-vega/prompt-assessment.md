# Correction c5-vega — Prompt Assessment

Status: approved correction assessment; implementation NOT STARTED
Review date: 2026-10-12
Version: `0.6.0` fixed throughout, using merged source on GitHub main
Source of truth: [P5 original NOT GREEN closeout](../p5/closeout.md), [P5 device runbook](../p5/P8-device-runbook.md), [ADR 0009](../../decisions/0009-live-channel-delivery.md)

## Actual observed failure

P5's seven implementation checkpoints built strict publication contracts, migrations and CAS owner approval/release history, public read resolver, a generated pinned Vega remote-loader with LKG, and Studio draft/live controls. Its final repository suite passed **228 / 229 total tests, 1 skipped**, with seven typechecks and builds. It is NOT GREEN because no creator-bound VPKG was built or installed and no real release revision was fetched on-device. A synthetic generated project reached `vega project doctor` but its real release build failed:

1. Generated project from `packages/generator/src/index.ts` used `@react-native-async-storage/async-storage` alias to `@amazon-devices/react-native-async-storage__async-storage@2.1.9000000000-rn-83`. Installed Vega SDK `main@0.24.12112` rejected that version from its `kepler-compatibility.json`.
2. Metro/Babel failed parsing `zod/v4/classic/external.js` `export * as` syntax. Existing `templates/vega-channel/babel.config.js` contains only `module:@react-native/babel-preset`. P5 native `src/remote-release.js` imports Zod and uses strict schema validation; bundling must be fixed without weakening runtime verification.
3. No real creator-approved bound project/public HTTPS resolver, source rights-approved artwork/media, or released v1/v2/v3 HTTP sequence was available in the qualification session. Vega VirtualDevice OS 1.2 was connected, but the installation count was ZERO. The browser client blocked loopback access, and a local DB fixture did not contain the publication migrations.

Current source confirms the build paths above and `templates/vega-channel/src/App.js` uses the bound-client release loader plus Vega media surface. `firelaunch.jfin.dev` now hosts an authenticated Studio but that is not the **public-only** P5 resolver. Existing `docs/tasks/p5/public-https-staging.md` describes GET-only `/public/v1/deployments/...` origin access; owner `/api` and Studio must not leak through the public TV hostname.

## Why this is a correction, not P6

P6 media ingestion and AWS delivery do not repair native SDK compatibility, Metro bundling, or prove one installed VPKG receiving updated manifests and rollback. P5 can close its own qualification using a small independent rights-cleared HTTPS asset or a permitted informational fixture. Do not conflate media storage, viewer IAP and published-channel control plane.

## Risks / evidence

| Risk | Required decision or evidence |
| --- | --- |
| Wrong SDK version pinned | Inspect installed Vega `kepler-compatibility.json` and vendor docs; choose only supported alias/version, test actual doctor and bundling; no guessed dependency bump |
| Zod bundle parse failure | Use supported Metro/Babel transform or compatible strict validator; preserve fail-closed schema and digest/identity checks; negative release payload tests |
| Previously valid local P0 regresses | Generator tests for unbound legacy path, deployment-bound path, custom file protection and saved LKG; regenerate actual build, not just source |
| TV origin accidentally exposes private routes | Public-only vhost with exact GET patterns; deny `/api`, cookies, Studio, MinIO and DB; prove from device network |
| Unlicensed test media | Owner supplies independent clear rights/evidence for artwork and video/audio; explicit separate TV display/playback rights; no Amazon/Prime/YouTube extraction; do not falsely approve sample assets |
| Absent real creator-owned deployment | Use existing owner-only publication API and private catalog; rights/revision checks and immutable release sequence; no synthetic published claim |
| Off-network/backwards/failure update bugs | One exact installed VPKG; v1→v2, offline cold restart LKG, bad digest/deployment/schema/network rejection, v3 new-sequence rollback; real screenshots and device logs |
| Unknown VM/host compatibility | Vega VirtualDevice may qualify this bounded P5 correction but not physical Fire TV/Appstore; Linux Mint formal support separately unverified |
| VPS capacity and security | No remote builds or transcoding on muffinos; preserve Ngest, staging secrets and password-based SSH; manual operator approval for any new DNS/Nginx/site/config |
| Historical status contamination | P5 original stays NOT GREEN; c5 gets new independent GREEN/NOT GREEN; P2/c2 S1-S6 and P4 provider remain open |

## Decomposition

P1 repairs the two directly observed native build incompatibilities, with targeted regression and real toolchain build if installed. P2 uses the repaired artifact/source to prepare an owned v1/v2/v3 release and carefully scoped HTTPS qualification surface, requiring manual operator input for any VPS/DNS changes; it cannot auto-provision or waive missing credentials/rights. P3 performs independent on-device proof, one final npm 12 aggregate, validator and no-loss closeout. Keep prompts <=8 minutes implementation target and no unnecessary global rebuilds. If P1 native build cannot be produced, P2/P3 must remain factual blockers; no broad architecture rewrite.

# FireLaunch

## Current October 21 C7 status

**C7 PARTIAL / NOT GREEN.** Later C7 closeout proves R1 Studio startup SCOPED GREEN, R2 isolated same-VPS worker and real creator-bound native VPKG GREEN, R3 authenticated four-file Studio ZIP SCOPED GREEN. R4 independently installed the exact downloaded VPKG on a stable Vega VirtualDevice, displaying the approved channel, artwork, Back navigation and restart. **Remaining:** Hls.js parsed approved master and variant playlists but stalled at the first TS fragment (no FRAG_LOADED); moving video, independently verified sound, pause and seek remain unqualified. Run only the manual [R4 playback recovery](docs/tasks/c7-export-recovery/R4-playback-recovery.txt) with at most three focused repair cycles. Reuse existing GREEN work. Root 0.7.3 and core schema 14 unchanged; preserve approved public release #1.

The recorded protected staging release is 20261020T233126Z-d375ee6f1709 (2026-10-20 23:39 UTC readback), not a new live host inspection. C7 closeout source is committed at c5a4421, distinct from tested archive provenance.

FireLaunch is a creator-owned Fire TV channel studio with authenticated hosted creator workspaces, catalog, private video uploads, managed HLS processing, explicit free-video channel publication, and React Native for Vega source/build infrastructure. **As of the dated October 20 evidence**, the `0.6.7` staging Studio has a closeable/reopenable progressive video workspace and AWS ingest configuration ACTIVE; earlier Q1/F7 work completed real MediaConvert HLS and an explicit creator-approved FREE CloudFront release #1. **Q2 F7 remains PARTIAL/NOT GREEN; native creator-bound Vega export/download and independent installed VirtualDevice playback remain UNQUALIFIED.** No new paid job was run in the c6-usability P6 deployment. Latest `main` source at `b0d2897` has newer creative/video artwork integration that is **not automatically confirmed deployed**. See [current state](docs/CURRENT-STATE.md) and the [October 20–23 delivery override](docs/roadmap/mvp-roadmap.md).

**Start here:** [Current State](docs/CURRENT-STATE.md) (dated evidence, deployment, risks), [October 20–23 delivery roadmap](docs/roadmap/mvp-roadmap.md), [c6-usability P6 closeout](docs/tasks/c6-usability/closeout.md), [supporting-media reconciliation](docs/tasks/c6-supporting-media/README.md), [p6-live-vod Q1-Q3](docs/tasks/p6-live-vod/README.md) (historic manual gates and current device routing), [ADR 0011](docs/decisions/0011-aws-vod-foundation.md) and [ADR 0013](docs/decisions/0013-hybrid-video-access.md).

Historical P0 qualification was NOT GREEN at 0.0.7. Preserve [P0 closeout](docs/tasks/p0/closeout.md) and historical phase results without presenting them as the current application status.

## Historical October 20 recovery status (superseded above)

[P7 P4 closeout](docs/tasks/p7/closeout.md) is **NOT GREEN** after an authorized version 0.7.3 staging rollout left React root empty; rollback restored the prior healthy 0.6.7 Studio. Local aggregate: 326 passed, 15 skipped, no device ZIP/VPKG playback. The next approved docs/prompt workflow is [c7-export-recovery](docs/tasks/c7-export-recovery/README.md) at **unchanged 0.7.3**: diagnose Studio rendering, finish isolated worker, complete real Studio ZIP download, and independently requalify x86_64 Vega playback. No physical Fire TV/Appstore claims or automatic source synchronization.

## Current October 20 approved Phase 7–9 plan (docs only)

[Phase 7](docs/tasks/p7/README.md) targets actual creator-bound x86_64 Vega ZIP export, independent installation and free HLS playback. [Phase 8](docs/tasks/p8/README.md) confirms the full creative/video publication pipeline. [Phase 9](docs/tasks/p9/README.md) confirms an integrated Studio-to-independent-VirtualDevice walkthrough by Friday October 23 noon Central. Planned version bands: 0.7.x, 0.8.x, 0.9.x, not shipped software.

Intended journey: creator explicitly publishes rights-cleared content -> clicks Export App -> authenticated ZIP download includes actual x86_64 VPKG, README, export-info.json and SHA256SUMS -> independently extract and install/launch on Vega VirtualDevice -> see actual branded channel and published artwork/video -> HLS audio, remote control and app restart work. The current hosted Build & Export popup uses the separate restricted worker and authenticated owner ZIP; the remaining C7 issue is native HLS playback, not export infrastructure.

Automatic external catalog synchronization and a standalone creator billing/Console operations phase have been removed. Manual creator-import/re-import, explicit approval and native refresh of already published manifests remain; MediaConvert processing after creator uploads continues. Physical Fire TV/Appstore and paid video are outside this deadline.

## Approved future Studio visual baseline

The owner-approved [Desert Heat Studio visual baseline](docs/design/studio-visual-baseline.md), [ADR 0012](docs/decisions/0012-studio-visual-identity.md) and [approved screenshot provenance](docs/design/references/README.md) establish the new **future** full-bleed dark cinematic creator Studio UI, dimmed canyon background, warm restrained orange-red controls and independently colored media artwork. **Documentation only:** this is not the currently shipped Studio style or a qualified deployment.

## Current hosted video operation and delivery gap (dated October 20, 2026)

The [c6-usability P6 closeout](docs/tasks/c6-usability/closeout.md) documents verified guarded deployment of a progressive Add Video workspace to the canonical staging service, bounded signed-in browser/reopen checks, test-backed two-hour limits (1..7200 seconds and 2 GB ceiling) and enabling the existing client-account MediaConvert queue and EventBridge completion rule. No new upload finalization, paid MediaConvert job, public release or actual two-hour encode was performed for this closeout. Historical Q1/F7 real managed READY and Q2 approved free release #1 should be reused, not repeatedly requalified from scratch. FFmpeg worker remains retired; private original and staged HLS remain access-controlled.

The newest inspected GitHub source (`b0d2897`) additionally addresses thumbnail save/reopen, private preview, managed artwork and publication integration; its runtime state needs focused browser/release verification. Its release-scoped `/api/public-artwork/` path differs from the earlier CloudFront image proposal (see [ADR 0014](docs/decisions/0014-video-supporting-media.md)). Do not assume a source commit is already installed on staging.

**Critical October 23 noon Central delivery work:** a real creator/deployment-bound downloadable Vega `.vpkg`, standalone external Vega VirtualDevice install, TV navigation/artwork/approved HLS playback, and a complete creator Studio-to-export smoke. The Studio `Delivery.tsx` currently describes hosted build as requiring an isolated build service; local fixture VPKG evidence alone is insufficient. Preserve historical Q2 F7 NOT GREEN and Q3 UNQUALIFIED until independently evidenced. Paid/entitled viewing, optional subtitles and advanced merchandising are out of the core sprint. See [delivery roadmap](docs/roadmap/mvp-roadmap.md).

## Prerequisites and start

- Node 24.15+ (24.x) and npm 12.x (`.nvmrc` pins 24). Verify with `node --version` and `npm --version`.
- Run `npm ci`, then `npm run build` at the repository root. The build compiles all workspaces and creates Studio production assets; it does not build a VPKG.
- In terminal 1 run `FIRELAUNCH_MODE=local-legacy npm run dev` (API on `127.0.0.1:4174`). In terminal 2 run `npm run dev:studio` (Studio on `http://127.0.0.1:4173`). Vite proxies `/api` to the API. `npm start` builds and starts **only** the API, not the Studio UI.
- The historical P0 local application stores data at `.firelaunch-data/projects/<channel-id>/`; set `FIRELAUNCH_DATA_DIR` for another local data root. Its loopback API has no authentication and MUST NOT be exposed as a hosted service. Phase 2 implements authenticated Postgres-backed multi-tenant hosting; see `docs/tasks/p2/` for scope and qualification. Set `PORT` only if you also change the Studio proxy in `apps/studio/vite.config.ts`.
- Hosted login configuration requires `FIRELAUNCH_MODE=hosted`, `DATABASE_URL`, `FIRELAUNCH_PUBLIC_ORIGIN` (HTTPS), `FIRELAUNCH_OIDC_CLIENT_ID` and `FIRELAUNCH_OIDC_CLIENT_SECRET` for a Google OAuth web client whose exact authorized callback is `<origin>/api/auth/callback`. TLS terminates at a trusted reverse proxy that preserves `Host` and sends the matching `X-Forwarded-Proto`/`X-Forwarded-Host` if those headers are present; the server itself binds loopback only. Sessions are process-local and may require reauthentication on restart. A bounded live Google login/restart and distinct second-account Studio-denial check passed in the Add Video staging closeout; comprehensive cross-account raw API negatives and production hosted security gates remain separate.
- Hosted private objects require `FIRELAUNCH_OBJECT_STORE=s3`, `FIRELAUNCH_OBJECT_BUCKET`, and `FIRELAUNCH_OBJECT_REGION`. The deployed native S3 configuration uses `FIRELAUNCH_OBJECT_AUTH=aws-profile` with a short-lived, separately configured `AWS_PROFILE` (Roles Anywhere / credential process), **not** static AWS keys. The alternative explicitly configured static-credential form exists for appropriate isolated/test setups; never put either credentials or profile files in Git. Check `apps/server/src/private-objects.ts` and actual deployed environment before configuration changes. Set `FIRELAUNCH_OBJECT_ENDPOINT` only for an HTTPS S3-compatible endpoint. The bucket must deny public access, permit only put/get/delete for its private prefix, encrypt objects at rest, and exclude list-bucket access. Missing configuration stops hosted startup. P2 P4 currently supports small private evidence/media objects up to 1 MB through authenticated API routes; catalog ingestion and TV delivery remain later work.

The repository requires Node 24 and npm 12. Historical npm 11 test workarounds do not qualify a current source or a native Vega build; verify the actual installed toolchain.

## Three-minute path

1. **New channel:** name it **Wild Earth**; keep “Add rights-safe demo collection” selected. Seven revision-checked mutations add three original SVG concept artworks, Nature/Oceans/Africa rails, and one reused five-second procedural clip. This is demonstrative content, not licensed wildlife footage.
2. **Preview/Design/Content:** use arrow keys and Enter/Escape or the virtual remote for page, detail and playback navigation. Edit brand and catalog in the inspector; saved ChannelSpec revisions immediately refresh the shared TV projection. Reload the browser or restart the API to reopen the persisted project.
3. **Create (agent):** the provider label distinguishes deterministic offline `MOCK` from configured `BEDROCK`. In default mock mode, try `primary color to #224466` or `add page Explore`. The mock does not understand arbitrary prose. A configured Bedrock provider is not proof of a successful model call.
4. **Code:** generate the Vega source; inspect `manifest.toml`, `src/channel.json`, `src/tv-runtime.js`, and `src/App.js`. The source tree is in the local project workspace under `generated/`. Edits use file hashes; changing ChannelSpec makes source stale; regeneration refuses to overwrite any custom or unknown file.
5. **Build:** run the toolchain check and opt-in release build. Without the real SDK/CLI the result is **blocked**, not a claimed VPKG. **Publish** reports separate readiness groups and writes a local submission bundle (draft copy, assets, readiness and human checklist). It never submits to Amazon.

The demo clip URL is `http://127.0.0.1:4173/media/field-notes.mp4`: this works in the local Studio, **not** on a separate Vega device. Generated source records unresolved `assets/` artwork references; the React Native template does not bundle the Studio SVGs. Supply device-reachable rights-cleared video and TV-compatible licensed artwork in the generated project before real qualification. The semantic channel data and D-pad transitions are shared, but visual/media parity on Vega still requires P7 evidence.

## Validation

- `npm run typecheck` — all TypeScript workspaces.
- `npm run test:kernel` — contracts, engine, TV, generator, agent and server deterministic tests (runs the affected build first).
- `npm run test:studio` — headless JSDOM Studio tests, including API-backed golden path and persistence/restart; **not** a real-browser qualification.
- `npm run test:runner` — Prompt Stack runner regressions.
- `npm run test` — all three test groups; `npm run check` — typecheck and all tests/production builds.
- `npm run build` — production workspace build; `git diff --check` — whitespace validation.
- `npm run codex:stack:validate -- p0` validates prompt grammar. The runner, not an implementation agent, owns checkpoint commits.

## Vega/toolchain and generated project

`npm run doctor:vega` reports Node/npm, `ADBT_CONTEXT_PATH`, `VEGA_SDK_PATH`, absolute `VEGA_CLI_PATH`, `adb`, and visible device/simulator state where detectable. Install the matching Vega SDK/dev tools separately on a supported and verified build host, configure these environment paths, and run the doctor again. Vega SDK 0.24 requires an `[os.version]` section in `manifest.toml` (with `target = "1.2"` and `min = "1.2"` for OS 1.2); check the installed SDK and generated dependencies before any manifest/template repair. Amazon's published host list for SDK 0.24 does not explicitly include Linux Mint. The existing Build wrapper's CLI arguments must be verified against the installed SDK, not assumed compatible from source or package pins. The Build action executes only the configured executable with fixed `build -b Release` arguments inside the generated project; it requires an actual fresh nonempty release `.vpkg` and records its SHA-256. No arbitrary server command is exposed. The generated manifest requires `com.amazon.category.main`.

For a deterministic source export without using the UI, build first, then call the local API: `POST /api/projects` with `{"title":"Wild Earth"}`, apply `POST /api/projects/<id>/mutations` with the current `expectedRevision`, then `POST /api/projects/<id>/code` with `{}`. `GET /api/projects/<id>/code` gives its path and stale/custom-edit status; `GET /api/projects/<id>/code/file?path=src%2Fchannel.json` returns the projection. Source generation is explicit and does not install dependencies or build the generated app. The generated project is an ordinary source tree owned by the creator; see `templates/vega-channel/README.md` for template details.

For a real Bedrock request set `FIRELAUNCH_AGENT_PROVIDER=bedrock`, an accessible `BEDROCK_MODEL_ID`, and `AWS_REGION`; use the AWS SDK's normal environment/profile credential chain. Never put credentials in ChannelSpec or Git. Default `FIRELAUNCH_AGENT_PROVIDER=mock` requires no AWS access. Unit tests serialize Converse/tool-use without claiming a live Bedrock call.

## Submission boundary

The creator must replace local sample media/artwork, provide store icon/screenshots, support/privacy details and content-rights declarations, perform a real Vega release build, test on simulator/device (and physical Fire TV before production), then sign into their own Amazon Developer Console to upload, select targets, review and submit. FireLaunch does not automate credentials or submission. See `docs/publishing.md`, `docs/demo-plan.md`, `docs/hackathon-requirements.md`, and `MODULES.md`.

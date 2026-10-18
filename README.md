# FireLaunch

FireLaunch is a creator-owned Fire TV channel studio with an authenticated hosted creator workspace, catalog, private video uploads, channel generation, and a React Native for Vega output path. The **last verified staging** at root `0.6.7` supports the simplified Add Video workflow with PostgreSQL-backed catalog/rights/shelf persistence and private S3 originals (**STAGING UX GREEN**). Managed MediaConvert processing is **LOCAL GREEN only**; real HLS encoding, public free CloudFront publication and installed Vega playback are **not yet qualified**.

**Start here:** [Current State](docs/CURRENT-STATE.md) (dated evidence and next work); [p6-live-vod Q1-Q3](docs/tasks/p6-live-vod/README.md) (manual qualification); [ADR 0011 managed encoding](docs/decisions/0011-aws-vod-foundation.md); [ADR 0013 hybrid free/future paid delivery](docs/decisions/0013-hybrid-video-access.md).

Historical P0 qualification was NOT GREEN at 0.0.7. Preserve [P0 closeout](docs/tasks/p0/closeout.md) and historical phase results without presenting them as the current application status.

## Approved future Studio visual baseline

The owner-approved [Desert Heat Studio visual baseline](docs/design/studio-visual-baseline.md), [ADR 0012](docs/decisions/0012-studio-visual-identity.md) and [approved screenshot provenance](docs/design/references/README.md) establish the new **future** full-bleed dark cinematic creator Studio UI, dimmed canyon background, warm restrained orange-red controls and independently colored media artwork. **Documentation only:** this is not the currently shipped Studio style or a qualified deployment.

## Current hosted video operation (root 0.6.7)

Creator Add Video is live in the canonical staging service: authenticated multipart MP4 ingest persists owned CatalogItem, MediaAsset, rights and shelf metadata and writes a private original to the client's S3. An uploaded original is **not** playable or published; Studio truthfully shows processing unavailable while AWS processing is off. The existing managed MediaConvert job coordinator, trusted events and private HLS verifier are offline-qualified code, not a live encode. CloudFront distribution and native Vega delivery are still unqualified. See the [current ledger](docs/CURRENT-STATE.md), [upload closeout](docs/tasks/c6-video-publishing-ux/closeout.md) and [managed VOD runbook](docs/integrations/aws-vod-foundation.md). The FFmpeg worker is retired. Only explicitly approved free content may become publicly accessible after independent Q2 approval.

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

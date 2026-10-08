# FireLaunch

FireLaunch is a local, code-optional studio for designing a TV channel and generating a creator-owned React Native for Vega project. **0.0.6 is a hackathon candidate, not a qualified VPKG or Amazon submission.** P7 independently qualifies the real browser, Vega build, and simulator/device path.

## Prerequisites and start

- Node 24.15+ (24.x) and npm 12.x (`.nvmrc` pins 24). Verify with `node --version` and `npm --version`.
- Run `npm ci`, then `npm run build` at the repository root. The build compiles all workspaces and creates Studio production assets; it does not build a VPKG.
- In terminal 1 run `npm run dev` (API on `127.0.0.1:4174`). In terminal 2 run `npm run dev:studio` (Studio on `http://127.0.0.1:4173`). Vite proxies `/api` to the API. `npm start` builds and starts **only** the API, not the Studio UI.
- Data defaults to `.firelaunch-data/projects/<channel-id>/`; set `FIRELAUNCH_DATA_DIR` for another local data root. The API binds loopback and has no authentication. Set `PORT` only if you also change the Studio proxy in `apps/studio/vite.config.ts`.

The repository enforces npm 12. This development environment currently has npm 11; local checks can use `npm_config_engine_strict=false` to run already-installed dependencies, but that override does **not** qualify the Vega toolchain.

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

`npm run doctor:vega` reports Node/npm, `ADBT_CONTEXT_PATH`, `VEGA_SDK_PATH`, absolute `VEGA_CLI_PATH`, `adb`, and visible device/simulator state where detectable. Install the matching Vega SDK/dev tools separately, configure these environment paths, and run the doctor again. The Build action executes only the configured executable with fixed `build -b Release` arguments inside the generated project; it requires an actual fresh nonempty release `.vpkg` and records its SHA-256. No arbitrary server command is exposed. The generated manifest requires `com.amazon.category.main`.

For a deterministic source export without using the UI, build first, then call the local API: `POST /api/projects` with `{"title":"Wild Earth"}`, apply `POST /api/projects/<id>/mutations` with the current `expectedRevision`, then `POST /api/projects/<id>/code` with `{}`. `GET /api/projects/<id>/code` gives its path and stale/custom-edit status; `GET /api/projects/<id>/code/file?path=src%2Fchannel.json` returns the projection. Source generation is explicit and does not install dependencies or build the generated app. The generated project is an ordinary source tree owned by the creator; see `templates/vega-channel/README.md` for template details.

For a real Bedrock request set `FIRELAUNCH_AGENT_PROVIDER=bedrock`, an accessible `BEDROCK_MODEL_ID`, and `AWS_REGION`; use the AWS SDK's normal environment/profile credential chain. Never put credentials in ChannelSpec or Git. Default `FIRELAUNCH_AGENT_PROVIDER=mock` requires no AWS access. Unit tests serialize Converse/tool-use without claiming a live Bedrock call.

## Submission boundary

The creator must replace local sample media/artwork, provide store icon/screenshots, support/privacy details and content-rights declarations, perform a real Vega release build, test on simulator/device (and physical Fire TV before production), then sign into their own Amazon Developer Console to upload, select targets, review and submit. FireLaunch does not automate credentials or submission. See `docs/publishing.md`, `docs/demo-plan.md`, `docs/hackathon-requirements.md`, and `MODULES.md`.

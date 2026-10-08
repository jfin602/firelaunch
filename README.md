# FireLaunch

FireLaunch is an agentic studio for creating branded television channels and shipping them as real Amazon Fire TV applications.

The hackathon MVP is deliberately narrow: describe a channel, generate a structured ChannelSpec, preview and navigate it like a TV app, refine it conversationally, inspect/edit the generated source, produce a React Native for Vega project, and take it through build and Amazon Appstore readiness.

> Prompt -> ChannelSpec -> TV preview -> Vega source -> VPKG -> Fire TV

## Current gate

FireLaunch's Channel Agent checkpoint is at **0.0.4**. The active implementation plan is the staged **P0 FireLaunch Hackathon MVP Prompt Stack** in `docs/tasks/p0`.

P1 provides the local Node API; P3 adds a separate Studio UI. With Node 24 and npm 12, run `npm install`, `npm run build`, then `npm run dev` and `npm run dev:studio` in separate terminals. The API listens on `127.0.0.1:4174` and Studio on `127.0.0.1:4173` by default. Set `PORT` and `FIRELAUNCH_DATA_DIR` to override the API port and local data root (and update the Studio proxy if changing the API port). Project data under `.firelaunch-data/projects/<channel-id>/project.json` is excluded from Git.

`POST /api/projects` accepts `{ "title": "Wild Earth" }` and optional `slug`; `GET /api/projects` lists projects, `GET /api/projects/:id` reads one, `PUT /api/projects/:id` accepts `{ "expectedRevision": 1, "spec": { ... } }`, and `POST /api/projects/:id/mutations` accepts `{ "expectedRevision": 1, "mutation": { ... } }`. Writes return the full project with an incremented revision; stale writes return 409. Invalid input returns 400. Only ChannelSpec v1 is accepted; no migration from older or future schema versions is implemented yet. The server binds loopback only and has no authentication.

P0 uses six bounded GPT-6 Sol High implementation checkpoints followed by one independent browser/Vega qualification closeout:

- P1: repository foundation, ChannelSpec, persistence, API skeleton
- P2: shared TV semantics, Vega generator, manifest and toolchain discovery
- P3: creator Studio, TV Preview, D-pad/focus and playback
- P4: ChannelAgent, structured tools, deterministic mock and Bedrock
- P5: Code, Build and Publish/readiness
- P6: golden-path integration, Wild Earth fixture, regression and polish
- P7: real browser + VPKG + Vega simulator/Fire TV qualification

Astra remains available only as an exceptional escalation option for a genuinely cross-system blocker.

Read `BOOT.md` before substantial repository-aware work.

## Product promise

A creator should not need to understand D-pad focus management, Vega packaging, or TV application structure to launch a polished channel. FireLaunch makes the common path conversational and structured while keeping the generated code fully accessible.

The creator owns the generated source, Amazon Developer account, app listing, brand, content, and build artifacts.

## Hackathon target

Primary track: Amazon Fire TV, targeting Vega OS first.

The current challenge rules require a working demo on Fire OS or Vega OS and a demo video showing the project on a real device or simulator. Public repositories must include an open-source license; this repository uses MIT. See `docs/hackathon-requirements.md`.

Submission deadline: **October 23, 2026 at 12:00 PM PDT**.

## Core docs

- `BOOT.md` - compact repository context and workflow
- `AGENTS.md` - agent implementation rules
- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/PRODUCT-MODEL.md`
- `docs/ARCHITECTURE.md`
- `docs/workflow.md`
- `docs/publishing.md`
- `docs/hackathon-requirements.md`
- `docs/roadmap/mvp-roadmap.md`
- `docs/tasks/p0/` - staged Sol Prompt Stack

## Prompt Stack workflow

Documentation:

`/docs-review -> explicit approval -> /docs-apply`

Implementation:

`/prompt-ass -> /prompt-plan -> /prompt-write <folder>`

Local execution:

`npm run codex:stack -- p0`

Validate prompt grammar:

`npm run codex:stack:validate -- p0`

Run runner regressions:

`npm run test:runner`

P2 television kernel: `@firelaunch/tv` projects validated ChannelSpec into ordered page/module/content
semantics and pure D-pad/Back transitions. `@firelaunch/generator` writes a new, non-overwriting
React Native for Vega source tree from that projection. The checked-in template is at
`templates/vega-channel/`; `firelaunch.json` records its fingerprint and unresolved local
artwork paths. An `assets/` path is not embedded automatically; supply licensed artwork
before a real build. The generated tree is not a build artifact.

Run `npm run doctor:vega` to inspect local Node/npm, ADBT context, SDK path, CLI, adb and
device visibility. It never asserts build readiness. This checkpoint has not performed a
Vega SDK build or device/simulator run; those require installed platform tooling and P7
qualification. P3 should consume `@firelaunch/tv` rather than implement separate preview
navigation semantics.

P3 Creator Studio: in two terminals run `npm run dev` for the local API and
`npm run dev:studio` for the React UI, then open `http://127.0.0.1:4173`.
New Channel creates a persisted project, optionally with original procedural sample media;
Design and Content edits use the revision-checked channel mutation API. The TV Preview
uses the shared `@firelaunch/tv` projection and transitions. Use arrow keys, Enter and
Escape (except while typing in a form), or the on-screen remote. The sample clip is
generated specifically for this repository and served by the local Vite Studio; its
`127.0.0.1:4173` URL is a development fixture, not a deployable Vega media host.
Replace that URL and any `assets/` artwork with rights-cleared, reachable media before
building a standalone TV project. The Create agent area is active in P4;
Code, Build and Publish are active local workflows; none imply a successful Vega build or Amazon submission.
Run `npm run test -w @firelaunch/studio` for focused Preview and sample tests.

P4 Channel Agent: onboarding accepts an optional initial request, then Create offers refinement and a bounded activity transcript. By default `FIRELAUNCH_AGENT_PROVIDER=mock` gives deterministic offline behavior (for example, `add page Explore`, `primary color to #aabbcc`, or `add text module About with body Hello`). For real tool use set `FIRELAUNCH_AGENT_PROVIDER=bedrock`, `BEDROCK_MODEL_ID` to an accessible Converse-capable model and `AWS_REGION` to its region; the AWS SDK uses its normal credential resolution chain. `GET /api/projects/:id/agent-status` reports configuration, not model access or credential verification. `POST /api/projects/:id/agent` accepts `{ "expectedRevision": 1, "message": "add page Explore" }`, persists each validated mutation and returns `{ provider, status, project, events }`. Malformed/unsupported tools refuse; partially saved operations remain visible and revisioned. No AWS credentials are required for tests. The model has no filesystem, shell or arbitrary JSON-replacement tool.

P5 Code generates an ordinary Vega tree in `.firelaunch-data/projects/<id>/generated/` (or under `FIRELAUNCH_DATA_DIR`). The file tree and bounded text editor use hash-checked saves. Regeneration is explicit and refuses any custom or unknown source change; preserve or restore edits yourself first. ChannelSpec changes mark source stale rather than overwriting it. `GET/POST /api/projects/:id/code`, `GET/POST /api/projects/:id/code/file` (GET uses `?path=`), `GET/POST /api/projects/:id/build`, `GET /api/projects/:id/readiness` and `POST /api/projects/:id/bundle` back the Studio surfaces. The local bundle contains readiness JSON, draft store copy, an asset/screenshot inventory and a creator checklist.

Build is opt-in and executes only the configured verified `VEGA_CLI_PATH` with `build -b Release` in the generated project; it requires P2 doctor evidence for Node 24.15+, npm 12, Vega SDK and CLI. It captures bounded process output, exit status and duration, and records a fresh nonempty release `.vpkg` path, size and SHA-256 only after verification. Missing prerequisites or a missing artifact remain blocked/failed. The current environment lacks npm 12, Vega SDK/CLI and a device; no real build/device claim is made. Supply rights-cleared media, store assets, support/privacy metadata and actual device evidence before submission. Amazon Developer Console upload and submission remain human actions.

Canonical vocabulary: **Prompt Stack** is the common name for phase and correction stacks.

## External platform references

- Amazon Devices Builder Tools for AI: https://developer.amazon.com/docs/adbt/home
- Vega OS development: https://developer.amazon.com/apps-and-games/blogs/2026/07/guide-to-building-for-fire-tv-on-vega-os
- Amazon Appstore submission: https://developer.amazon.com/docs/app-submission/submitting-apps-to-amazon-appstore.html
- Hackathon: https://amazonappdev2026.devpost.com/

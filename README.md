# FireLaunch

FireLaunch is an agentic studio for creating branded television channels and shipping them as real Amazon Fire TV applications.

The hackathon MVP is deliberately narrow: describe a channel, generate a structured ChannelSpec, preview and navigate it like a TV app, refine it conversationally, inspect/edit the generated source, produce a React Native for Vega project, and take it through build and Amazon Appstore readiness.

> Prompt -> ChannelSpec -> TV preview -> Vega source -> VPKG -> Fire TV

## Current gate

FireLaunch's P1 product kernel is at **0.0.1**. The active implementation plan is the staged **P0 FireLaunch Hackathon MVP Prompt Stack** in `docs/tasks/p0`.

P1 provides a local Node API and no Studio UI yet. With Node 24 and npm 12, run `npm install`, `npm run check`, and `npm run dev` (or `npm start` for compiled output). It listens on `127.0.0.1:4174` by default. Set `PORT` and `FIRELAUNCH_DATA_DIR` to override the port and local data root. Project data under `.firelaunch-data/projects/<channel-id>/project.json` is excluded from Git.

`POST /api/projects` accepts `{ "title": "Wild Earth" }` and optional `slug`; `GET /api/projects` lists projects, `GET /api/projects/:id` reads one, `PUT /api/projects/:id` accepts `{ "expectedRevision": 1, "spec": { ... } }`, and `POST /api/projects/:id/mutations` accepts `{ "expectedRevision": 1, "mutation": { ... } }`. Writes return the full project with an incremented revision; stale writes return 409. Invalid input returns 400. Only ChannelSpec v1 is accepted; no migration from older or future schema versions is implemented yet. The server binds loopback only and has no authentication or cloud access.

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

Canonical vocabulary: **Prompt Stack** is the common name for phase and correction stacks.

## External platform references

- Amazon Devices Builder Tools for AI: https://developer.amazon.com/docs/adbt/home
- Vega OS development: https://developer.amazon.com/apps-and-games/blogs/2026/07/guide-to-building-for-fire-tv-on-vega-os
- Amazon Appstore submission: https://developer.amazon.com/docs/app-submission/submitting-apps-to-amazon-appstore.html
- Hackathon: https://amazonappdev2026.devpost.com/

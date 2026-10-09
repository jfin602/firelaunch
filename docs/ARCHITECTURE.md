# FireLaunch Architecture

## Objective

Make the common creator workflow deterministic enough to validate while retaining an explicit code escape hatch.

Dependency direction:

Studio UI
-> application services
-> ChannelSpec / channel engine
-> agent tools, preview projection, generator, readiness
-> adapters: filesystem, Bedrock, Vega toolchain

Generated Vega source is an output of the domain, not the source of truth for ordinary edits.

## Planned P0 repository shape

apps/
  studio/             React + TypeScript + Vite creator UI
  server/             Node + TypeScript local API/orchestration

packages/
  contracts/          ChannelSpec schemas and API contracts
  channel-engine/     validation, mutations, selectors, migrations
  agent/              provider-neutral ChannelAgent + Bedrock/mock adapters
  generator/          deterministic Vega project generation
  readiness/          build/publish checks and submission bundle logic

templates/
  vega-channel/       checked-in React Native for Vega application template

The preview can live in studio if TV rendering/navigation primitives remain independent from editor chrome.

## Process model

P0 is a local application.

The studio talks to the local server. The server owns filesystem persistence, generated-project access, model calls and local toolchain processes. Browser code does not receive arbitrary filesystem authority.

## Local storage

Default data root: .firelaunch-data/ (gitignored).

Suggested shape:

.firelaunch-data/
  projects/<project-id>/
    project.json
    channel.json
    assets/
    agent/
    generated/
    builds/
    submission/

All path operations enforce project-root containment and reject traversal/symlink escape where applicable.

## ChannelSpec

Use Zod or equivalent runtime schema.

Requirements:
- explicit schemaVersion
- stable IDs
- strict parsing at persistence/API boundaries
- sensible bounded strings/arrays
- migration hook from day one
- pure mutation functions
- no executable code inside ChannelSpec

Persist atomically.

## Preview parity

Do not build a bespoke preview that only looks similar.

Extract semantic TV components/rules so preview and generated Vega project implement the same page/module kinds, ordering, content resolution, brand tokens, focus/navigation intent and detail/playback transitions.

## TV navigation

Represent focusable elements with stable IDs and deterministic directional order.

Required behavior:
- arrows/D-pad move focus
- Enter/select activates
- Escape/back returns predictably
- page transitions establish deterministic initial focus
- focus never disappears
- virtual remote and keyboard drive the same command abstraction

Tests exercise navigation as commands, not mouse clicks.

## Agent architecture

ChannelAgent accepts project/channel context, visible user request and bounded tools.

Primary adapter: Bedrock Converse/tool use, configured by environment. Do not hardcode credentials. BEDROCK_MODEL_ID is configuration.

Mock adapter is deterministic and clearly labeled.

Agent tools call channel-engine functions. Model output is never applied before schema/tool validation.

## Code customization

Generation writes a complete Vega source tree.

Code surface provides project file tree, text editing for safe text files, save, changed-state indication and regenerate.

Contain edits within generated/.

Regeneration cannot silently erase custom edits. Detect dirty generated files and require a deliberate strategy.

## Vega integration

Target React Native for Vega.

Use Amazon Devices Builder Tools for AI context when available. Node 24 is the repository baseline because it satisfies current ADBT guidance and avoids the documented Node 26 SQLite compatibility issue.

Provide a toolchain doctor that reports Node, ADBT context where detectable, Vega SDK/dev tools, simulator/device visibility where detectable and exact missing prerequisites.

Generated manifest must include:
com.amazon.category.main

For a target using Vega SDK 0.24, the generated `manifest.toml` must also include `[os.version]` with compatible `target` and `min` (both `1.2` for Vega OS 1.2 in SDK 0.24), and matching package/runtime dependencies. Verify these requirements against the *installed* SDK; do not assume that the currently generated template or a declared npm dependency has been qualified. The `c0-real-tv-qualification` correction owns any compatibility repair demonstrated by real SDK validation.

Do not invent Vega CLI commands. Inspect installed tooling and current Amazon documentation/ADBT context during implementation.

Build execution is explicit, project-contained, bounded, captures output, and verifies artifact existence. Real qualification must record SDK/CLI version, target/runtime compatibility, exact invoked command and exit status, fresh nonempty `.vpkg` path and SHA-256, and evidence that the *same artifact* was installed on the target. Build output or generated source alone is insufficient. The current build wrapper command must be checked against the installed SDK before claiming compatibility.

## Publish/readiness

Readiness is a set of independently reported checks:
- channel/schema
- TV interaction
- Vega manifest/project
- build artifact
- store assets/copy
- support/privacy metadata
- device/simulator evidence
- human Amazon Console steps

## Security

- no credentials in repository/project JSON
- environment-based AWS auth
- path containment
- bounded assets
- safe media URLs
- no arbitrary server command endpoint
- generated code editing restricted to project workspace
- strict JSON parsing
- no HTML injection from model/content text

## Testing

T1 unit: ChannelSpec, mutations, migrations, focus commands, readiness.

T2 integration: persistence, API, agent tool execution, generator, custom-edit protection, process doctor/build wrapper.

T3 product: browser golden path and actual Vega simulator/device evidence.

P7 originally owned T3 final browser/platform closeout; after its NOT GREEN disposition, `c0-real-tv-qualification` owns targeted real Vega and device requalification. P2 owns only the earlier TV semantics/generator/toolchain discovery foundation.

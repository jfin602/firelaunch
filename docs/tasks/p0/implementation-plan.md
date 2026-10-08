# p0 — Source-aware implementation plan

Status: Approved staged implementation plan at bootstrap `0.0.0`.

The repository currently contains documentation and the Prompt Stack runner but no product implementation. Every prompt must inspect current HEAD before editing because prior P0 checkpoints will progressively create the source tree.

## P1 — Product kernel / 0.0.1

### Owns

Repository/application shell:
- Yarn workspace
- TypeScript configuration
- root start/build/typecheck/test/check commands
- `apps/server`
- `packages/contracts`
- `packages/channel-engine`

Channel domain:
- strict ChannelSpec v1
- stable IDs
- brand/navigation/page/module/content contracts
- pure validated mutations/selectors
- schema migration seam

Persistence/API:
- local project repository under `.firelaunch-data/`
- atomic writes
- project/path containment and symlink safety
- create/list/read/update project API
- bounded error contracts
- fixture helpers for later prompts

### Does not own

Studio UI, TV renderer, Vega generation, AI, code editor, build execution or publish readiness.

### Validation

Focused contract/channel-engine/persistence/API tests, affected build/typecheck and `git diff --check`.

## P2 — Television kernel / 0.0.2

### Owns

Shared television semantics:
- bounded TV module semantic model from ChannelSpec
- content resolution
- navigation commands
- focus identity/order/transitions
- page/detail/playback state contracts

Vega generator:
- `packages/generator`
- `templates/vega-channel`
- deterministic generation from ChannelSpec + template/runtime version
- manifest with `com.amazon.category.main`
- generated-project metadata/fingerprint
- generation contract/snapshot tests

Platform discovery:
- inspect current Amazon Devices Builder Tools context and installed Vega tooling
- toolchain doctor contract
- exact detected/missing prerequisites
- no guessed build command
- record actionable friction in `docs/feedback-log.md`

### Does not own

Polished Studio, Bedrock agent, source editor, build execution or publish UI.

### Validation

Generator determinism/manifest, TV semantic/focus contract tests, doctor tests, affected build/typecheck and `git diff --check`.

## P3 — Creator Studio / 0.0.3

### Owns

`apps/studio` React + TypeScript + Vite creator application:
- progressive new-channel onboarding
- project/channel shell
- Create/Agent placeholder surface without real agent behavior
- Design
- Content
- central 16:9 TV Preview

Preview:
- hero/rail/grid/detail/playback projection
- keyboard arrows/Enter/Escape
- virtual remote using the same command abstraction
- obvious focus treatment
- deterministic back/initial focus
- rights-safe sample media
- responsive creator shell without treating TV preview as a web page

### Boundary

Preview must consume P2 TV semantics; do not create a second independent channel/runtime model.

### Validation

Focused Studio/component/navigation tests, browser automation where deterministic/headless, studio build/typecheck and `git diff --check`.

## P4 — Channel Agent / 0.0.4

### Owns

`packages/agent` and server/UI integration:
- provider-neutral ChannelAgent
- structured tool schemas over channel-engine
- deterministic mock adapter
- real Amazon Bedrock Converse/tool-use adapter
- environment/config provider selection
- bounded user-visible transcript/status/errors
- safe handling of malformed/refused tool calls
- Studio agent interaction

Tools cover:
- inspect channel
- set brand
- add/update/remove/reorder pages/modules/content
- validated bounded patch where useful

### Boundaries

- model never writes project files directly;
- model cannot run shell commands;
- model output is validated before mutation;
- tests do not require AWS credentials;
- real Bedrock evidence is recorded only when an actual call succeeds.

### Validation

Tool schema/mutation/mock/provider adapter tests, integration with persisted projects/Studio, affected build/typecheck and `git diff --check`.

## P5 — Code, Build and Publish / 0.0.5

### Owns

Code:
- generated-project file tree
- safe text read/edit/save
- project containment
- changed/custom state
- explicit regeneration behavior that cannot silently overwrite custom edits

Build:
- server-side toolchain doctor integration
- bounded argv-based process execution in generated project
- use detected/documented real Vega commands only
- captured output/status
- artifact existence verification
- artifact metadata/hash where practical

Publish:
- grouped readiness model
- build/experience/store/compliance/device/human groups
- store copy/release-note preparation
- submission bundle files
- clear Amazon Developer Console human handoff
- no credential capture or fake submission

### Validation

Generated edit/regeneration protection, process safety, readiness and submission bundle tests; real build if tooling is available; affected build/typecheck and `git diff --check`.

## P6 — Hackathon convergence / 0.0.6

### Owns

Cross-system integration rather than new architecture:
- polished rights-safe Wild Earth fixture
- full deterministic golden path
- Create -> Preview -> Design/Content -> Agent -> Code -> Build -> Publish
- restart/reload coherence
- edge/error-state cleanup
- UX/readability polish
- aggregate test/build/typecheck/check
- README exact setup/run commands
- `MODULES.md` reflecting implemented source
- demo-plan alignment
- feedback-log updates from actual Amazon tooling

P6 may fix bounded integration defects discovered while joining P1-P5. It must not broaden scope into deferred SaaS/platform features.

### Validation

Root aggregate `check`, focused golden-path/browser automation where available, `git diff --check`.

## P7 — Real platform qualification / 0.0.7

P7 is the sole final closeout/manual browser prompt.

It owns evidence, not broad implementation:
- clean-start README flow
- real browser golden path
- persistence/restart
- Bedrock proof if claimed
- generated Vega source/manifest inspection
- custom-code preservation
- real Vega toolchain identity
- real VPKG artifact/hash
- simulator or Fire TV launch/navigation
- truthful Publish/submission bundle
- aggregate check
- three-minute demo rehearsal
- final `closeout.md`

A remaining source defect => NOT GREEN + bounded correction stack.

## Cross-cutting invariants

- ChannelSpec remains canonical.
- Preview and generated runtime share semantic contracts.
- No credentials in project/repository state.
- No unbounded arbitrary command endpoint.
- No fabricated external validation.
- No silent overwrite of custom generated code.
- Creator owns generated project and Amazon account.
- Deferred features stay deferred.

## Validation economy

P1-P5 run focused validation only.
P6 owns the first full aggregate convergence check.
P7 owns final aggregate + manual browser/device proof.

This keeps checkpoint evidence useful without repeatedly paying for whole-repository validation.

# p0 — Source-aware implementation plan

Status: Greenfield plan at repository 0.0.0.

P1 must inspect the current repo because bootstrap files/runner are already source.

## A. Repository/application shell

Create a Yarn workspace TypeScript monorepo matching docs/ARCHITECTURE.md.

Expected:
- apps/studio
- apps/server
- packages/contracts
- packages/channel-engine
- packages/agent
- packages/generator
- packages/readiness
- templates/vega-channel

Provide a simple root developer flow and aggregate check.

## B. Contracts and persistence

Define strict ChannelSpec v1 and API contracts.

Implement stable IDs, pure validated mutations, atomic local persistence, path containment, schema migration seam and sample project creation.

No database.

## C. Channel agent

Create provider-neutral tool-driven ChannelAgent.

Implement deterministic mock adapter and Bedrock Converse adapter using AWS SDK.

Tools cover brand/navigation/pages/modules/content.

No arbitrary filesystem/shell authority from model output.

Show provider/status clearly in Studio.

## D. Studio

Build a polished dark creator UI.

Surfaces:
- Create/Agent
- Design
- Content
- Code
- Build
- Publish

TV Preview stays visually central.

Onboarding reveals complexity progressively.

## E. TV Preview

Render 16:9 ChannelSpec with hero, rails, detail, playback, visible focus, keyboard arrows/Enter/Escape and virtual remote using the same navigation commands.

Use rights-safe sample media/assets.

## F. Generator/code

Generate a real source tree from ChannelSpec + checked-in Vega template/runtime.

Code surface includes tree, read/edit/save safe files, changed state and regenerate.

Protect custom edits from destructive regeneration.

Generated manifest includes com.amazon.category.main.

## G. Vega build

Implement server-side toolchain doctor and bounded build wrapper.

Do not invent commands.

During P1 inspect current Amazon Devices Builder Tools/Vega context available to the environment and installed tool help/version output.

If toolchain absent, return exact missing prerequisites.

Build success requires artifact existence.

## H. Publishing

Generate grouped readiness checks and local submission bundle.

Write useful store copy.

Separate automated Green checks, missing external evidence, creator questions and human Developer Console steps.

## I. Tests

Use Vitest/node tests and browser tests where useful.

Cover:
- ChannelSpec parse/mutate/migrate
- persistence/path containment
- agent tool application/mock behavior
- generator determinism/manifest
- custom-edit protection
- focus/navigation
- readiness
- API happy/error paths
- creator golden path

Root check builds/typechecks/tests the workspace.

## J. Docs/evidence

Update README exact setup/run commands.

Create MODULES.md from implemented source.

Update docs/feedback-log.md for actual Amazon-tool friction.

Do not mark external platform steps complete without evidence.

## P2 handoff

P1 reports exact validation commands/counts, whether Bedrock was called, whether Vega tooling was available, whether VPKG was actually produced and exact P2-required external steps.

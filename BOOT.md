# FireLaunch Boot Context

Read this file before substantial repository-aware work.

## Mission

FireLaunch is a code-optional agentic studio for creating branded TV channels and shipping them as real Amazon Fire TV applications.

The hackathon product must prove one golden path:

Creator intent
-> structured ChannelSpec
-> interactive 10-foot TV preview
-> conversational refinement
-> accessible generated code
-> React Native for Vega project
-> build/readiness evidence
-> real Fire TV or Vega simulator demo

FireLaunch is not merely an AI code generator and not a generic website builder. The durable product abstraction is the channel.

## Current gate

Current package version: `0.0.7`. The P0 implementation stack executed, and P7 closed **NOT GREEN** on 2026-10-08. Its browser evidence is preserved in `docs/tasks/p0/closeout.md`.

Active correction: `docs/tasks/c0-real-tv-qualification/`. This correction is scoped to real Vega toolchain/package/device proof and a separately evidenced real Bedrock request if the broad natural-language claim is retained. No VPKG, device pass, or successful Bedrock call is yet claimed.

P0 is a staged Sol implementation stack with six runner-owned implementation checkpoints and one final manual/browser qualification gate:

1. P1 / 0.0.1 - repository foundation, ChannelSpec, channel engine, persistence and API skeleton
2. P2 / 0.0.2 - shared TV semantics, Vega generator, manifest and toolchain discovery
3. P3 / 0.0.3 - Creator Studio, TV Preview, D-pad/focus and playback
4. P4 / 0.0.4 - ChannelAgent, validated tools, mock provider and real Bedrock adapter
5. P5 / 0.0.5 - Code, regeneration protection, Build and Publish/readiness
6. P6 / 0.0.6 - golden-path integration, Wild Earth fixture, regression and polish
7. P7 / 0.0.7 - independent browser + real Vega qualification and closeout

P7 was Not Green. The active bounded correction is `c0-real-tv-qualification`; it does not rerun P0 or erase the original P7 disposition. Platform prerequisites must be proven before build/runtime qualification, and qualification must stop truthfully if external tools or a test target cannot be provisioned.

## Locked product decisions

- Vega OS first.
- React Native for Vega is the generated TV target.
- ChannelSpec is canonical application state for the golden path.
- Preview and generated TV app must consume the same semantic state.
- Agent mutations are structured and bounded before arbitrary code editing.
- Generated source is always inspectable and editable.
- Creator owns source, content, Amazon account, listing and artifacts.
- Local single-user persistence is enough for the hackathon. No auth, billing or multi-user system in P0.
- Amazon Devices Builder Tools for AI should be used when available for Vega-specific grounding and validation.
- The runtime channel agent is provider-neutral. Bedrock is the primary real integration for the hackathon; deterministic mock mode keeps tests and offline demos reproducible.
- FireLaunch may prepare Amazon submission assets/readiness but must not pretend it submitted an app when a real Developer Console action was not performed.
- Never report a VPKG, simulator pass, device pass or Appstore readiness item as successful without direct evidence.

## Canonical docs

Product authority:
- docs/VISION.md
- docs/PRINCIPLES.md
- docs/PRODUCT-MODEL.md
- docs/ARCHITECTURE.md

Delivery authority:
- docs/workflow.md
- docs/roadmap/mvp-roadmap.md
- docs/hackathon-requirements.md
- docs/publishing.md
- docs/tasks/p0/

## Workflow

Documentation:

/docs-review -> explicit approval -> /docs-apply

Implementation:

/prompt-ass -> /prompt-plan -> /prompt-write <folder>

Prompt Stack is the canonical name for both phase and correction stacks.

Plan richly; prompt sparsely; validate rigorously.

Each successful implementation prompt is a checkpoint and should make the next prompt easier to reason about. Prefer bounded work with focused tests over paying a stronger model to repeatedly rediscover the whole project.

Model policy:
- GPT-6 Sol Medium: default bounded routine work.
- GPT-6 Sol High: P0 implementation, qualification and architecture-sensitive corrections.
- GPT-6 Sol XHigh: exceptional review/repair only.
- GPT-6 Astra High: exceptional escalation for a genuinely cross-system blocker where the long-horizon advantage justifies the cost.

The Prompt Stack runner owns implementation commits. Agents executed by the runner must not commit manually.

## Definition of hackathon Green

Green is not "the studio looks good."

Green requires direct evidence that:
- the creator can create a channel from a prompt;
- ChannelSpec changes drive preview changes;
- D-pad/keyboard focus navigation is coherent;
- content/detail/playback flow works with demo media;
- the generated Vega project is real source, not a fake code preview;
- the toolchain can produce a real Vega build artifact in the qualified environment;
- the project runs on a Vega simulator or Fire TV for the demo;
- publish readiness clearly distinguishes automated checks from human Amazon Console steps;
- repository setup/run instructions are sufficient for judging;
- the three-minute demo path is rehearsable.

If real Vega build/device evidence is unavailable, P7 must be Not Green even if the browser studio is polished.

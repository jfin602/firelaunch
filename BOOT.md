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

Repository baseline: 0.0.0.

The active Prompt Stack is docs/tasks/p0.

P1 is a deliberate GPT-6 Astra one-shot that owns the complete hackathon MVP implementation. P2 is the only final qualification/closeout prompt. If P2 is Not Green, create bounded c0-* correction Prompt Stacks. Do not silently turn the one-shot into an indefinite implementation loop.

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

P0 is an explicit exception to the ordinary small-prompt preference because the owner chose an Astra greenfield one-shot. The exception applies only to P1 scope. Subsequent repairs should be small and evidence-driven.

Model policy:
- GPT-6 Astra High: exceptional greenfield whole-product implementation, currently P0/P1.
- GPT-6 Sol High: qualification, difficult corrections and architecture-sensitive repairs.
- GPT-6 Sol Medium: routine bounded work.

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

If real Vega build/device evidence is unavailable, P2 must be Not Green even if the browser studio is polished.

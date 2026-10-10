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

Current phase root version: `0.2.0` (hosted creator platform P2 activation baseline). P1 contracts/feasibility closed GREEN / QUALIFIED at `0.1.5` on 2026-10-09 (committed 2026-10-10). P0 finished at 0.0.7 with historical P7 NOT GREEN. The c0 repair loop ended BLOCKED / NOT GREEN on 2026-10-09, and its evidence is preserved in docs/tasks/c0-real-tv-qualification/qualification-loop/qualification-closeout.md.

Observed c0 correction: a real release VPKG and Vega VirtualDevice focus/detail/playback/Back were proven for a tested candidate. Live Bedrock, formal Linux Mint host support, final Studio browser/Publish/aggregate checks, default demo media and physical Fire TV remain unqualified. P1-P3 SaaS may proceed independently. P4 requires a real non-mock supported provider; later phases retain physical TV/Appstore gates.

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

## Post-P0 SaaS active phase

P1 contract/feasibility scope is GREEN / QUALIFIED (docs/tasks/p1/closeout.md), not hosted SaaS qualification. The active phase is P2 at docs/tasks/p2/: authenticated independent CreatorAccounts, Postgres and transaction-safe ownership, tenant-scoped APIs/source/export access, private storage, migration from P0 local projects, backups/recovery and browser security evidence. P2 starts from committed root 0.2.0. Do not confuse the 0.2.0 phase activation baseline with its P7 closeout target 0.2.7. No AWS/Bedrock, Amazon seller credentials, real TV or Appstore approval is a P2 qualification prerequisite. Old P0 local loopback behavior must not accidentally become a public multi-tenant API. The historical P0 paragraphs below remain unchanged in meaning.

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

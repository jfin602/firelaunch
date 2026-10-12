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

Current root activation version: `0.5.0` (Phase 5 Live Channel Delivery, 2026-10-11). `c4-fix` closed LOCAL GREEN at `0.4.8` (commit `00e3df5`, full root check passed); historical Phase 4 P8 remains NOT GREEN because no live non-mock catalog-grounded saved mutation and Preview were observed. Hosted release remains NOT QUALIFIED. Phase 5 implements creator-approved immutable public manifests, HTTPS resolver and installed Vega client refresh/cache/rollback, targeting the same installed VPKG on Vega VirtualDevice. Physical Fire TV is deferred to launch Phase 8; VirtualDevice is acceptable for Phase 5 GREEN, but cannot prove physical compatibility. AWS verification and production VPS are not Phase 5 entry requirements. P1 contracts/feasibility closed GREEN / QUALIFIED at `0.1.5`. Phase 2 implementation reached `0.2.7`, but its P7 closeout remains NOT GREEN; `c2-hosted-qualification` stopped BLOCKED / NOT GREEN after 2/5 cycles. Their remaining security/staging proof is explicitly carried into Phase 3 and must not be described as passed. P0 finished at `0.0.7` with historical P7 NOT GREEN. The `c0-real-tv-qualification` repair also ended BLOCKED / NOT GREEN on 2026-10-09, with partial virtual-TV successes only.

Observed c0 correction: a real release VPKG and Vega VirtualDevice focus/detail/playback/Back were proven for a tested candidate. Live Bedrock, formal Linux Mint host support, final Studio browser/Publish/aggregate checks, default demo media and physical Fire TV remain unqualified. P1-P3 SaaS may proceed independently. P4 requires a real non-mock supported provider; later phases retain physical TV/Appstore gates.

P0 is a staged Sol implementation stack with six runner-owned implementation checkpoints and one final manual/browser qualification gate:

1. P1 / 0.0.1 - repository foundation, ChannelSpec, channel engine, persistence and API skeleton
2. P2 / 0.0.2 - shared TV semantics, Vega generator, manifest and toolchain discovery
3. P3 / 0.0.3 - Creator Studio, TV Preview, D-pad/focus and playback
4. P4 / 0.0.4 - ChannelAgent, validated tools, mock provider and real Bedrock adapter
5. P5 / 0.0.5 - Code, regeneration protection, Build and Publish/readiness
6. P6 / 0.0.6 - golden-path integration, Wild Earth fixture, regression and polish
7. P7 / 0.0.7 - independent browser + real Vega qualification and closeout

Historical P0 P7 was NOT GREEN. The completed `c0-real-tv-qualification` correction did not erase that disposition. Platform prerequisites must be proven before build/runtime qualification, and qualification must stop truthfully if external tools or a test target cannot be provisioned.

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

Phase 1 contract/feasibility work is GREEN / QUALIFIED. Phase 2 Hosted Creator Platform has an implementation and local evidence baseline at `0.2.7` but **P2 P7 is NOT GREEN**, and c2's independent follow-up is **BLOCKED / NOT GREEN (2/5 cycles)**. Preserve both reports at docs/tasks/p2/closeout.md and docs/tasks/c2-hosted-qualification/closeout.md; do not rewrite or retroactively promote either.

**Phase 3 Catalog Import and Discovery** begins at root `0.3.0` under docs/tasks/p3/. Phase 3 builds tenant-owned catalog persistence, creator CSV/JSON and bounded HTTPS feed import, media and rights controls, Collections and Studio onboarding. Phase 3 begins with automated tenant-isolation regression testing; real concurrent two-profile browser qualification is deferred to P3 P8 and remains unproven until directly exercised. Its final qualification must report HTTPS-staging OIDC secure-cookie and private S3 recovery separately. No P2/c2 GREEN claim or production deployment is available until the security gates are actually evidenced. Amazon source retrieval, live AI, remote manifest delivery and scheduled syncing remain later gated work. Historical P0 sections below remain unchanged in meaning.

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


## Next approved foundation (documentation-only, 2026-10-11)

After the independently qualified existing P5 (0.5.x) remote-manifest phase, implement **P6 AWS Media Foundation (0.6.x)**: creator-authorized direct uploads to private S3, FFmpeg worker not on muffinos, validated HLS renditions, and private S3+CloudFront OAC delivery to a qualified Vega client. Initial free-to-view publishing only. The planned later phases shift to P7 catalog sync, P8 creator-owned publishing and P9 launch/hardware/Appstore. Do not change historical P5 P8 prompt requirements, Phase 4/P2/c2 results, or claim that AWS, native playback, subscriptions or production hosted security are qualified. See ADR 0010 and docs/integrations/aws-media-delivery.md. P6 has no authored executable Prompt Stack yet.

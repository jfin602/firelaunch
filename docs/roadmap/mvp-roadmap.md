# FireLaunch MVP Roadmap

Bootstrap date: 2026-10-08.
Hackathon deadline: 2026-10-23 12:00 PM PDT.

## Gate 0 — Bootstrap — 0.0.0

Deliver:
- foundational docs
- Prompt Stack runner adapted from Dope
- runner regression coverage
- P0 staged Sol Prompt Stack
- hackathon/publishing requirements snapshot
- public MIT license

## P0 — FireLaunch Hackathon MVP — 0.0.1 -> 0.0.7

P1 / 0.0.1 — Product kernel
GPT-6 Sol High.
Repository/workspace foundation, ChannelSpec, channel engine, local persistence and API skeleton.

P2 / 0.0.2 — Television kernel
GPT-6 Sol High.
Shared TV semantics, React Native for Vega generator/runtime, manifest, focus contracts and ADBT/Vega toolchain discovery.

P3 / 0.0.3 — Creator Studio
GPT-6 Sol High.
Creator onboarding, Design/Content surfaces, interactive TV Preview, virtual remote, D-pad/focus, detail and playback.

P4 / 0.0.4 — Channel Agent
GPT-6 Sol High.
Provider-neutral ChannelAgent, validated mutation tools, deterministic mock and real Bedrock adapter.

P5 / 0.0.5 — Code, Build and Publish
GPT-6 Sol High.
Generated-source editing, regeneration protection, real toolchain build wrapper, readiness model and submission bundle.

P6 / 0.0.6 — Hackathon convergence
GPT-6 Sol High.
Golden-path integration, Wild Earth fixture, cross-system regression, UX polish, aggregate docs/setup readiness.

P7 / 0.0.7 — Qualification closeout
GPT-6 Sol High with browser/manual gate.
Independent real browser, VPKG and Vega simulator/Fire TV qualification. No broad implementation.

P0 Green requires Prompt -> Product -> Real Television.

## Correction window — c0-*

P7 closed **NOT GREEN** at version `0.0.7` on 2026-10-08. Browser Studio, persistence, Preview and generated source were exercised, but no real Bedrock call, verified VPKG or simulator/Fire TV run was available; see `docs/tasks/p0/closeout.md`.

### Active: `c0-real-tv-qualification` (documentation/planning gate)

One bounded correction stack combines the P7 proposals `c0-vega-real-tv` and `c0-prompt-first` to avoid competing remediation ownership. Preserve the passing P0 product and historical closeout.

1. **P1 — Platform prerequisites and compatibility:** identify a supported, accessible build host and real installed Vega SDK/CLI plus an actual VVD/Fire TV target; inspect generated manifest/dependency compatibility, replace device-inaccessible loopback demo media, and package TV-compatible rights-cleared artwork. Stop with an explicit blocker if prerequisites are unavailable.
2. **P2 — Real build and provider evidence:** validate/repair only source defects found by the actual toolchain, produce a fresh release VPKG with path, SHA-256, exact toolchain identity and logs; exercise a live Bedrock natural-language request if making the broad agent claim. A configured adapter or mock success is not live proof.
3. **P3 — Independent device qualification and closeout:** install the same artifact on the supported target, capture real launcher/focus/detail/playback/Back evidence, verify truthful Publish readiness and rehearse the under-three-minute demo. Perform one final aggregate check and write GREEN or NOT GREEN with specific evidence.

New Vega SDK 0.24 tooling requires explicit OS target/minimum version in the manifest (OS 1.2 in that release); inspect the *installed* SDK version and dependencies before selecting the compatible configuration. No installed SDK or chosen TV test target is claimed by this planning document.

Completion target: Prompt -> Product -> Real Television, with provider claims separately evidenced, and no false artifact/device/Console qualification. No redesign of ChannelSpec, Studio, runner, or deferred SaaS features. Use focused tests in implementation prompts; reserve global suite/device acceptance for closeout.

Astra may be selected exceptionally for a cross-system blocker that resists bounded Sol repair, not as the default.

## Submission window

Operating targets:
- Oct 8-10: P0 foundation through television kernel
- Oct 10-14: Studio/agent/deployment checkpoints and early Vega proof
- Oct 14-18: convergence, qualification and bounded repairs
- Oct 18-20: demo polish and recording rehearsal
- Oct 21-22: final recording, Devpost copy, feedback/friction log, buffer

## Post-hackathon

Only after submission:
- accounts/workspaces
- hosted persistence
- content integrations
- analytics
- monetization
- additional TV platforms
- supported Appstore update APIs

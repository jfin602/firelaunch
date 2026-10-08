# FireLaunch

FireLaunch is an agentic studio for creating branded television channels and shipping them as real Amazon Fire TV applications.

The hackathon MVP is deliberately narrow: describe a channel, generate a structured ChannelSpec, preview and navigate it like a TV app, refine it conversationally, inspect/edit the generated source, produce a React Native for Vega project, and take it through build and Amazon Appstore readiness.

> Prompt -> ChannelSpec -> TV preview -> Vega source -> VPKG -> Fire TV

## Current gate

FireLaunch is at **0.0.0 bootstrap**. The first implementation is a deliberate **GPT-6 Astra one-shot** in `docs/tasks/p0`.

- P1: Astra builds the complete hackathon MVP.
- P2: independent browser/Vega qualification and closeout.
- Any remaining defects become bounded `c0-*` correction Prompt Stacks rather than silently expanding P1.

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
- `docs/tasks/p0/` - Astra one-shot Prompt Stack

## Prompt Stack workflow

Documentation:

`/docs-review -> explicit approval -> /docs-apply`

Implementation:

`/prompt-ass -> /prompt-plan -> /prompt-write <folder>`

Local execution:

`yarn codex:stack p0`

Validate prompt grammar:

`yarn codex:stack:validate p0`

Canonical vocabulary: **Prompt Stack** is the common name for phase and correction stacks.

## External platform references

- Amazon Devices Builder Tools for AI: https://developer.amazon.com/docs/adbt/home
- Vega OS development: https://developer.amazon.com/apps-and-games/blogs/2026/07/guide-to-building-for-fire-tv-on-vega-os
- Amazon Appstore submission: https://developer.amazon.com/docs/app-submission/submitting-apps-to-amazon-appstore.html
- Hackathon: https://amazonappdev2026.devpost.com/

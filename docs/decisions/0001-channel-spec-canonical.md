# ADR 0001 — ChannelSpec is canonical

Status: Accepted
Date: 2026-10-08

## Decision

FireLaunch uses a versioned structured ChannelSpec as canonical state for the normal creator workflow.

Studio forms, agent tools, preview and generated Vega source are projections of the same semantic model.

## Why

Pure freeform code generation is difficult to validate, regenerate, preview consistently and explain to non-developers.

A small TV-specific model gives FireLaunch a reliable workflow while still permitting direct code edits as an advanced escape hatch.

## Consequences

- normal agent edits use validated tools;
- preview parity becomes testable;
- generation can be deterministic;
- ChannelSpec cannot contain arbitrary executable code;
- code overrides need explicit overwrite protection.

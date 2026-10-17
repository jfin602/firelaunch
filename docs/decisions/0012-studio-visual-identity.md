# ADR 0012 — Desert Heat Creator Studio visual identity

**Status:** Owner accepted design direction on 2026-10-17 UTC; **not implemented or qualified**.
**Specification:** [Studio visual baseline](../design/studio-visual-baseline.md).
**Reference:** [Original screenshot provenance and SHA-256](../design/references/README.md).

## Context

The existing creator Studio uses olive/lime accent colors in `apps/studio/src/style.css`, with an editor-first left sidebar, topbar, central TV Preview and inspector in `apps/studio/src/App.tsx`. The owner selected a new full-bleed dark-cinematic interface featuring a dimmed red slot canyon, charcoal elevated controls, warm orange/red buttons and genre-diverse movie art. This visual target goes beyond palette changes and includes layout/material/content behavior. The mockup includes fictional functions and states.

## Decision

1. Adopt **Desert Heat — Dark Cinematic** as the canonical *future Studio visual language*: colors, typography, layering, background, shadows/radii/borders, components, layout and responsive/accessibility behavior.
2. App reaches every browser edge with **no black screenshot matte**. Persistent real project sidebar/topbar and central flexible workspace coexist with genuine context/inspector controls and navigable 16:9 TV Preview. Tablet/mobile retain actions rather than clipping them.
3. Use a **separately sourced owned/licensed canyon image** under strongly darkened content areas. The approved composite image must not become a CSS background. Supply fallback and measure contrast/performance.
4. Orange-to-red glow/gradients are reserved for major real actions and active navigation; secondary controls and inputs are subdued charcoal with clear focus and error semantics.
5. Artwork **retains the color palette of the film** rather than FireLaunch branding, and comes from authorized creator sources or rights-safe demo fixtures; do not fabricate creator inventory or permissions.
6. Fictitious screenshot Templates, Community, Analytics, account names, film titles or progress metrics do **not** authorize product changes. Real Catalog, Source, Video Upload, Rights, Generate, Preview, Code, Build and Publish contracts take priority.
7. Creator-owned generated Vega app branding remains independent of Studio tokens, background, and typography.
8. The implementation requires separately approved bounded correction scope and real browser/a11y/functionality qualification; this ADR changes no versions, packages, staging, AWS, TV qualification or historical NOT GREEN findings.

## Consequences

Future creator-Studio work should share semantic tokens and component styling, use the owner reference as aesthetic target and qualify practical UX. Reject a superficial lime-to-orange token swap, always-bright canyon over input fields, color-tinted media covers, new fake features and applying Studio identity to each creator's television channel. Keep historic contracts and security/status evidence intact.

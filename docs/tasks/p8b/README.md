# P8B — Phase 8 Wave 2: Human-First Page Layout & Full-Screen Preview

**Status 2026-10-21:** Owner-approved design direction and documentation scope; **PLANNING ONLY — NO RUNNABLE PROMPTS, NO CODE OR VERSION BUMP, NOT QUALIFIED**. Phase 8 remains OPEN. This is the **continuation** of the initial `p8` Wave 1 stack, not a replacement for its existing P1–P5 or a new roadmap phase.

## Dependency and baseline

[Wave 1 P5](../p8/wave1-closeout.md) is **GREEN / DEPLOYED** for the tested Studio navigation, contextual inspector, creative review, and native Export workflow at **root/lock 0.8.4**, with a protected dated staging archive. Phase 8 is not globally closed. Inspect exact local Git HEAD, dirty P5 changes, origin/main and actual staging before writing or running Wave 2 prompts. GitHub source and a dated staging report do not prove the current laptop/worktree state.

The prior P8 P5 is a **manual Wave 1 milestone**, not an actual 0.8.5 version bump; do not call it Phase 8 final closeout. `p8b` is the planned continuation folder under the existing runner's pre-1.0 continuation grammar; final assigned versions must be derived from the **actual accepted package version and Git-verified checkpoint prefix** during `/prompt-plan`, not invented by this README. No `/activate` step. No changes to P8 P1–P5, C7 worker/ZIP or the owner-approved Phase 9 scope.

## Human-first product goal

A creator should be able to **Choose a layout → Choose content → Preview the actual TV page** in one clear flow, with attractive defaults and no technical editing vocabulary. Treat **Pages & Layout** as a first-class Channel workspace, not a web canvas builder. The detailed [human-first design specification](../../design/page-layout-human-first.md) is normative for controls, empty states, template defaults, affordances, keyboard/touch, save feedback, mobile behavior and TV parity. Retain the restrained Desert Heat Studio chrome and the already implemented **contextual-only inspector**.

## Wave 2 outcomes

1. **Three starting page templates.** New Home starts with **Hero**; additional pages default to **Rows** unless creator selects **Grid** or **Hero**. Creation asks for page name + a visually previewed layout choice. Scaffold valid starter sections and content-selection placeholders, never fake licensed video or publish a private draft. Templates seed ordered modules; users can customize their page later without being locked into a fixed page type.
2. **Pages & Layout workspace.** Rename the Channel subview **Pages & Shelves** → **Pages & Layout**. Show page list, large preview/editing center, and a contextual inspector only for actual selected page/section. Direct creator-language actions: Choose content, Change image, Edit text, Move up/down, Customize, Remove, Rename, New page. Show save/persistence feedback and protect unsaved edits.
3. **Six bounded section types.** Featured Hero, Content Row, Content Grid and Text Area reuse existing `hero/rail/grid/text` modules. Add Image Banner and Image + Text through narrowly validated shared contracts; copy/asset rights and existing projects stay safe. Style controls are presets (e.g., image crop, position, spacing, background, card density); **no freeform pixel canvas** or custom HTML/CSS.
4. **Full-screen interactive TV Preview.** A discoverable toolbar action reuses the SAME Preview state and D-pad/Back/playback behavior, supports Fullscreen API with accessible full-viewport fallback, preserves editor focus/scroll and distinguishes Exit full screen from TV Back.
5. **Wave 2 milestone qualification and protected staging release.** One real creator journey, targeted new schema/runtime/Preview parity tests and device proof for any new native section types, one final aggregate on exact candidate, then a protected exact-hash staging deployment and short signed-in browser smoke if valid scoped authorization is available. Record **Wave 2 GREEN/NOT GREEN** and owner-visible usability findings. **Do not close overall Phase 8** or activate Phase 9 merely because this wave passes.

## Proposed checkpoint split (not yet authored)

| Proposed step | Scope | Default validation ownership |
| --- | --- | --- |
| P1 | Page creation templates and Home default | Focused page/schema/mutation tests, no full builds |
| P2 | Pages & Layout editing and human-first contextual UX | Focused Studio keyboard/selection/persistence tests |
| P3 | Static image/text sections, safe customization and Studio/native parity | Focused contracts, TV projection/renderer, ownership and compatibility tests |
| P4 | Full-screen Preview and responsive keyboard/touch | Focused Preview state/fullscreen tests |
| P5 | Independent Wave 2 acceptance + staging rollout | One aggregate and small actual browser/device acceptance delta |

This split must be revisited at `/prompt-ass` to keep tasks <=8 minutes where feasible (15-minute hard ceiling), and to avoid forcing an unsafe schema/native change into one oversized prompt. Do not write executable `P*.txt` files or fake GREEN until explicitly asked to run `/prompt-ass + /prompt-plan + /prompt-write p8b`. The runner requires exactly one final *closeout-type* prompt per stack; that closes **Wave 2**, not Phase 8.

## Safety and Phase 9 interaction

Keep `ChannelSpec` the only canonical page definition and maintain Studio Preview + generated native Vega semantic parity. The old `SCHEMA_VERSION=1` channels and old published manifests must remain usable or reject new features explicitly. New section types must never be remotely published to **already-installed clients that cannot render them**: classify supported approved content updates as Publish Now, unsupported sections as Requires App Update / Blocked. No implicit approval, source regeneration that destroys edits, new public artwork rights, arbitrary native OTA executable content, billing, infrastructure provisioning or physical Fire TV/Appstore claim.

Reuse latest [C7 R4 GREEN](../c7-export-recovery/R4-playback-evidence.md) device playback evidence and [Wave 1 GREEN](../p8/wave1-closeout.md) for unchanged systems. Native section parity itself needs new focused proof, not a broad replay of old worker/encoding matrices. Before production actions validate schema 14, backup/rollback and explicit deploy authority.

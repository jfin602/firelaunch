# C8-UI2 — Secondary Channel Editor Rail & Fullscreen Left Overlay

## Handoff to c8-ui3 final visual/staging acceptance (2026-10-21)

[c8-ui2 P1–P3] are committed at unchanged `0.8.10`. No c8-ui2 P4 closeout exists at this documentation checkpoint. The owner accepted the final maximized, borderless TV mockup and requested [c8-ui3](../c8-ui3/README.md). **The outstanding c8-ui2 P4 is superseded for visual/staging closeout by c8-ui3 P3 and should NOT be run as a second staged acceptance.** Preserve historical c8-ui2 P1–P4 prompt files and their results; P4 was authored but is not claimed executed. P8B native static-layout proof and overall Phase 8 remain open.

**Owner-approved 2026-10-21.** /docs-apply + /prompt-ass + /prompt-plan + /prompt-write **COMPLETE; NOT IMPLEMENTED/QUALIFIED**. This is a **fixed root/lock `0.8.10` correction** following [c8-ui](../c8-ui/closeout.md), whose tested UI was GREEN and protected staging DEPLOYED. The broader [P8B Wave 2 follow-on](../p8b/wave2-follow-on-2026-10-21.md) remains NOT GREEN for native static-section screen evidence. Phase 8 stays OPEN.

## New owner design

[Full human-first design contract](../../design/channel-secondary-rail.md), based on the owner's approved mockup:

- Standard Channel layout: persistent main FireLaunch sidebar, then a SECONDARY **LEFT VERTICAL EDITOR RAIL** that extends from the sidebar to around the middle of the page, and a separate RIGHT workspace for the real interactive 16:9 TV Preview. No bottom editing bar.
- Secondary rail header tabs: **Pages & Layout** and **Appearance**, followed by existing P8B pages, section controls and selected editing options. Preserve same editor and save/dirty guards, no duplicate inspector rail; long panel content can scroll within its own rail.
- Right preview maintains 16:9, with **View full screen** near upper right. Move the existing Virtual remote into free area BELOW the TV frame, near lower-right, not floating over the picture.
- Buttons and tab actions must match restrained **Desert Heat** style: charcoal secondary, subtle warm border, amber/orange only for selected/important actions, meaningful destructive/disabled/focus; no plain white browser-default actions.
- In fullscreen, the SAME editor becomes a **LEFT SIDE overlay drawer** sliding over TV when hovering near left edge, using a handle/touch/keyboard reveal and stable focus/unsaved state. Remove fullscreen BOTTOM dock reveal, not the fullscreen feature. Same TV state/player and editor component; Exit distinct from TV Back.

Do not modify creator channel artwork colors, new native Vega layouts, ChannelSpec, existing owner media/publication/export workflows or rerun P8B/c8-ui. This is UI-only composition/styling and full-screen interaction refinement.

## Fast sequential correction

| Step | Prompt | Model | Browser | Scope |
| --- | --- | --- | --- | --- |
| P1 | [Secondary editor rail](P1-secondary-editor-rail.txt) | GPT-6 Sol Medium | No | Normal Channel left editor + right 16:9 TV, remote below |
| P2 | [Editor button styling](P2-consistent-editor-controls.txt) | GPT-6 Sol Medium | No | Styled tabs/actions/focus/destructive consistency |
| P3 | [Fullscreen left drawer](P3-fullscreen-left-drawer.txt) | GPT-6 Sol High | No | Reuse fullscreen API/state; left-edge reveal and input/access |
| P4 | [Independent staging closeout](P4-left-rail-staging-closeout.txt) | GPT-6 Sol High | **Yes** | One final aggregate, protected staging release and owner browser checks |

[Assessment](prompt-assessment.md) · [Implementation plan](implementation-plan.md). P1–P3 are runner-owned implementation commits and each holds root/lock **0.8.10 unchanged**; P4 is the only closeout-type prompt, **manual and browser-required**. Runner stops before P4; no `/activate`. Target <=8-minute implementation prompts, 15-minute stop, focused Studio tests/typechecks, one aggregate only at P4.

## Entry conditions and safety

1. Verify real local checkout HEAD and `git status --short` to protect uncommitted c8-ui P4 changes. Inspect `package.json` and both root lock fields (expected **0.8.10**). Don't reset/force-pull/stash over pending work; GitHub `main` was `f5c515c` when authored.
2. Once safely aligned, run `npm run codex:stack:validate -- c8-ui2` then `npm run codex:stack -- c8-ui2`. No version bump, no previous-stack rerun. P1–P3 maintain correct correction commit prefix; P4 must be invoked manually.
3. **P4 targets staging deployment and final owner browser tests on that release**, subject to a valid command-specific operator grant, exact hash, verified backup, schema14 compatibility and retained asset/rollback checks. Previous short-lived grant is not assumed to authorize a new archive. If blocked, report NOT DEPLOYED/NOT GREEN; no privilege bypass.
4. Preserve approved FREE release #1 and prior C7/Vega evidence, public/private media, rights and ownership, P8B modules, c8-ui P4 historical UI GREEN and staging. C8-ui2 qualification is UI/staging only and does not close P8B native static-layout device gap, Phase 8, or launch Phase 9.

**Owner deadline:** Friday October 23, 2026 noon America/Chicago. Source changes and staging rollout are NOT claimed by this documentation apply.

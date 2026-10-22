# P8C — Implementation plan: final creator UX and Phase 8 acceptance

**2026-10-21 local / 2026-10-22 UTC — owner-approved documentation plan only.** [README](README.md) is authoritative for four sequential checkpoints. Do not create or run prompts, modify product source, bump version, deploy or publish based on this planning file alone.

## Execution ownership

| Step | Focused implementation seam | Mandatory evidence | Must NOT redo |
| --- | --- | --- | --- |
| P1 0.8.11 | Existing Library/video artwork status, approved image references, editor/TV Preview image projection; changed server URL/rights logic only if proved necessary | Confirm affected owned/private case, save/reopen, correct image scale or truthful fallback, focused owner/foreign/revoked/rights denial + Studio/server typechecks when touched | New poster approval, encoding, native runtime, public policy |
| P2 0.8.12 | `starterChannel` and page/template/sample seeding, current Channel page-creation UI and its tests | Fresh channel first Hero+starter layout without duplicates; template choice, owned media binding, atomic IDs/reopen; pre-existing channel unchanged | New ChannelSpec/schema, second editor, account-wide migration |
| P3 0.8.13 | Current left-rail Pages & Layout/Appearance controls, page navigation/overflow, Save/Cancel/errors, responsive CSS/keyboard | Actual focused page discovery, reachable mobile actions, accessible targets, no data loss; preserve same TV/editor/fullscreen instance | Fullscreen rewrite, broad visual retheme, new media features |
| P4 manual, 0.8.13 unchanged | Real candidate/browser/staging and targeted new-static-section Vega VirtualDevice acceptance; overall phase owner decision | One final aggregate and protected rollout, qualified owner journey, changed-native-layout proof, `docs/tasks/p8/closeout.md` | Repeat older C7 HLS/worker/ZIP matrices, broad Q2/Q3, Amazon submission |

## Preflight and versioning

1. GitHub source at review: main `4e3dc601a8`, root version `0.8.10`. c8-ui3 closeout proved protected **0.8.10 staging deployment**, but assessed overall **UI NOT GREEN**. Read `docs/tasks/c8-ui3/closeout.md`, `docs/tasks/p8b/wave2-closeout.md`, any newer evidence and actual source before running.
2. On the developer machine verify real HEAD, dirty worktree, origin sync, root `package.json` and both `package-lock.json` top-level version fields, current staging/worker/schema14 and release pointer. Do not reset, force-pull, auto-stash or overwrite running parallel corrections. If current source/version has moved, reconcile this plan before authoring prompts.
3. Intended P1–P3 implementation versions: **0.8.11 → 0.8.12 → 0.8.13**. Runner must own incremental commits/version fields when executable prompts exist; no standalone entry bump. P4 is manual at existing **0.8.13** and may propose an evidence-only phase closeout; it does not silently invent version 0.8.14 or activate Phase 9. Confirm p8c continuation grammar and offset during future `/prompt-ass` and `/prompt-write`; do not assert grammar validated today.
4. P1–P3 run affected focused tests + changed package typecheck, with runner validation/diff checks. Do not run full root build/test at each prompt. P4 after settled changes runs **ONE `npm run test`** (already builds/typechecks workspaces), stack validator, `git diff --check`; repeat aggregate only if the tested source changed. Never treat old tests as evidence for a newer tree.

## P1 — Media and artwork presentation repair

Start from the actual signed-in discrepancy, not a hypothetical source mismatch. `c8-ui3/closeout.md` observed editor thumbnail broken and owner-approved featured art ~859px wide in reference vs ~481px live in an otherwise ~955px TV frame at 1671×941. Diagnose whether those are private image URL/rights issues, CSS image width/object-fit, or distinct source assets. Correct the narrow actual cause and avoid arbitrary image stretching. Keep private catalog images private, artwork approval distinct from file upload and published image state distinct from draft/technical readiness. Verify real view/reopen and representative denied cases; don't need a new MediaConvert job.

## P2 — First-visit usability

Reuse current `ChannelSpec` and existing Hero/Grid/Rows templates. The earlier P8b local test reported duplicate Home Hero/row content after sample seeding. New channels must get one predictable intentional starter arrangement; existing channels are not silently rewritten. Make empty slots say what creators can do and guide selection of **genuine owned** videos/artwork; preserve Save, Cancel and persistence. Focus tests on deterministic seeding, collision-safe ID assignment, duplicate prevention, rights-safe selection and reload without reproducing every earlier browser journey.

## P3 — Existing editor usability only

Treat the latest c8-ui3 left editor + TV-right experience as the baseline, not the earlier c8-ui bottom dock. Improve page overflow affordance/count, discoverable later pages on phone, control sizing/color hierarchy, accessible keyboard and touch operation, and explicit save/pending/error feedback. Check 1280×720, 1440×900, tablet and ~390px mobile in a bounded manner; real pixel assertions belong to P4. Do not duplicate Preview/player/editor, alter Fullscreen remote corner (**bottom RIGHT**) or erase Clean View recovery. Protect existing appearance, static modules and privacy state. Any observed remaining screenshot parity must be documented for P4.

## P4 — Final Phase 8 acceptance, shared scope from reviewed #1 / #2 / #5

**1. Staging/editor:** Perform one coherent owner-authenticated creator journey on final source: Home/new-channel start → Library owned video/artwork reopen → Channel choose/create template, add/edit/save sections and Appearance → TV Preview/D-pad/Back and fullscreen controls + Clean View → Publish private draft vs approved live release → Export status/resume/download if valid. Verify exact prior `Build input changed` state (not a claim of export regression without investigation); preserve creator-edited source and do not enqueue unnecessary native builds. Brief responsive spots. Native Fullscreen API success vs denied fallback reported separately. Compare artwork to owner mockup; avoid public screenshots of private accounts.

**2. Vega static parity:** Reuse [C7 R4 proven moving HLS/audio/device scope](../c7-export-recovery/R4-playback-evidence.md) for unchanged playback, and P8b local Renderer/compatibility tests. One new bounded, rights-safe x86_64 VirtualDevice package check must show **Image Banner and Image + Text** plus relevant Hero/Grid/Rows projection on actual device with VPKG hash, captured screen/log and appropriate ownership/release identity. Test old-installed-client fail-closed compatibility deterministically; never remote-publish new sections to incompatible release #1. If VirtualDevice unavailable, gate = NOT GREEN or explicitly owner-accepted exception, never passed-by-simulation.

**3. Final protected rollout + closeout:** Use actual reviewed exact-hash staging workflow, only valid operator permissions for the new candidate, retained cached JS/CSS, assembled visible-root smoke, encrypted predeploy backup, schema14 compatibility, prior rollback and preserved public release #1 hash. Test the **active deployed** source in fresh signed-out and real signed-in browser; read active symlink, services/worker, source/archive hashes. Roll back serious regressions with authorized script. If the final P8C candidate is byte-identical to already qualified deployed source for a particular test, reuse that evidence with immutable hashes rather than repeating for optics; new P8C source still requires new candidate qualification and rollout.

Report independently UI GREEN/NOT GREEN, STAGING DEPLOYED/NOT DEPLOYED/ROLLED BACK, STATIC VEGA PARITY GREEN/NOT GREEN and overall PHASE 8 GREEN/NOT GREEN. Write `docs/tasks/p8/closeout.md` with source HEAD+dirty state, exact versions, P8B/c8-ui historic evidence references, focused and aggregate tests, owner browser observations, native evidence, build/download proof if observed, archive/rollback/backup/schema IDs, approved public release #1 byte preservation, any owner-approved scoped exceptions and explicit `0.9.0` Phase 9 handoff approval status. **Do not write the final closeout file during planning.**

## Safety and deadline

Owner delivery 2026-10-23 noon America/Chicago; target freeze 2026-10-22 17:00 and internal handoff 2026-10-23 11:30. No Phase 9 publishing/update implementation, public release mutation, new paid encode, AWS/IAM/CDN change, native worker rewrite, Appstore submission, arbitrary renderer upgrade, broad visual redesign or rights/CSRF weakening. This plan and any later prompt assessment may be revised only from proven newer source/host evidence.

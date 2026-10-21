# Phase 7 — Owner-accepted closeout and Phase 8 handoff

**Owner decision: 2026-10-21 (America/Chicago). Phase 7 and c7-export-recovery are CLOSED BY OWNER / ACCEPTED WITH EXPLICIT EXCEPTIONS, not technically GREEN or fully QUALIFIED.** The owner authorizes advancing the repository entry baseline to `0.8.0` for the Phase 8 prompt runner. This decision closes scheduling/phase ownership, **not** an unpassed evidence gate.

## Evidence accepted from the existing C7 closeout

Read [C7's measured closeout](../c7-export-recovery/closeout.md) and the [original P7 P4 closeout](closeout.md), whose historical results remain unchanged. Their recorded, directly observed outcomes include:

- R1: Studio browser startup **SCOPED GREEN**.
- R2: separate same-VPS restricted native worker and creator/deployment-bound x86_64 Vega VPKG **GREEN**.
- R3: authenticated owner four-file ZIP download, artifact integrity and ready-state recovery **SCOPED GREEN**; browser-tested anonymous denial and focused foreign/CSRF/revoked/stale checks.
- R4: the exact ZIP-extracted VPKG installed in a stable Vega VirtualDevice, showed approved creator channel and artwork, navigated Back and survived restart.
- **NOT GREEN / unqualified:** Hls.js first approved TS fragment never reached `FRAG_LOADED` inside the installed app. Moving-picture HLS playback, independently observed sound, pause and seek did not pass. Direct device-shell HTTP 200 for a segment is reachability evidence, NOT playback. No physical device or Amazon Appstore acceptance was established.

These are **dated C7 observations**, not fresh replays; do not relabel R4 or the original P7 P4 as GREEN. Historical Q2 F7 PARTIAL/NOT GREEN, P5/c5 and broader Q3 outcomes also remain unchanged. Preserve approved public FREE release #1, core schema 14, same-VPS isolation and rollback without re-running paid encoding or cloud operations.

## Owner disposition and unresolved item

The owner explicitly elects **Phase 7 owner-closed / accepted partial** on 2026-10-21 to protect the October 23 noon America/Chicago delivery deadline and allow Phase 8 creative UX development. The native HLS segment/player blocker remains a recorded cross-phase risk; do **not** erase it, claim complete native playback, or require unrelated P8 navigation/layout/media prompts to retest the proven native build/ZIP/device gates. Phase 9's final installed-device MVP acceptance must still handle or truthfully report moving video, audio and playback controls before any fully qualified launch/demo claim. If repairs to the native runtime are separately undertaken, require focused evidence from the exact changed package and explicit operator consent for live builds/deployments.

## Phase 8 entry — version/source handoff

- The source-control transition changes **only** the root `package.json` version and the two root `package-lock.json` version fields `0.7.3` -> `0.8.0`; workspace versions and the app's PostgreSQL schema stay unchanged.
- `0.8.0` is a **runner baseline, not an implementation/version 0.8.x feature release or a deployed staging claim**. No AWS/IAM/CloudFront changes, publication, MediaConvert job, host restart or real Vega build are authorized by the baseline.
- The P8 stack is [P1–P5](../p8/README.md). P1–P4 are sequential runner implementation checkpoints `0.8.1`–`0.8.4`; P5 remains browser-required manual closeout, with `0.8.5` only a proposed separate closeout version. No manual `/activate` step.
- The runner expects clean coherent version `0.8.0` and **no existing P8 implementation commit prefix** before P1. Before running on a laptop or VPS, inspect the **actual local worktree**: `git status --short`, `git log -1`, `git diff`; reconcile uncommitted or independently continued C7 work without reset, stash, forced pull or deletion. Sync to the owner-approved baseline only when safe. A clean GitHub main cannot prove a locally clean checkout.
- Validate: `npm run codex:stack:validate -- p8`. Then `npm run codex:stack -- p8`. The runner commits implementation prompts and stops at the browser-required P5 gate.

**Disposition:** P7 owner-closed with evidence-bound exceptions; P8 baseline owner-approved. Not a retrospective requalification of any NOT GREEN result.

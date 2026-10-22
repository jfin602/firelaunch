# P8C — Final Creator UX, Manual Codex Browser Stack and Phase 8 Closeout

**2026-10-21 America/Chicago / 2026-10-22 UTC — /prompt-ass + /prompt-plan + /prompt-write APPROVED/AUTHORED; NOT EXECUTED.** Phase 8 **OPEN**. This is the last sequential Phase 8 continuation, after P8B and the completed c8-ui/c8-ui2/c8-ui3 corrections. **All four prompts are MANUAL; do NOT invoke the repository runner or its stack validator.** Each uses the real Codex browser for debugging the actual staging candidate and can use small tested repair/deploy/browser loops. The agent running each prompt owns its version change, Git commits and faithful evidence handoff.

[Assessment](prompt-assessment.md) · [Implementation plan](implementation-plan.md) · [Phase 8 overview](../p8/README.md) · [Previous c8-ui3 closeout](../c8-ui3/closeout.md)

## Four manual prompts

| Prompt | Version | Responsibility | Browser required |
| --- | --- | --- | --- |
| [P1 — Artwork and media clarity](P1-artwork-media-clarity.txt) | **0.8.11** | Broken editor thumbnail, featured-art sizing, truthful private/approved/live status | YES — real staging owner, image/network diagnostics |
| [P2 — First-time creator](P2-first-time-creator.txt) | **0.8.12** | Deterministic clean Home/template/sample creation, owned-content selection and reopen | YES — new safe test project and previous-project preservation |
| [P3 — Editor usability](P3-editor-usability.txt) | **0.8.13** | Page discovery, mobile/keyboard/touch targets, Save/error feedback without editor rearchitecture | YES — responsive owner browser and fullscreen regression |
| [P4 — Final Phase 8 closeout](P4-final-phase8-closeout.txt) | **unchanged 0.8.13** | Whole creator journey, protected final staging, new static-section Vega parity, definitive Phase 8 status | YES — owner browser + actual Vega VirtualDevice |

**Manual commit contract:** P1→P2→P3 run in order. Before every prompt inspect actual Git HEAD/status/origin and all three root/lock version fields; reconcile parallel work without reset/force/stash. Each P1–P3 applies its own patch version to root `package.json` and BOTH top-level root lock version fields, tests changed scope, **commits code and version**, builds an exact-source reproducible archive and deploys via protected standing-grant staging workflow, debugs in real Codex browser, then commits final evidence/corrections. Record SHA of product commit vs evidence commit. Do not have the runner own any commit. P4 does **not** bump version; it commits a truthful final report. No automatic Phase 9 activation. If a previous step is NOT GREEN or its deployed identity is unknown, the next prompt must stop and reconcile, not assume success. No `/activate`.

## Browser and staging contract — each implementation prompt

- **Real Codex browser** on `https://firelaunch.jfin.dev/` with the **actual owner Google session** (or explicitly logged browser/auth blocker), inspect DOM/CSS, screenshots, console, failed requests, image URLs and responses as appropriate. A local disposable fixture alone is not qualified owner staging evidence.
- **Deploy tested, committed source on every successful P1–P3 iteration** so the browser is exercising exactly that candidate. [Current standing staging runbook](../../../scripts/staging/README.md) grants guarded `deploy-release.sh` and `rollback.sh` on `muffinos` without one-off per-SHA sudoers changes. Still independently compute/check archive SHA-256, use `firelaunch-*.tar.gz` incoming, retained hashed assets/visible-root smoke, encrypted backup, schema14 compatibility, health/previous rollback, read active symlink/source/version and approved free release #1 pointer. Verify grant live, not solely by dated README. The standing grant has root-equivalent staging impact; no unreviewed shell scripts, migrations or privileged changes.
- A new UI candidate can be marked **deployed but NOT GREEN**. Never confuse local test, a healthy server or a cached 0.8.10 tab with fresh authenticated 0.8.11+ acceptance. Fail/rollback severe regressions using supported guarded rollback, then preserve logs and accurate disposition.
- Existing normal Channel has left editor rail + borderless 16:9 right TV with remote below/right; fullscreen remote overlays **bottom RIGHT**, Exit/Hide top-right, left editor drawer and Clean View. Preserve the **same** Preview/editor/player and H/corner/Alt+E/Escape recoveries. Previous stale bottom-left guidance is superseded.
- P1/P2/P3 run focused tests and changed package typechecks; P4 runs ONE final `npm run test` (already includes builds/typechecks) after source settles. Do not run repeated full suites or unsupported runner grammar checks.

## Precise historical handoff

- [Wave 1 P5](../p8/wave1-closeout.md) **GREEN/DEPLOYED** at its exact 0.8.4 scope; do not repeat old worker/ZIP proof.
- [P8B P7](../p8b/wave2-closeout.md) and its [dated follow-on](../p8b/wave2-follow-on-2026-10-21.md) retain native static-layout **NOT GREEN** pending **real Vega** new static section rendering.
- [c8-ui3 P4](../c8-ui3/closeout.md) **STAGING DEPLOYED / UI NOT GREEN** at 0.8.10: broken editor artwork preview and narrow featured art vs user mockup; native Fullscreen API denied, expanded fallback working; read-only Export `Build input changed`. Last dated staged release: `20261021T230818Z-c382c81aeacd`, core schema14, published release #1 unchanged. GitHub at authoring had docs HEAD `5acc3e0c89`, version 0.8.10. These are **dated** observations, not a guarantee of current state.
- [C7 R4](../c7-export-recovery/R4-playback-evidence.md) showed real native moving HLS/audio/pause/seek on the **prior tested** VPKG. New P8B Image Banner and Image + Text device projection still requires its own P4 proof.

## Final Phase 8 disposition

P4 alone produces `docs/tasks/p8/closeout.md` after actual execution, with separate **UI / STAGING / NEW VEGA STATIC PARITY / OVERALL PHASE 8** results; GREEN must be evidenced, NOT GREEN must name exact blockers. Native Fullscreen API denied is **not** equivalent to fallback failure or success; report each. P4 should use current P1–P3 deployment proof rather than rebuild/redeploy an exact identical safe candidate, but fresh final browser/source consistency check is mandatory. P4 commits the closeout even if NOT GREEN; explicit owner acceptance of limitations is separate from factual qualification. Phase 9 `0.9.0` is not started without owner authorization.

**Delivery deadline** Fri Oct 23 noon America/Chicago; internal handoff 11:30; freeze target Thu Oct 22 17:00.

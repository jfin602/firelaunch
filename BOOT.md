# VegaLaunch Boot Context

## Current execution: c8-ui3 true fullscreen and Clean View (2026-10-21)

[c8-ui3](docs/tasks/c8-ui3/README.md) now has four prompts at unchanged 0.8.10: P1/P2 normal mockup unchanged, NEW P3 implementing truly maximum 16:9 fullscreen with remote bottom-left, Exit/Hide top-right and completely hidden overlays Clean View; P4 manual protected deploy FIRST + staged signed-in Codex browser qualification. Keep existing left editor pop-out drawer, same Preview/player/editor and recovery via H (not text inputs), top-right corner/touch, Alt+E and Escape. Previous P3 staging closeout was replaced; c8-ui2 P4 remains superseded and unrun. Verify local HEAD/status/version before `npm run codex:stack:validate -- c8-ui3` and `npm run codex:stack -- c8-ui3`; runner stops before P4. Do not claim deployment/qualification before evidence. Phase 8 OPEN.

## Current owner directive — c8-ui3 final Channel visual correction (2026-10-21)

The final owner-approved image makes [c8-ui3](docs/tasks/c8-ui3/README.md) the next correction. GitHub source has c8-ui2 P1–P3 at root/lock `0.8.10`; c8-ui2 P4 has not produced a closeout and is superseded for staging/visual testing by c8-ui3 P3. Read [final visual design](docs/design/channel-preview-final-composition.md). Fix seam/header padding, gray New Page toolbar, whole Channel near-black background (no canyon), largest borderless right 16:9 TV, and place Draft/Interactive + View Full Screen/Remote BELOW screen. Keep same Preview and fullscreen LEFT editor drawer. Execute after safe local sync: `npm run codex:stack:validate -- c8-ui3`; `npm run codex:stack -- c8-ui3` (P1/P2), then manual P3 deploys latest source FIRST and tests in Codex browser on staging with owner-attached mockup. No `/activate`, source version change or unauthorized deployment. P8B native static device gate and Phase 8 remain open.

## Current execution handoff — c8-ui2 secondary editor and fullscreen left drawer (2026-10-21)

Previous [c8-ui P4](docs/tasks/c8-ui/closeout.md) qualified the top-TV/bottom dock in real staging at `0.8.10` (UI GREEN / DEPLOYED), and P8B Wave 2 remains NOT GREEN for native static-section device evidence. The owner now approves [c8-ui2](docs/tasks/c8-ui2/README.md): default Channel as **global sidebar + secondary LEFT editor rail + RIGHT interactive 16:9 TV** with Virtual remote below, styled controls matching Desert Heat, and fullscreen SAME editor sliding out from LEFT edge instead of bottom. Assessment/plan/P1–P4 are authored, not implemented. Check exact local HEAD/dirty work/root+both locks at `0.8.10`, then `npm run codex:stack:validate -- c8-ui2`, `npm run codex:stack -- c8-ui2` for P1–P3; P4 is independent protected staging/owner browser qualification. No `/activate`, no new version, source replacement, cloud rights or publication. Phase 8 OPEN.

Read this file before substantial repository-aware work.

**Read [docs/CURRENT-STATE.md](docs/CURRENT-STATE.md) first for dated source/staging/AWS facts, current gates and next execution.** This boot file includes historical P0-P6 decisions; older activation instructions are preserved as history and MUST NOT override that current ledger, ADR 0011/0013, or p6-live-vod Q1-Q3. Last current-state reconciliation: 2026-10-20 UTC.

## Current execution — optimized c8-ui after pushed P8B (2026-10-21)
**P4 owner update:** c8-ui closes with protected staging rollout and final UI tests ON STAGING, and may serve as the P8B Wave 2 follow-on closeout if missing signed-in/native layout gates pass. If operator grant or device proof is unavailable, record the blocker and NOT GREEN. Original P8B P7 evidence remains intact.


**P8B P1–P6 is on GitHub main at `0.8.10`; P7 is NOT GREEN / NOT DEPLOYED** (native static-layout, signed-in candidate and protected staging open). The owner wants **c8-ui TV-first Channel layout correction**, not edits to P8B. Read [c8-ui](docs/tasks/c8-ui/README.md) and [TV-first design](docs/design/tv-first-channel-workspace.md). Prompt stack P1–P3 stays `0.8.10` and has exact source seams; manual P4 checks UI and staged delivery independently. Normal Channel defaults to real 16:9 TV stage above an attached horizontal Pages & Layout / Appearance dock; no AI Assistant/Close Preview. Fullscreen reuses P8B API/state to reveal same dock from bottom via pointer/touch/keyboard.

Before running validate actual local git status/version/dirty changes; safely sync/resolve and use `npm run codex:stack:validate -- c8-ui` then `npm run codex:stack -- c8-ui` without `/activate`. No source bump, no unrelated native requalification or unauthorized staging. Phase 8 remains OPEN.

## Historical pre-push c8-ui handoff (superseded)

The owner reports that **P8B already ran locally**. Don't run, edit or reorder those prompts: the current issue is their resulting page/Preview layout. Read [TV-first Channel design](docs/design/tv-first-channel-workspace.md) and [`c8-ui` correction stack](docs/tasks/c8-ui/README.md). Normal Channel: always-visible 16:9 TV fills upper stage, horizontally arranged Pages & Layout and Appearance editor dock touches its lower edge; AI Assistant and Close TV Preview creator UI removed. Fullscreen uses same TV and dock; editing dock rises from screen bottom on pointer hover, focus, touch or keyboard reveal. Preserve existing P8B templates, sections, native Vega support, fullscreen player and saved edits.

The authored P8B P6 source version should be `0.8.10` but the actual local runner/closeout/version must be checked; GitHub main docs still show old 0.8.4. c8-ui prompts have unchanged-version `0.8.10` conditionally; if actual source differs, STOP/reconcile docs, not downgrade implementation. On safe match: `npm run codex:stack:validate -- c8-ui`, `npm run codex:stack -- c8-ui` P1–P3, then P4 independent browser. No `/activate`, no automatic stage/publish. Overall Phase 8 remains OPEN.

## Historical P8B authoring handoff (superseded by c8-ui post-P8B correction)

## Current execution handoff — P8B authored (2026-10-21)

[Phase 8 Wave 1 closeout](docs/tasks/p8/wave1-closeout.md) is **GREEN / DEPLOYED** at tested source `0.8.4`, and Phase 8 remains OPEN. [P8B human-first Page Layout continuation](docs/tasks/p8b/README.md) now has an assessment, plan and **seven executable prompts**; original P8 P1–P5 must not be rerun. Normal p8b runner owns P1–P6 (`0.8.5`–`0.8.10`) and stops before P7's manual browser/native-layout/staging closeout (proposed `0.8.11`). The runner does not require `/activate`.

Before running, inspect actual local HEAD/status, inherited P5 dirty edits and root+two lock fields (expected `0.8.4`). Safely reconcile and validate `npm run codex:stack:validate -- p8b`, then run `npm run codex:stack -- p8b`. Prompt files/docs do NOT authorize live deployment, publication, paid encoding or rights changes. P7 requires real permission and direct evidence. Human-first design authority: [layout spec](docs/design/page-layout-human-first.md); latest C7 R4 VirtualDevice GREEN is reusable for unchanged media. Phase 8 stays OPEN after Wave 2.

## Historical Wave 2 design-only handoff (superseded by p8b prompt authoring)

[Wave 1 P5](docs/tasks/p8/wave1-closeout.md) was **GREEN / DEPLOYED** in protected staging at root/lock `0.8.4` with Phase 8 **still OPEN**. Do not rerun `p8` or present Wave 1 as final Phase 8 closure. The owner's next priority is [`p8b` Page Layout & Full-Screen Preview](docs/tasks/p8b/README.md), governed by [human-first design](docs/design/page-layout-human-first.md): Hero/Grid/Rows templates, Home Hero by default, first-class Pages & Layout workspace, simple image/text sections with contextual customization and same-state interactive fullscreen TV Preview.

**This is documentation/planning only; no `p8b` implementation prompts, version bump or staging rollout have been created.** Next requested workflow is `/prompt-ass + /prompt-plan + /prompt-write p8b` after checking the actual local/staging baseline, not `npm run codex:stack -- p8b` yet. The latest C7 R4 evidence is GREEN for tested VirtualDevice video/audio/seek/Back/restart; preserve earlier historical P7/C7 records and do not conflate physical/Appstore acceptance. New static sections need native Vega parity and conservative installed-client compatibility before live publication.

## Historical initial Phase 8 entry — 0.8.0 (superseded by Wave 1 GREEN)

**READ FIRST:** [Phase 7 owner closeout](docs/tasks/p7/owner-closeout-2026-10-21.md) authorizes **owner-closed partial** P7/C7 and advancing to the Phase 8 source baseline `0.8.0`. This does not make C7 or the original P7 closeout GREEN: real VPKG/ZIP/VirtualDevice branding/artwork/Back/restart passed, but first TS HLS frame transfer, visible video, verified audio and pause/seek remained unqualified. Those are carried into Phase 9 final device acceptance, not P8 navigation/layout implementation blockers. The former C7 R4-only next-action sections below are historical.

**Phase 8 P1 is the next runner step**, only after actual local `git status --short`, safe reconciliation of any uncommitted C7 work and clean sync to the approved `0.8.0` root/lock source baseline. Run `npm run codex:stack:validate -- p8`, then `npm run codex:stack -- p8`; P1–P4 runner-owned commits, P5 browser-required manual closeout. No `/activate`. No fresh native/paid build, host deploy or publication from this transition.

## Historical Phase 8 authoring plan (superseded by approved entry) — October 21 (docs only)

[Phase 8 Creative Studio UX & Pipeline Confirmation](docs/tasks/p8/README.md) is now approved and authored with [assessment](docs/tasks/p8/prompt-assessment.md), [implementation plan](docs/tasks/p8/implementation-plan.md) and five prompts P1–P5: P1 five-destination navigation **Home / Library / Channel / Publish / Export**, P2 right inspector **contextual-only** (no permanent empty rail; full-width task workspaces), P3 creative/video/persistence, P4 explicit content Publish vs real native Export, P5 independent manual creator UX closeout. Channel includes existing AI Assistant, Appearance, Pages & Shelves; Export retains Advanced Source and real ZIP download. Desert Heat, interactive Preview, existing video modal, owner/rights and source edit protection remain.

**Planning only; NOT IMPLEMENTED/QUALIFIED.** Root/lock remains 0.7.3; 0.8.x versions are targets and require separately authorized coherent 0.8.0 entry. Active **C7 R4 first-TS-fragment HLS playback** correction still takes precedence. Reuse previously qualified R1/R2/R3 worker/ZIP/native branding work; device moving video/audio/pause/seek still NOT GREEN. Do not run P8 runner or make code/version changes while active C7 manual recovery shares the checkout. Deadline October 23 noon Central; historical notes below stay historical.

## Active C7 handoff — October 21 playback only

**C7 PARTIAL / NOT GREEN.** Later C7 closeout proves R1 Studio startup SCOPED GREEN, R2 isolated same-VPS worker and real creator-bound native VPKG GREEN, R3 authenticated four-file Studio ZIP SCOPED GREEN. R4 independently installed the exact downloaded VPKG on a stable Vega VirtualDevice, displaying the approved channel, artwork, Back navigation and restart. **Remaining:** Hls.js parsed approved master and variant playlists but stalled at the first TS fragment (no FRAG_LOADED); moving video, independently verified sound, pause and seek remain unqualified. Run only the manual [R4 playback recovery](docs/tasks/c7-export-recovery/R4-playback-recovery.txt) with at most three focused repair cycles. Reuse existing GREEN work. Root 0.7.3 and core schema 14 unchanged; preserve approved public release #1.

Read the real [C7 closeout](docs/tasks/c7-export-recovery/closeout.md) and the R4 recovery prompt before changing code. A successful 1,175,564-byte device-shell HTTP 200 GET for a TS segment does NOT prove binary segment completion through the installed application's Hls.js Fetch/XHR layer. Preserve working Build & Export popup, worker, queue, native install and original historical gate dispositions.

## Latest implementation direction — October 20 same-VPS manual worker continuation

Owner rejected an additional VPS. The canonical P7 completion route is [c7-export-recovery](docs/tasks/c7-export-recovery/README.md) **R2 one-at-a-time PostgreSQL build queue + `firelaunch-build-worker.service` on muffinos**, R3 authenticated Studio ZIP download and R4 delta-only Vega device closeout. R1 is already SCOPED GREEN with tested Studio 0.7.3 live; don't requalify it. Keep root 0.7.3, main DB migration ledger/schema14 and compatible 0.6.7 rollback. Keep user-editable build scripts separated from worker supervisor/PG/cloud credentials by a genuinely restricted on-host sandbox. **ALL remaining prompts are manual; don't invoke the runner or self-commit without explicit owner instruction.** The old second-host and repeated full-qualification directives below are superseded.

## Historical C7 initial handoff (October 20; superseded by active October 21 status)

[Original P7 independent closeout](docs/tasks/p7/closeout.md) is **NOT GREEN**. P1/P2/P3 reached commits 661ba6e/779d17f/0cec1c7 and target source 0.7.3. The owner-approved staging rollout showed blank React #root despite healthy HTTP static paths; protected rollback restored 0.6.7 and public free release #1 remained unchanged. Local P7 aggregate passed 326 and skipped 15. The Hls.js scanner repair and failure closeout were subsequently committed to GitHub main at 88257d4; local worktree and current host must be independently reconciled.

**Run [c7-export-recovery](docs/tasks/c7-export-recovery/README.md) next** (P1 Studio diagnosis/VVD preflight, P2 isolated worker, P3 ZIP download integration, P4 independent manual replay). All correction implementation prompts maintain root and top-level lock version 0.7.3. Only the final manual P4 may qualify live Studio/worker/ZIP/VVD with proper owner/operator consent. Running a privileged shared-host build is forbidden. No docs-only approval for deployment or AWS action. Existing P7/P5/c5/Q2 historical dispositions remain unchanged.

## Current roadmap decision (October 20, supersedes dated future allocations below)

P7 Vega Export & Device Qualification -> P8 Creative Pipeline Confirmation -> P9 Final MVP Launch Qualification. See docs/tasks/p7/README.md, docs/tasks/p8/README.md and docs/tasks/p9/README.md. Versions 0.7.x/0.8.x/0.9.x are phase targets only. By October 23 noon Central a signed-in creator must download a ZIP with an actual creator-bound Vega x86_64 VPKG and independently install/navigate/play approved HLS in VirtualDevice including restart. Hosted native builds require real isolation; existing disabled state may not be bypassed. Phase 8 consumes the separate creative/video correction and Phase 9 closes the integrated demonstration.

The formerly planned automatic catalog synchronization/source polling and standalone billing/Appstore operations phase are removed. Manual import, explicit publication and remote reads of already approved manifests remain, as does MediaConvert after creator upload. Q2 F7 PARTIAL/NOT GREEN and Q3 native playback NOT QUALIFIED remain distinct. Historical P0-P6 instructions below, including older proposed P7/P8/P9 numbering, are not the active execution plan and do not imply new AWS/deployment permissions.

## Mission

VegaLaunch is a code-optional agentic studio for creating branded TV channels and shipping them as real Amazon Fire TV applications.

The hackathon product must prove one golden path:

Creator intent
-> structured ChannelSpec
-> interactive 10-foot TV preview
-> conversational refinement
-> accessible generated code
-> React Native for Vega project
-> build/readiness evidence
-> real Fire TV or Vega simulator demo

VegaLaunch is not merely an AI code generator and not a generic website builder. The durable product abstraction is the channel.

## Historical 2026-10-11 activation gate (superseded)

**Historical snapshot only.** The 0.6.0 activation and active P5/c5/P6 instructions immediately below are not the current command path. The last verified source/staging baseline is 0.6.7, Add Video staging GREEN; next manual work is [p6-live-vod Q1](docs/tasks/p6-live-vod/Q1-managed-private-hls.txt). No paid AWS or CDN activation is approved by this documentation update.


Current root activation version: `0.6.0` (owner-approved Phase 6 AWS Media Foundation version baseline, 2026-10-11). Phase 5 P1–P7 implementation checkpoints and its independent P8 NOT GREEN closeout are now integrated on GitHub main (P5 P8 tested `81ccef1` at root `0.5.8`). Published-release/resolver/native-loader source exists and automated tests passed, but real creator-bound Vega VPKG failed AsyncStorage SDK compatibility and Zod/Metro bundling, and the same-installed-package HTTPS/LKG/rollback sequence was NOT exercised. The owner approved the `0.6.0` Phase 6 version baseline, not retroactive P5 GREEN. Active `c5-vega` is the bounded fixed-version repair and independent on-device qualification; P6 can follow only with its native prerequisite honestly reported. `c4-fix` closed LOCAL GREEN at `0.4.8` (commit `00e3df5`, full root check passed); historical Phase 4 P8 remains NOT GREEN because no live non-mock catalog-grounded saved mutation and Preview were observed. Hosted release remains NOT QUALIFIED. Phase 5 implemented code for creator-approved immutable public manifests, HTTPS resolver and installed Vega client refresh/cache/rollback, targeting the same installed VPKG on Vega VirtualDevice. Physical Fire TV is deferred to launch Phase 9; VirtualDevice is acceptable for Phase 5 GREEN, but cannot prove physical compatibility. AWS verification and production VPS are not Phase 5 entry requirements. P1 contracts/feasibility closed GREEN / QUALIFIED at `0.1.5`. Phase 2 implementation reached `0.2.7`, but its P7 closeout remains NOT GREEN; `c2-hosted-qualification` stopped BLOCKED / NOT GREEN after 2/5 cycles. Their remaining security/staging proof is explicitly carried into Phase 3 and must not be described as passed. P0 finished at `0.0.7` with historical P7 NOT GREEN. The `c0-real-tv-qualification` repair also ended BLOCKED / NOT GREEN on 2026-10-09, with partial virtual-TV successes only.

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
- VegaLaunch may prepare Amazon submission assets/readiness but must not pretend it submitted an app when a real Developer Console action was not performed.
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


## Historical P6 foundation approval (2026-10-11; superseded for encoding)

With P5 source implemented and its remaining live qualification gates explicitly deferred by the owner, implement **P6 AWS Media Foundation (0.6.x)**: creator-authorized direct uploads to private S3, FFmpeg worker not on muffinos, validated HLS renditions, and private S3+CloudFront OAC delivery to a qualified Vega client. Initial free-to-view publishing only. The planned later phases shift to P7 catalog sync, P8 creator-owned publishing and P9 launch/hardware/Appstore. Do not change historical P5 P8 prompt requirements, Phase 4/P2/c2 results, or claim that AWS, native playback, subscriptions or production hosted security are qualified. See ADR 0010 and docs/integrations/aws-media-delivery.md. P6 prompts are authored at docs/tasks/p6/ and the root version baseline has been approved; neither P6 implementation nor AWS/cloud/device validation has happened. P5 implementation prerequisites are present on main, but c5-vega build/device qualification is NOT GREEN until directly proven; owner approved starting P6 P1–P7 now; c5 HTTPS/same-installed-VPKG proof remains NOT GREEN and deferred to P6 integration/P8, not waived for release.

## Active c5-vega fixed-version qualification correction (2026-10-12)

Read `docs/tasks/c5-vega/{README.md,prompt-assessment.md,implementation-plan.md}` and historic `docs/tasks/p5/closeout.md` before prompt execution. P1 fixes real AsyncStorage/Vega SDK and Zod/Metro build failures; P2 prepares a rights-cleared creator-owned HTTPS public-only resolver test; P3 independently validates ONE real installed VPKG accepting v1/v2, LKG/offline/failure and new-sequence rollback. Root remains 0.6.0 throughout. c5 result does not revise original P5 NOT GREEN and is not AWS P6 media implementation or physical-TV certification.

## Owner-authorized P6 implementation (2026-10-12)

At committed root `0.6.0`, P6 P1–P7 may start immediately even though P5/c5 independent live HTTPS and same-installed-VPKG gates remain NOT GREEN. This decision only defers external proof to integration/P8. Inspect and preserve actual P5 source publication, rights, immutable resolver, tenant/auth/CSRF and data-integrity contracts. P6 P8 still demands real creator-approved AWS HLS through CloudFront to Vega with independent evidence. See docs/tasks/p6/deferred-qualification.md.

## 2026-10-14 current Phase 6 provider policy

GitHub main reached root 0.6.7 after P6 P1-P7 initial FFmpeg pipeline implementation. Existing older BOOT passages saying P6 has not been implemented are historical/stale and do not describe the current code. **ADR 0011** accepts managed AWS Video on Demand on AWS Foundation / MediaConvert to replace the active custom FFmpeg worker. Do not rerun P6 P1-P7; run [c6-aws-vod](docs/tasks/c6-aws-vod/README.md) correction P1-P4 and manual P5 at **unchanged 0.6.7**. New video must be privately staged and creator-authorized for CDN publication, not exposed merely after encoding. This documentation change does not deploy AWS or close P6 P8/P5/c5 native proof, P4 real provider, S1-S6 hosted security or P9 physical Fire TV/Appstore gates.

The current c6 implementation routes new hosted video only when the managed MediaConvert coordinator and private S3 storage are configured. The local FFmpeg executable, npm worker script and worker-only source are retired; legacy READY rendition records and additive migrations remain. Finished managed output stays in private staging until creator-approved publication. This is offline implementation evidence only; manual c6 P5 and real AWS/Vega P6 P8 still decide their separate gates.

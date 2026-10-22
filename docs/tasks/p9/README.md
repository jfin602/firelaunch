# P9 — Live Channel Publishing & App Updates

## NEW PRE-P9 DEPENDENCY — P8D multimedia implementation (owner decision 2026-10-22)

**Phase 9 remains PLANNED / NOT ACTIVATED; do not bump `0.9.0` yet.** Owner authorized [P8D](../p8d/README.md) **now**, to support Audio MP3 and Book Showcase with optional SAME-book audiobook MP3 (no TV reader), before larger P9 installed-app publication/update polishing. Its five manually executed Codex checkpoints target `0.8.14`/0.8.15/0.8.16/0.8.17 plus unchanged P5 closeout 0.8.17; **P1 ready now**. P8C [historical final closeout](../p8/closeout.md) is **NOT GREEN** for unproved static-section Vega parity and hero art composition; the owner explicitly defers those as P8D ENTRY gates without changing past evidence or waiving native proof for P8D. P9 compatibility decisions must account for the new audiobook binding/player, unknown installed renderer capabilities defaulting to `Requires App Update/Blocked`, and separately approved native package version lineage. Phase 9 entry remains a future explicit owner authorization after P8D.

Older P8C "not yet executed" notes below are dated history, superseded by actual P8C closeout + this P8D priority.

---


## Current P9 gate: manually executed P8C acceptance is pending (2026-10-21 local / 2026-10-22 UTC)

[Phase 8's final P8C](../p8c/README.md) is now an AUTHORED four-prompt **manual Codex-browser stack, no runner**. Its agents own separate version bumps/commits/protected staged browser checks at 0.8.11, 0.8.12 and 0.8.13; P4 remains unchanged 0.8.13, validates new Vega Image Banner/Image+Text parity plus final staged owner journey and writes/commits `docs/tasks/p8/closeout.md` with evidence-backed result. **Not executed yet. Phase 8 remains OPEN; P9 not activated.** Start 0.9.0 only after an explicit owner-approved Phase 8 source/handoff decision; do not infer approval from document or prompt writing. C7 R4 earlier tested playback and c8-ui3 0.8.10 deployed/NOT GREEN remain separate dated evidence. Earlier P8C *planning only* notes below are superseded for prompt-authoring status.

---


## Current entry dependency — approved P8C plan (2026-10-21 local / 2026-10-22 UTC)

**Phase 9 is NOT activated.** [P8C final creator UX and phase closeout](../p8c/README.md) owns the last Phase 8 implementation versions `0.8.11`–`0.8.13` and one manual Phase 8 P4 closeout at unchanged `0.8.13`. The final evidence-backed Phase 8 result must be written to `docs/tasks/p8/closeout.md` (not yet created; see the [Phase 8 overview](../p8/README.md)) only after real staging/creator checks and targeted static-layout Vega VirtualDevice rendering; the link points to the P8 overview until the closeout is actually created. A separately approved `0.9.0` source handoff is required before any P9 prompt runs. No Phase 9 version or implementation change is authorized here.

The latest dated [c8-ui3 result](../c8-ui3/closeout.md) is **0.8.10 staging DEPLOYED / UI NOT GREEN**, with image fidelity and native Fullscreen API constraints; [P8B](../p8b/wave2-closeout.md) still lacks native **new static-section** Vega parity. In contrast, the [later C7 R4 evidence](../c7-export-recovery/R4-playback-evidence.md) **does establish moving HLS video, audible loopback audio and seek/pause on the tested VirtualDevice package**, superseding earlier first-fragment-stall statements in the historical Phase 7 paragraphs below. Phase 9 still owns **installed-client remote updates, same-ID native upgrades and the ultimate launch demonstration**, not a replay of known-green unchanged C7 device evidence.

---


**Owner-approved documentation plan, 2026-10-21. NOT IMPLEMENTED OR QUALIFIED.** Planned 0.9.x; no version bump. Deadline Fri October 23 noon America/Chicago; internal 11:30 AM, freeze Thu 5 PM.

## Inherited Phase 7 technical exception / final acceptance

The [owner-accepted Phase 7 closeout](../p7/owner-closeout-2026-10-21.md) authorizes beginning P8 from committed `0.8.0` without rerunning C7 native worker/ZIP/device installation. It does **not** qualify HLS moving video, audible sound, pause or seek in the installed Vega app. Phase 9's final installed-client qualification must explicitly test/fix or clearly record this unqualified native playback boundary; historical C7 R4 remains NOT GREEN. Do not treat owner approval as evidence of successful native media playback or Appstore acceptance.

## Phase 8 Wave 2 layout compatibility dependency (planned)

[Wave 1 P5](../p8/wave1-closeout.md) is GREEN/DEPLOYED at tested `0.8.4`; Phase 8 remains open for [Wave 2 human-first Page Layout](../p8b/README.md). New Image Banner and Image + Text sections, visual presets and full-screen **Studio Preview** are not automatic permissions to update an already-installed native application. Phase 9 compatibility classification must recognize actual installed Vega renderer capabilities: existing supported approved layouts may be **Publish Now**; unknown/new section variants are **Requires App Update / Blocked** until a qualified compatible same-ID VPKG exists. Preserve existing public release approval, data ownership and old ChannelSpec handling. Phase 8 Wave 2 is planning only; this note does not authorize Phase 9 implementation or native publication.

## Main feature

**Publish a creator's app once; update its compatible content and supported design from Studio without rebuilding. When native functionality changes, export a new version of that SAME app.**

Extend existing P5 immutable PublishedManifest, approval, HTTPS resolver, installed client refresh, rollback and last-known-good (ADR 0009). No second publication system.

- **Publish / Live Channel:** Creator reviews rights-cleared title, approved free HLS video, artwork, collections/shelves, branding and layout options **already supported by the installed Vega renderer**, then explicitly approves a new immutable manifest. The installed app fetches compatible content without another binary or Appstore review. A saved draft is not live.
- **Export / App Releases:** Unsupported UI components, new native navigation/player/runtime/dependencies/permissions or incompatible schema require a new qualified VPKG. For an **existing app update**, preserve creator-owned package identity and deployment binding, increase valid native version/build, verify owner-only ZIP, and provide release notes and manual Amazon Developer Console existing-listing update instructions. FireLaunch does not submit or secure Amazon approval.
- **FireLaunch Studio website:** Its frontend deploy is separate from published TV manifests and creator VPKGs.

Classify changes as **Publish Now / Requires App Update / Blocked** against actual installed-app capabilities/rights. Unknown is not remotely publishable. No unrestricted React Native JS/HTML OTA code replacement, WebView migration or new dynamic-layout engine in this sprint.

## Dependencies

[C7 R1–R3](../c7-export-recovery/README.md) already demonstrated scoped-GREEN Studio, GREEN isolated worker and scoped-GREEN authenticated owner ZIP; R4 installed a real VPKG with branding/artwork/Back/restart, but **first HLS TS fragment stalled**, so actual video/audio/pause/seek remains NOT GREEN. Complete [targeted R4 playback recovery](../c7-export-recovery/R4-playback-recovery.txt) first; do not replay working worker/ZIP qualification.

[Phase 8](../p8/README.md) owns five navigation destinations **Home | Library | Channel | Publish | Export**, TV Preview, contextual inspector and Advanced Source. Keep all P8 P1–P5 plans/versions unchanged. P9 extends Publish/Export only after safe P8 source handoff and separately approved **0.9.0 entry**. Last evidenced root/lock is 0.7.3. Older P5/c5 device-update, Q2 F7 and Q3 statuses remain historically NOT GREEN/PARTIAL.

## Sequential prompts

| Step | Prompt | Planned version | Work |
| --- | --- | --- | --- |
| P1 | [Compatibility](P1-update-compatibility.txt) | 0.9.1 | Safe data vs native app upgrade decision and version lineage |
| P2 | [Remote refresh](P2-live-channel-refresh.txt) | 0.9.2 | Same-installed-client v1→v2, LKG/fault/approved new-sequence rollback |
| P3 | [Native upgrades](P3-native-app-upgrades.txt) | 0.9.3 | Same-package-ID successor native VPKG via existing worker/owner ZIP |
| P4 | [Publishing UX](P4-publishing-ux.txt) | 0.9.4 | Live draft diff/approval/history and first app vs existing app export |
| P5 | [Independent closeout](P5-independent-closeout.txt) | 0.9.5 proposed | MANUAL device/browser remote update, upgrade and original video MVP |

P1–P4 are sequential runner-owned implementation checkpoints, <=8 min target, 15 min hard stop, focused tests, **no /activate**. P5 is independently **manual**, with real browser/VirtualDevice and one final aggregate. See [assessment](prompt-assessment.md) and [plan](implementation-plan.md).

## Phase 9 GREEN

Real external x86_64 Vega VirtualDevice: a creator/deployment-bound VPKG installed **once** accepts explicit approved compatible v1→v2 manifest updates over HTTPS **without reinstall**, visibly changes TV, preserves offline last-known-good and focus/Back, safely rejects faults/bad schema/digest and accepts a separately approved **new higher-sequence content rollback**. Separately produce a genuinely new VPKG with **same canonical package ID and higher native build/version**; independently install/launch, retain creator binding and provide truthful manual Amazon handoff (not Appstore approval).

Preserve original final MVP creator walkthrough: signed-in edit/save/reopen rights-cleared video/artwork/shelves, explicit free publish, authenticated verified ZIP, independent VPKG install, real moving HLS video **and independently verified audible sound**, remote pause/seek/detail/Back/restart and useful Phase 8 Studio UX. Record SHA, release IDs/digests, device, install count, screenshots/logs and private/foreign/CSRF negatives. Missing any required evidence = **P9 NOT GREEN**, not a lowered gate.

No unauthorized content publish, AWS/CDN/IAM edits, paid encodes/entitlements, automatic source sync, Amazon automation, arbitrary native executable OTA or physical Fire TV/Appstore claim. Offline cached revocation is not immediate.

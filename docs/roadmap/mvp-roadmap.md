# FireLaunch MVP Roadmap

Bootstrap date: 2026-10-08.
Hackathon deadline: 2026-10-23 12:00 PM PDT.

## Active October 21–23 delivery override — native HLS only

**C7 PARTIAL / NOT GREEN.** Later C7 closeout proves R1 Studio startup SCOPED GREEN, R2 isolated same-VPS worker and real creator-bound native VPKG GREEN, R3 authenticated four-file Studio ZIP SCOPED GREEN. R4 independently installed the exact downloaded VPKG on a stable Vega VirtualDevice, displaying the approved channel, artwork, Back navigation and restart. **Remaining:** Hls.js parsed approved master and variant playlists but stalled at the first TS fragment (no FRAG_LOADED); moving video, independently verified sound, pause and seek remain unqualified. Run only the manual [R4 playback recovery](docs/tasks/c7-export-recovery/R4-playback-recovery.txt) with at most three focused repair cycles. Reuse existing GREEN work. Root 0.7.3 and core schema 14 unchanged; preserve approved public release #1.

**Critical path:** R4 diagnose first TS fragment in Vega binary loader vs MSE → three focused repair cycles maximum → if native source changes, one actual owner-built/downloaded ZIP and independent exact-VPKG install/playback qualification → P8 separately approved creative UX and pipeline confirmation → P9 short final creator walkthrough. No reimplementation or repeated broad acceptance of working R1/R2/R3, no new paid MediaConvert/publication. Deadline Friday October 23 noon America/Chicago (11:30 AM internal). The older October 20 plan below is retained as dated historical guidance.

## Owner-approved Phase 8 Creative Studio UX (2026-10-21; planned, not implemented)

Phase 8 is now **[Creative Studio UX & Pipeline Confirmation](../tasks/p8/README.md)**. Owner approved five creator destinations: **Home | Library | Channel | Publish | Export**. Channel groups the existing AI Assistant, Appearance, and Pages & Shelves; Export includes Advanced Source; TV Preview remains prominent and interactive. The desktop right inspector is **contextual-only** on an actual editing selection, never a permanently reserved third column. Library, Publish, Export and Add Video use proper full workspaces/modal. Keep Desert Heat and creator-owned media artwork styling.

P8 is five bounded checkpoints: P1 navigation; P2 contextual workspace and responsive Preview; P3 saved creative/video/artwork/rights consistency; P4 immutable public publication vs real native app export; P5 one manual browser creator closeout. [Assessment](../tasks/p8/prompt-assessment.md), [plan](../tasks/p8/implementation-plan.md), and P1–P5 prompts are authored only. Planned 0.8.1–0.8.5; no current 0.8.0 entry, root/lock bump, UI implementation, staging deploy or qualification. **Current C7 R4 first-TS HLS playback repair remains the critical technical priority**; previously demonstrated native worker, authenticated ZIP, actual installed creator-bound VPKG, branding, artwork, Back and restart are reusable. Do not rerun those gates; moving video/audio/pause/seek remain blocked until independently proven. P8 begins only after a safe local source handoff and separately approved coherent 0.8.0 entry, avoiding collisions with manual C7 work. Preserve deadline October 23 noon America/Chicago and internal 11:30 handoff.

## October 20–23 delivery override (active plan; earlier phase history retained)

**Owner delivery target:** **Friday, 2026-10-23 at 12:00 PM America/Chicago (CDT)**; internal handoff target **11:30 AM CDT**. The older 12:00 PM **PDT** hackathon line at the top of this roadmap is a distinct historical time-zone statement, not the same instant. Confirm external submission requirements separately; the owner delivery target controls this sprint.

**New baseline (evidence, not speculation):** [c6-usability P6 closeout](../tasks/c6-usability/closeout.md) independently recorded a protected 2026-10-20 staging release, browser smoke, two-hour source tests, and **ACTIVE** client-account MediaConvert queue plus **ENABLED** completion event rule without a new paid job. Earlier Q1/Q2 evidenced a real encoded READY HLS and approved free release #1. This does **not** resolve historical Q2 F7 PARTIAL/NOT GREEN or install/qualify Q3 Vega. Later GitHub `b0d2897` contains media/creative integration work but is not confirmed staged or independently green; see [current state](../CURRENT-STATE.md).

**Priority/order — parallelize Vega feasibility as soon as possible:**

| Date (Central) | Highest-leverage work | Minimum exit evidence |
| --- | --- | --- |
| **Tue Oct 20** | Repair/verify creative + video overlap: saved/custom/generated thumbnail, owner-private preview HLS, READY/draft/live distinctions and publication artwork. **In parallel investigate hosted Vega build/export/download limitations immediately.** | Real integrated creator flow in candidate; exact creator-bound export blocker/build path identified. No new paid encode. |
| **Wed Oct 21** | Produce/download an actual creator/deployment-bound x86_64 release VPKG with real public-only HTTPS resolver/catalog binding, artwork and playable approved free HLS. Install early, not only after Thursday. | Source/build provenance and exact VPKG SHA; first independent VirtualDevice launch attempt. |
| **Thu Oct 22** | Fix device/packaging defects; validate install, D-pad/focus/detail/Back, release binding, artwork, real HLS playback; converge creator Studio upload/preview/publish/export UX. | Emulator-working candidate; user can initiate and retrieve package; release freeze target 5 PM CDT. |
| **Fri Oct 23** | Fresh creator smoke, independently downloadable/installable package, minimal regression and handoff. | Delivery by 11:30 AM CDT, buffer to noon; limitations explicit. |

**Three release checks only:** (G1) integrated creator media/artwork/private and approved public behavior; (G2) authenticated downloadable ZIP containing a real creator-bound x86_64 VPKG independently installed and playing approved HLS on Vega VirtualDevice; (G3) coherent no-developer-assisted Studio-to-export walkthrough. Focused tests during repairs, one final appropriate convergence check; do not rerun historic multi-cycle Q1/Q2 matrices merely to collect duplicate evidence. A genuine access-control/public-exposure defect remains a hard safety blocker. Preserve F7 historical disposition while allowing independently approved **read-only Q3 preparation/smoke against existing release #1**; full Q3/P6 GREEN still requires its own recorded evidence and outstanding applicable gates.

**Explicit exclusions:** no new paid MediaConvert qualification run, broad CloudFront/IAM change, automatic creator publication, optional subtitle UI/Vega caption support, multiple-shelf merchandising, generic SaaS polishing, or paid/entitlement access in the core release. Paid video remains a stretch **only after** video/export/device acceptance. Reconcile `c6-supporting-media` with newest source before rerunning its original sequential prompts; approved ADR 0014's CloudFront artwork proposal differs from current Studio-origin `/api/public-artwork/` code and is not proof of any cloud rollout. Do not retrofit historical P5/c5/Q2 closeouts or infer physical Fire TV/Appstore approval from VirtualDevice success.

## P7 execution refinement — same-VPS queue and delta closeout (owner decision October 20)

Supersedes the earlier R2 plan that required a second build host or cross-server worker. [c7-export-recovery](../tasks/c7-export-recovery/README.md) now continues existing P7 with **manual R2** (single muffinos VPS PostgreSQL queue and separate OS-restricted build worker), **manual R3** (creator-authenticated ZIP export) and **manual R4** (delta-only host/device acceptance). R1 Studio startup is already SCOPED GREEN on 0.7.3; do not revisit its qualification or replay P7 P1-P3. Only new queue/worker/ZIP/Vega HLS/audio, and a short post-deploy rendered Studio smoke, require new direct evidence. Main application schema stays 14 and older rollback must stay functional; no second VPS, external broker, remote worker API, unnecessary cross-server signing, or mandatory broad unmodified-system regression. Deadline and owner permissions unchanged.

## Historical October 20 initial C7 recovery plan (superseded by R4-only work)

**Next:** [c7-export-recovery](../tasks/c7-export-recovery/README.md), fixed root 0.7.3, before Phase 8. The [P7 P4 closeout](../tasks/p7/closeout.md) recorded an exact 0.7.3 staging release that loaded static assets but left React #root empty. Protected rollback returned staging to 0.6.7/schema 14 and preserved approved FREE release #1 byte hashes. Source repairs in the closeout were subsequently committed to main at 88257d4; recheck the local branch and deployed host, do not duplicate or clobber those fixes.

- **R1 / P1:** find the actual browser startup failure and repair only that cause; require a visible signed-out+signed-in page smoke before another rollout. Check VirtualDevice startup early.
- **R2 / P2:** complete a separately isolated native worker and verify actual build security/receipt from real creator-bound source. Shared staging service must not execute untrusted creator code.
- **R3 / P3:** connect owner/CSRF-protected persistent export jobs, verified ZIP storage/download and Studio states to the qualified worker; no fake downloadable fixtures.
- **R4 / P4 manual:** one explicitly authorized protected deployment with immediate browser-render smoke/rollback, renewed creator login, real ZIP download, independent x86_64 VVD install and approved HLS picture/audio/remote/restart proof.

R1-R3 target <=8 minutes and must stop after <=15 minutes with narrow blockers; runner owns their commits. R4 is the only manual closeout. No root bump to 0.7.4, AWS/CDN change, extra encoding, new media approval or production-grade device claim from this docs update. Historical Q2 F7 and broader P6 Q3 remain separately unqualified. P7 has direct local 326 pass/15 skip evidence, but no live creator ZIP or installed VVD playback.

## Current Phase 7–9 delivery allocation (owner decision October 20)

[Phase 7 Vega Export](../tasks/p7/README.md) -> [Phase 8 Creative Pipeline Confirmation](../tasks/p8/README.md) -> [Phase 9 Final MVP Launch Qualification](../tasks/p9/README.md). This overrides old future P7 synchronization, P8 billing/publishing and prior P9 launch-scope allocations, not historical P0/P5/P6 checkpoint labels. Planned phases are not new deployed versions. Parallel Phase 6 creative/video correction continues in its own worktree. Do not rerun already evidenced paid encoding or broad historic Q1/Q2 matrices.

## Gate 0 — Bootstrap — 0.0.0

Deliver:
- foundational docs
- Prompt Stack runner adapted from Dope
- runner regression coverage
- P0 staged Sol Prompt Stack
- hackathon/publishing requirements snapshot
- public MIT license

## P0 — FireLaunch Hackathon MVP — 0.0.1 -> 0.0.7

P1 / 0.0.1 — Product kernel
GPT-6 Sol High.
Repository/workspace foundation, ChannelSpec, channel engine, local persistence and API skeleton.

P2 / 0.0.2 — Television kernel
GPT-6 Sol High.
Shared TV semantics, React Native for Vega generator/runtime, manifest, focus contracts and ADBT/Vega toolchain discovery.

P3 / 0.0.3 — Creator Studio
GPT-6 Sol High.
Creator onboarding, Design/Content surfaces, interactive TV Preview, virtual remote, D-pad/focus, detail and playback.

P4 / 0.0.4 — Channel Agent
GPT-6 Sol High.
Provider-neutral ChannelAgent, validated mutation tools, deterministic mock and real Bedrock adapter.

P5 / 0.0.5 — Code, Build and Publish
GPT-6 Sol High.
Generated-source editing, regeneration protection, real toolchain build wrapper, readiness model and submission bundle.

P6 / 0.0.6 — Hackathon convergence
GPT-6 Sol High.
Golden-path integration, Wild Earth fixture, cross-system regression, UX polish, aggregate docs/setup readiness.

P7 / 0.0.7 — Qualification closeout
GPT-6 Sol High with browser/manual gate.
Independent real browser, VPKG and Vega simulator/Fire TV qualification. No broad implementation.

P0 Green requires Prompt -> Product -> Real Television.

## Correction window — c0-*

P7 closed **NOT GREEN** at version `0.0.7` on 2026-10-08. Browser Studio, persistence, Preview and generated source were exercised, but no real Bedrock call, verified VPKG or simulator/Fire TV run was available; see `docs/tasks/p0/closeout.md`.

### `c0-real-tv-qualification` — executed repair loop: BLOCKED / NOT GREEN (2026-10-09)

The steps below record the **original correction plan**, not its current status. The [repair-loop closeout](../tasks/c0-real-tv-qualification/qualification-loop/qualification-closeout.md) documents 3/5 executed cycles and BLOCKED / NOT GREEN. Preserve the historical P0 closeout and the repair-loop disposition.

1. **P1 — Platform prerequisites and compatibility:** identify a supported, accessible build host and real installed Vega SDK/CLI plus an actual VVD/Fire TV target; inspect generated manifest/dependency compatibility, replace device-inaccessible loopback demo media, and package TV-compatible rights-cleared artwork. Stop with an explicit blocker if prerequisites are unavailable.
2. **P2 — Real build and provider evidence:** validate/repair only source defects found by the actual toolchain, produce a fresh release VPKG with path, SHA-256, exact toolchain identity and logs; exercise a live Bedrock natural-language request if making the broad agent claim. A configured adapter or mock success is not live proof.
3. **P3 — Independent device qualification and closeout:** install the same artifact on the supported target, capture real launcher/focus/detail/playback/Back evidence, verify truthful Publish readiness and rehearse the under-three-minute demo. Perform one final aggregate check and write GREEN or NOT GREEN with specific evidence.

New Vega SDK 0.24 tooling requires explicit OS target/minimum version in the manifest (OS 1.2 in that release); inspect the *installed* SDK version and dependencies before selecting the compatible configuration. That earlier planning statement has since been superseded by the repair-loop evidence: Vega CLI 1.4.4, SDK 0.24.12112, an actual release VPKG and successful focus/detail/visible video/Back on Vega VirtualDevice OS 1.2. This does not qualify the default Studio demo, physical Fire TV, or Appstore.

Completion target: Prompt -> Product -> Real Television, with provider claims separately evidenced, and no false artifact/device/Console qualification. No redesign of ChannelSpec, Studio, runner, or deferred SaaS features. Use focused tests in implementation prompts; reserve global suite/device acceptance for closeout.

Astra may be selected exceptionally for a cross-system blocker that resists bounded Sol repair, not as the default.

## Submission window

Operating targets:
- Oct 8-10: P0 foundation through television kernel
- Oct 10-14: Studio/agent/deployment checkpoints and early Vega proof
- Oct 14-18: convergence, qualification and bounded repairs
- Oct 18-20: demo polish and recording rehearsal
- Oct 21-22: final recording, Devpost copy, feedback/friction log, buffer

## Post-hackathon transition (accepted 2026-10-09)

P0's historical post-hackathon deferrals remain true for P0 and the active `c0-real-tv-qualification` correction. The following are now **promoted** into a new, separate launch-MVP roadmap: accounts/hosted persistence (P2), bounded content imports (P3), remotely published TV manifests (P5), approved AWS media delivery (new P6), permitted synchronization (renumbered P7), and limited FireLaunch billing/support (renumbered P8). Analytics, viewer commerce, other TV platforms and multiuser teams remain deferred. This 2026-10-11 update supersedes the former future-phase numbering but does not relabel historical closeout prompt numbers.

## Launch-MVP target

**Positioning:** Your Amazon catalog. Your own Fire TV channel.

**Audience:** Video, audio and writing creators already selling within Amazon, but without Fire TV development expertise. Each owns a **separate branded Vega app**, Amazon Developer account/listing, generated source and release lifecycle. No combined FireLaunch viewer application.

**Current golden path:** Sign in -> creator-driven import and rights review -> edit/preview -> explicitly approve and publish -> download owned Vega ZIP -> install in independent VirtualDevice -> receive already approved compatible remote manifest updates. No automatic source synchronization.

**Historical P7 is not a SaaS entry gate:** P0/P7 remained NOT GREEN at `0.0.7`. The 2026-10-09 correction also ended BLOCKED / NOT GREEN, though the tested Vega package and VirtualDevice path passed. **SaaS P1–P3 may start and qualify without full P7 GREEN, an AWS account, Bedrock, a certified Linux Mint host, a physical Fire TV, or Appstore approval.** Their own security/contracts/import gates still apply. Unresolved browser, Publish, aggregate and platform checks transfer to the affected later phase; nothing is retroactively called GREEN.

**Estimated engineering horizon:** 14–18 engineering weeks from SaaS development kickoff, for a solo developer using bounded AI prompt stacks. Amazon provider approval and Appstore review are external schedule risks. Version bands and durations are planning targets, not completed releases. Focus implementation prompts on <=8-minute bounded work, with focused checks; closeout owns aggregate suites/browser/device gates.

### P1 — Product contracts and integration feasibility (0.1.x, week 1)

Lock CreatorAccount, ChannelDeployment, CatalogSource, CatalogItem, MediaAsset, SyncPolicy and PublishedManifest boundaries, creator ownership, rights and field overwrite rules. Establish distinct video/audio/writing quality requirements. Investigate Seller Central SP-API, KDP/author discovery and other Amazon access/redistribution terms separately; begin approval applications now. Design creator-controlled import fallback.

**GREEN:** Approved schemas and decision records, documented permitted/blocked/pending source matrix, rights/TV-commerce constraints and onboarding acceptance, with no unsupported API assumptions.

### P2 — Hosted Creator Platform (0.2.x, weeks 2–3)

**Actual closeout 2026-10-10:** Implementation reached 0.2.7; independent P7 closeout NOT GREEN. c2 requalification closed BLOCKED / NOT GREEN after 2 of 5 allowed cycles. Two real Google accounts logged in sequentially, and local S3-compatible backup/restore against distinct MinIO buckets passed; concurrent two-profile foreign-route isolation, HTTPS secure-cookie/callback and remote HTTPS S3 qualification remain unproven. The local P2/c2 outcomes are recorded in [P2 closeout](../tasks/p2/closeout.md) and [c2 closeout](../tasks/c2-hosted-qualification/closeout.md). These are not changed by Phase 3 activation. P3 may start on the implemented foundations, **not** on a presumed P2 GREEN.

**P1 entry satisfied:** P1 contracts and Amazon feasibility are GREEN / QUALIFIED at 0.1.5. Activation uses clean committed root 0.2.0. Add creator login through provider-neutral verified OIDC (Google initial live issuer), private ownership-aware Studio/API routes, Postgres project/revision persistence and unique deployment identities, private object/evidence references, secure token boundaries, explicit no-loss local P0 project import, restart, backup/restore and basic audit/operational diagnostics. Preserve standalone source export. No teams. Hosted build execution is disabled until separate isolation proof; do not expose P0 local Vega CLI to untrusted tenant code. P3 owns full catalog/file/feed ingestion; P5 remote manifests; P7 billing and polished privacy UI.

**GREEN:** Two independently authenticated real creator accounts cannot reach each other's projects/media/deployments, agent or code/export/build routes; denied attempts and CSRF/session failure are tested. Valid projects survive API restart; unique identity constraints and revision conflicts are transactional; existing local P0 projects import safely with custom source; database-plus-private-object backup/restore is executed successfully. Browser and route-level evidence must be recorded. A test-only auth bypass is not equivalent to live identity proof.

### P3 — Catalog Import and Discovery (0.3.x, weeks 4–5)

**Entry:** P2's implemented hosted contracts/operations and real local Google login are usable, but P2/c2 retain NOT GREEN. Phase 3 activation root baseline is `0.3.0`; P3 has its own isolated implementation/qualification Prompt Stack. Begin with focused automated two-principal tenant/CSRF/private-capability regression; defer concurrent real Google two-profile browser qualification to P3 P8 rather than blocking the initial implementation stack. Carry the outstanding HTTPS staging security and private S3 drill into final qualification; do not grant production-release readiness in its absence.

Build tenant-owned PostgreSQL CatalogSource/CatalogItem/MediaAsset/Collection records, stable source-scoped external identities and field-level provenance. Deliver bounded CSV/JSON import with a clear preview/approve step and explicit duplicate/collision handling; initial snapshot import of creator-controlled HTTPS feeds with SSRF/DNS/redirect/time/size protections; reviewed creator overrides and Collections; safe private media/evidence uploads with separate license/TV-display/playback assertions; and a progressive catalog-first Studio onboarding journey. Treat books/listings as legitimate non-playable catalog items. Amazon name/URL/ASIN is only a discovery clue, not permission to retrieve or reproduce Amazon data. Recurring feed jobs/diffs/sync belong to P6, creator-specific channel generation to P4 and live manifests to P5.

**Catalog GREEN gate:** A real creator imports a substantial authorized file/feed catalog into a durable tenant-owned project, reviews and resolves duplicates, manages Collections and edits without losing source provenance or overrides; malformed/untrusted inputs and unsafe fetches fail closed; private/unlicensed media is not silently eligible for television. P3 closeout must additionally test new import/media routes against both creator identities, restart/export, one aggregate check and document remaining P2/c2 carry-forward security findings. If critical local tenant isolation fails, P3 is NOT GREEN. HTTPS staging OIDC/S3 release proof remains a **separate unsatisfied preproduction gate** if unavailable; it must be called out explicitly rather than relabeled as passed.

**P3 actual closeout (2026-10-10): CATALOG GREEN for the tested local workflow / HOSTED RELEASE NOT QUALIFIED.** P1–P7 runner checkpoints completed through `110dd985` and P8 qualified approved CSV catalog import, duplicate blocking, repeat-import idempotence, Collections, overrides, separate private-media display/playback rights, server-restart persistence with reauthentication, and existing TV Preview detail/Back. Focused tests passed 17/17; the single root aggregate passed 196/196, with seven typechecks, seven builds, validator and diff check passing. Root version is `0.3.8`. Two real Google accounts were exercised sequentially, not in simultaneous isolated browser profiles. S1/S2/S3/S6 live identity/foreign-route/session/export qualification remains open or partial; S4 HTTPS callback/cookie and S5 independent HTTPS S3 recovery remain open preproduction gates. Preserve P2 and c2 NOT GREEN. See [P3 closeout](../tasks/p3/closeout.md).

### P4 — Catalog-Driven Channel Generation (0.4.x, weeks 6–7)

**Activated 2026-10-10 at root 0.4.0.** P4 authored stack: [P4 README](../tasks/p4/README.md), [assessment](../tasks/p4/prompt-assessment.md) and [plan](../tasks/p4/implementation-plan.md). Seven implementation prompts target 0.4.1–0.4.7; independent browser/non-mock provider closeout targets 0.4.8. Phase 3 remains CATALOG GREEN only and inherited production hosting release qualification remains open.

Generate differentiated video, audio and writing TV experiences using the existing ChannelSpec/ChannelAgent. Provide meaningful content, collections, media previews, beginner-friendly progressive editing, live D-pad Preview and safe creator overrides. Prompt-first and Code are advanced alternatives.

**GREEN:** Three representative catalogs result in distinctly appropriate, polished, navigable TV previews; regeneration cannot erase manual customization. At least one real non-mock provider must take a representative imported catalog through grounded ChannelAgent calls, validated ChannelSpec mutations, persistence and usable Preview. **Bedrock is optional**; AWS is not a P4 requirement. Mock-only runs cannot qualify this gate.

**P4 actual P8 closeout (2026-10-11): NOT GREEN / HOSTED RELEASE NOT QUALIFIED at root 0.4.8.** Writing draft, regeneration/edit preservation, detail/Back and restart passed for one authenticated identity. A real catalog-grounded non-mock provider request and saved mutation did not occur, rights-cleared video/audio playback and full remote-focus evidence were unavailable, and the root aggregate failed one migration recovery assertion (expected 7, observed 9) despite separate Studio/runner passes. Historical P4 acceptance is unchanged; see [closeout](../tasks/p4/closeout.md).

**Bounded correction `c4-fix` (0.4.8 fixed):** [assessment](../tasks/c4-fix/prompt-assessment.md), [implementation plan](../tasks/c4-fix/implementation-plan.md), and [prompt stack](../tasks/c4-fix/README.md). Three automated prompts repair the deterministic migration test, verify existing Bedrock adapter/local Nova Lite credentials setup using offline tests, and guard catalog/Studio rights, isolation and persistence. One manual prompt checks the final aggregate and records a separate **c4-fix LOCAL GREEN or NOT GREEN**. AWS verification and a live paid request are not prerequisites for this *bounded local correction*; original P4 stays NOT GREEN until a successful actual non-mock catalog-grounded SAVED ChannelSpec mutation and usable Preview are independently observed. Never relabel `configured=true` or offline mocks as live success. S1–S6 HTTPS hosted release, rights-cleared browser playback, real simultaneous two-profile identities and P5–P8 device/publication requirements remain open. No production VPS deployment is needed for c4-fix. P5 Green still requires real installed-Vega remote-manifest qualification (VirtualDevice accepted).

### P5 — Live Channel Delivery (0.5.x, weeks 8–9)

**Activated 2026-10-11 at root 0.5.0 after committed c4-fix LOCAL GREEN (0.4.8).** Historical P4 remains NOT GREEN and hosted production remains NOT QUALIFIED. See [P5 task stack](../tasks/p5/README.md), [assessment](../tasks/p5/prompt-assessment.md), [plan](../tasks/p5/implementation-plan.md), and [ADR 0009](../decisions/0009-live-channel-delivery.md). P1–P7 target 0.5.1–0.5.7 and independent browser/VirtualDevice closeout P8 targets 0.5.8.

**Qualification target policy:** The actual Vega VirtualDevice is the required authoritative P5 development test target; a physical Fire TV is NOT necessary for P5 GREEN and is deferred to the renumbered P9 launch/hardware compatibility. P8 closeout must observe the SAME installed release VPKG fetch a newly approved compatible revision through a device-reachable HTTPS public resolver without reinstall, then retain last-known-good across offline restart, reject bad/incompatible releases and observe authorized rollback as a new monotonic release. Browser/unit fixtures alone do NOT qualify that. No production VPS or Bedrock account is necessary to begin implementation; P5 final qualification still needs real controlled HTTPS reachability and actual installed-TV evidence. Never claim VirtualDevice proof guarantees physical device behavior.

Introduce approved immutable PublishedManifest revisions, HTTPS deployment resolver, draft/live separation, schema validation, TV cache, rollback and compatibility. Remote layout/catalog changes require no VPKG rebuild; native/runtime changes still do.

**GREEN:** On a real qualified Vega target (VirtualDevice accepted for P5), the same installed VPKG receives an approved remote channel revision and safely recovers from network/incompatible-manifest failures. Actual physical Fire TV remains a P9 launch release gate.

### P6 — AWS Media Foundation (0.6.x, planned weeks 10–11)

**Owner-approved version baseline `0.6.0` (2026-10-11) / P6 NOT IMPLEMENTED / P5 device qualification OPEN.** Phase 5 P1–P7 implementations and P8 NOT GREEN closeout have since been integrated into GitHub main. The code for owner-approved immutable releases, read-only public resolver and generated Vega loader exists; actual creator-bound VPKG builds failed native SDK AsyncStorage/Zod-Metro compatibility, with no same-installed-package HTTPS v1/v2/v3 device proof. The `c5-vega` fixed-version correction owns that repair; this transition was not a P5 GREEN result. On 2026-10-12 owner approved P6 P1–P7 implementation NOW, deferring independent c5/P5 HTTPS and same-installed-VPKG proof to Phase 6 integration/manual P8; source security/rights/publication interfaces remain required, and no historical NOT GREEN gate becomes GREEN. See [ADR 0010](../decisions/0010-aws-media-delivery.md) and [AWS delivery runbook](../integrations/aws-media-delivery.md). Creator-owned original MP4 files upload directly to isolated private S3; an independent FFprobe/FFmpeg worker on a controlled Linux host initially prepares a verified, lean HLS ladder (480p/720p baseline, optional 1080p). Verified immutable renditions live behind an OAC-protected private S3 delivery origin and CloudFront HTTPS. Muffinos hosts auth, catalog, rights, job coordination and publication metadata only; no VPS video transcoding/CDN. Keep P2/P3 private evidence storage separate. Creator asset identity/rights are canonical in private catalog; publish only approved stable CloudFront HLS URLs compatible with P5's deployed manifest version. Paywalled viewing, DRM, platform IAP, Roku/Fire OS players and 24/7 managed transcoding are deferred.

**GREEN:** An authorized creator uploads an independently rights-cleared video, worker validates/encodes/repackages it, a complete and verified HLS ladder is delivered from private S3 through CloudFront, an owner-approved manifest references the correct stable playback URL, and a real qualified Vega target plays it. Verify foreign upload denial, ownership, failed/retried jobs, no draft disclosure, revocation/cache limitations, restart-safe state, creator quotas, AWS spend guardrails and unaffected Ngest. Real AWS/browser/TV evidence required. Do not infer certification from standards compatibility.

### P7 — Vega Export & Device Qualification (0.7.x; October 20–22 planned)

[Phase 7 plan](../tasks/p7/README.md). From a real owner/project/deployment, produce a fresh x86_64 release VPKG and authenticated downloadable ZIP. Its extracted package must install independently in Vega VirtualDevice, show published branding/shelves/artwork, play rights-approved free HLS with sound and remote controls and work after restart. Version 0.7.x is a planning band, not a shipped release.

- P1: Real creator-bound VPKG, correct public-only HTTPS manifest binding, actual installed toolchain, build provenance and hash. Fixture builds are not sufficient.
- P2: Isolated hosted build and owner-scoped ZIP generation/download, README, export metadata, SHA256SUMS, bounded jobs and safe failures. Never run creator-edited code in the shared staging service process.
- P3: Integrate live published artwork and native HLS playback, focus/detail/Back/pause/seek. Repair observed Vega compatibility faults only.
- P4: One independent manual Studio ZIP -> extract -> install -> launch -> playback -> restart qualification; record exact source/artifact/release/device evidence and final GREEN or NOT GREEN.

P7 GREEN requires the complete verified export and installed external-device playback without private URL/token or cross-creator leakage. The historic Q3 remote update/offline/fault/v3 rollback matrix and physical Fire TV/Appstore remain separately unqualified unless directly tested.

### P8 — Creative Pipeline Confirmation (0.8.x; October 21–22 planned)

[Phase 8 plan](../tasks/p8/README.md). Reuse the completed separate Phase 6 creative/video correction. Confirm that creator imports/edits/generation, project/video persistence and reopening, selected/generated thumbnails, processing and private Preview, explicit rights-approved artwork/video publication, and the Phase 7 installed Vega channel all agree. Four tentative checkpoints: P1 saved editing/generation; P2 supporting-media flow; P3 approved publication-to-export consistency; P4 independent creator walkthrough and bounded observed fixes. Do not redo proven AWS encodes or redesign Studio. P8 GREEN requires direct creator creative-to-installed-app confirmation.

### P9 — Final MVP Launch Qualification (0.9.x; October 22–23 planned)

[Phase 9 plan](../tasks/p9/README.md). Finish the full creator Studio-to-ZIP-to-independent Vega VirtualDevice journey by Friday, October 23, noon America/Chicago. Aim for October 22 at 5 PM CDT freeze and October 23 at 11:30 AM CDT handoff. One fresh realistic creator walkthrough, correct published media/playback after app restart, focused regression and recorded hashes/limits. Physical Fire TV, Appstore approval, paid access, SaaS subscription billing and extensive cosmetic work are outside this sprint. P9 GREEN is specific to the directly evidenced October 23 MVP.

**Owner-approved product removal (October 20):** Automatic catalog synchronization, source polling, background external diffs/reconciliation and automatic catalog publishing are no longer features in the product roadmap. Manual creator-driven imports/re-imports and explicit approved publication remain. Native clients still refresh already approved remote manifests, and MediaConvert automatically completes processing after creator-initiated video uploads; these are not automatic catalog synchronization. The previously planned standalone creator publishing/SaaS operations phase is removed. Dated earlier phase plans and closeouts are historical records, not the forward roadmap.

## SaaS phase entry and carried-forward P7 gates

- **P1 entry (immediate):** Contracts, architecture, provider-access feasibility and source-rights work can begin using the committed c0 repairs. No AWS credentials, Bedrock call, full P7 GREEN or real physical TV is required.
- **P2 entry:** P1 contracts accepted; hosted accounts, isolation and persistence can be qualified independently of AI credentials or television.
- **P3 entry:** Implemented P2 account/project authorization is available but P2/c2 are NOT GREEN. P3 starts with automated authenticated tenant-denial tests; real simultaneous two-profile Google browser isolation is retained for P3 P8, not required before implementation. New importer routes must enforce and test ownership; no Amazon API approval required. HTTPS staging/cross-bucket recovery is retained as an explicit unqualified preproduction gate.
- **P4 GREEN:** Live provider-neutral (non-mock) catalog-grounded generation, persisted validated mutations and usable Studio Preview; new real-browser editor regression and suitable aggregate checks on the integrated candidate.
- **P5 GREEN:** Same actual installed Vega package receives compatible remotely published manifests and recovers safely; direct on-target device proof required, supported production build host verified before claiming production readiness.
- **P6 historical/media:** Managed MediaConvert HLS, creator-approved FREE CloudFront media and existing Q2 F7/Q3 open gates; no historic results revised.
- **P7 GREEN:** Owned ZIP downloaded from Studio, exact VPKG installs independently on VVD and plays published free HLS/artwork after restart.
- **P8 GREEN:** Creator edits/video/artwork/approval/reopening and content in the installed app are confirmed together.
- **P9 GREEN:** Independent end-to-end creator walkthrough and targeted regressions meet the October 23 noon Central deadline.
- **Historical P0/c0:** Both closeouts remain NOT GREEN. Outstanding P0 Bedrock, Mint host support, default demo assets/loopback, current Studio editor and Publish evidence, aggregate check and physical hardware must stay traceable; a successful future P4 provider does not retroactively prove an untested P0 Bedrock request.

## Historical broader launch aspirations (not the October 23 P9 acceptance gate)

1. Nontechnical creator completes account -> import -> playable Preview without coding.
2. Video, audio and writing creator templates are distinct, meaningful, D-pad navigable and rights-safe.
3. Each app/listing/source/artifact remains creator-owned and exportable independently.
4. A creator-approved compatible channel revision reaches the installed television application without reinstalling VPKG; no automatic external catalog synchronization.
5. Physical Fire TV proof shows an actual package, focus, Back, navigation, playback, remote refresh and network recovery.
6. At least one independent creator-owned app achieves actual Amazon Appstore approval; all other statuses remain truthful.
7. Isolation, token/media handling, restore, monitoring, privacy/export/deletion and support are qualified.
8. Three representative real creator pilots (video, audio, writing) complete; critical UX defects are closed.

## Launch exclusions and dependencies

Defer shared teams, Fire OS/Roku/other TV platforms, live TV/EPG, viewer IAP/affiliate-led TV commerce, advertising, deep analytics, large-scale managed transcoding service (bounded FFmpeg VOD is P6), unbounded AI source modification and unofficial Developer Console submission. Amazon approvals and content rights are external hard gates. Preserve real TV and code export as enduring product invariants.

Phase 1 is GREEN / QUALIFIED; Phase 2 P7 and c2 remain NOT GREEN. Phase 3 is closed CATALOG GREEN for the tested local workflow at root `0.3.8`, with hosted release NOT QUALIFIED and outstanding S1–S6 security/infrastructure evidence retained for preproduction. Phase 4 is activated at root `0.4.0` with executable, not-yet-run P4 prompt stack documented in `docs/tasks/p4/`. Its next gate is runner validation and implementation; P8 independently qualifies live provider/browser behavior. Historical `c0-real-tv-qualification` remains separately BLOCKED / NOT GREEN. No feature enters an active stack without approved scope.

## 2026-10-11 AWS media planning decision (historical prior phase allocation)

Approved docs-only: [ADR 0010](../decisions/0010-aws-media-delivery.md) and [AWS runbook](../integrations/aws-media-delivery.md) establish the proposed FFmpeg + private S3 + CloudFront OAC media architecture. P5 and its authored Prompt Stack remain frozen. P6 media (0.6.x), P7 sync (0.7.x), P8 creator publishing (0.8.x) and P9 launch (0.9.x) are **planning bands**, not executable stacks, versions shipped or qualification claims. No AWS resources or rollout are created by this decision. Do not relabel historical P0/P2/P3/P4 results or P5 P8 *prompt* as a new phase.

## Phase 6 activation version record (2026-10-11)

At the owner's explicit request, GitHub `main` root `package.json` and the two root `package-lock.json` version entries were advanced from `0.5.0` to `0.6.0`, with internal workspace versions unchanged. This is a **version/bookkeeping activation**, not a P5 closeout, an implemented P6 feature, and was followed on 2026-10-12 by the owner's separate authorization to start P6 implementation while P5/c5 LIVE qualification remained deferred, not passed. P5's implementation and historical NOT GREEN closeout are now integrated into `main`; do not rewrite that closeout. `c5-vega` owns native-build repair and independent qualification at unchanged root `0.6.0`. P6's first implementation must stop if its publication/rights/public-resolver prerequisite is missing. P0/P2/c2/P3/P4 historical statuses, P5 VirtualDevice status, hosted S1-S6 and actual AWS delivery remain unchanged.

## c5-vega — Phase 5 native qualification correction (approved 2026-10-12)

P5 original P8 closed NOT GREEN despite seven implementation checkpoints and 228 automated passes (one existing skipped test), because a creator-bound generated Vega build failed a SDK-incompatible AsyncStorage alias and a Zod/Metro syntax transformation; no VPKG was installed and no v1→v2 same-package update or v3 rollback/offline failure test ran. [Original P5 closeout](../tasks/p5/closeout.md) is historical, unchanged.

The owner approved a **fixed-version** [c5-vega](../tasks/c5-vega/README.md) correction (root and lock entries stay 0.6.0): P1 repair native build, P2 real creator-owned rights-safe controlled HTTPS public-only resolver/qualification handoff, P3 independent manual same-installed-VPKG VirtualDevice closeout. A c5 GREEN would newly qualify that bounded source/device path, **not** rewrite the historical P5 result or prove physical Fire TV/Appstore. P6 AWS S3/FFmpeg/CloudFront remains a separate 0.6.x phase with its own unqualified external media gates.

## Owner deferral and Phase 6 implementation start (2026-10-12)

P6 P1–P7 may begin now at root 0.6.0 using offline deterministic tests. Original P5 and c5-vega P3 remained NOT GREEN, but the owner deferred their unproven real creator-owned HTTPS publication, public-only TV endpoint, same installed Vega VPKG v1→v2, offline/fault safety and v3 rollback gates to P6 integration; see [deferred qualification ledger](../tasks/p6/deferred-qualification.md). These are not waived release gates. Keep rights, ownership/CSRF, tenant denial, immutable release and AWS private-origin security enforced. P6 manual P8 still requires real rights-cleared S3→FFmpeg→CloudFront→Vega evidence and truthfully reports missing c5/P5 proof separately.

## Phase 6 provider replacement decision — 2026-10-14

**Current override for future P6 work:** At GitHub main root `0.6.7`, P6 P1-P7 FFmpeg/S3/CloudFront implementation code has landed, but it does not qualify live AWS/Vega. The owner elected to replace custom FFprobe/FFmpeg worker and encoding orchestration with **AWS Video on Demand on AWS Foundation (MediaConvert)** as the required new FireLaunch-managed VOD backend. ADR 0011 supersedes only ADR 0010's FFmpeg/worker sections; maintain S3 multipart owner authorization, media/source rights, private staged media, creator-approved immutable delivery, CloudFront OAC, P5 playback/publication and revocation safeguards. Do not enable the reference solution's automatically accessible CloudFront encoded outputs before FireLaunch approval.

Run fixed-version [c6-aws-vod](../tasks/c6-aws-vod/README.md) correction P1-P4 at unchanged `0.6.7` and manual P5 correction closeout. **Do not rerun or retroactively rewrite historical P6 P1-P7 or previous NOT GREEN evidence.** Once the provider migration is locally qualified, future Phase 6 manual P8 at `0.6.8` must directly verify real creator rights and S3 -> MediaConvert Foundation -> private verified staged HLS -> owner-approved CloudFront delivery -> installed Vega VirtualDevice, with budget/provider failure/revocation/security observations. Do not substitute mocks, browser-only playback or a prepared CloudFormation template for external proof. P5/c5 same-installed-VPKG HTTPS and hosted S1-S6 remain separate deferred gates; P9 physical Fire TV/Appstore unchanged.
## Owner-approved future Studio visual baseline — Desert Heat (2026-10-17 UTC)

**DESIGN DOCS APPROVED / IMPLEMENTATION NOT ACTIVATED / NOT QUALIFIED.** Target: full-browser-bleed charcoal app shell, left persistent sidebar, topbar, flexible central workspace, right contextual rail, dimmed dark-red slot-canyon hero artwork, restrained orange/red CTAs, readable layered panels, and believable blue/teal/violet/other-color film artwork independent from shell branding. The screenshot's sample users, mock navigation and percentages are not new feature requirements.

Canonical design: [Studio visual baseline](../design/studio-visual-baseline.md), [ADR 0012](../decisions/0012-studio-visual-identity.md), [original reference checksum/provenance](../design/references/README.md).

**Proposed `c6-desert-heat-studio` correction** (not activated): shared tokens/full-bleed shell/standalone optimized canyon; media-rich actual project dashboard and rights-aware catalog/video upload; existing TV Preview/inspector, mobile and a11y convergence; independent browser functionality + screenshot closeout. Owner approval with `/prompt-ass`, `/prompt-plan`, `/prompt-write` is required before implementation; no implementation version assigned here.

GREEN requires desktop/tablet/mobile captures, viewport-edge proof, darkened canyon readability/fallback, lawful independent-color thumbnails, truthful rights/processing/progress/publish status, functional owner login/project switch/upload/Preview, accessible keyboard/mobile controls, and no ownership/CSRF/media/publishing regressions. Visual success would not qualify P0/P4/P5/c5, S1-S6 hosted security, AWS/MediaConvert, physical Fire TV or Appstore. Historic gate statuses and the live staging state remain unchanged.

## Owner-approved p6-live-vod hybrid delivery plan (2026-10-17 UTC)

**DOCS ACCEPTED / IMPLEMENTATION AND LIVE Q1-Q3 NOT YET QUALIFIED.** [ADR 0013](../decisions/0013-hybrid-video-access.md) selects open **free-to-view only after explicit rights-approved publication**, while retaining a future protected access-policy model (`free`, `purchase`, `rental`, `subscription`). There is one private original -> MediaConvert -> verified private HLS processing pipeline; public approved CloudFront free delivery must be separated from any later purchased/subscriber authorization. No paid checkout, entitlement, DRM, signed-device playback or pricing UI is part of P6. Previously open viewer-signing blockers are superseded **for the approved free delivery branch only**. All other private S3, OAC, owner rights, revocation and device safeguards remain.

[Manual live VOD plan](../tasks/p6-live-vod/README.md) and [qualification matrix](../tasks/p6-live-vod/qualification-matrix.md): **Q1** real paid-approval-bounded MediaConvert processing into complete *private* HLS; **Q2** owner-approved free video promoted under canonical CloudFront delivery and published in a true creator-owned immutable manifest/public-only HTTPS resolver; **Q3** fresh creator-bound VPKG using supported adaptive HLS on a real Vega VirtualDevice, then same installed VPKG v1->v2, offline/fault/LKG and approved v3 rollback. No runner activation; manual GPT-6 Sol High checkpoints with hard stop gates and independently recorded GREEN/NOT GREEN outcomes.

Evidence starting point: `c6-video-publishing-ux` staging GREEN on `0.6.7`, source `86af42f`, canonical service at release `20261017T025825Z-59a5a1e6921b`; historical managed Foundation correction applied to the client AWS account and left queue PAUSED, event processing DISABLED and CloudFront DISABLED. Reverify actual live state before action. Approval of these docs is NOT permission to execute a paid AWS job, change CloudFormation/IAM, activate CDN, alter staging, publish content or touch Ngest. Keep P5/c5/P6 historical NOT GREEN and physical device/Appstore/production gates separate. No version bump in docs apply.

## 2026-10-18 video-placement sequencing decision

**OWNER APPROVED PLANNING / NO PLACEMENT IMPLEMENTATION.** Complete real Q1 private HLS verification, Q2's first creator-approved FREE CloudFront publication, and Q3's real installed Vega VirtualDevice HLS + same-VPKG v1/v2/offline/fault/v3 qualification **before** developing advanced video-placement tools. Q2 may only repair the minimal owned verified `managed_hls` -> validated ChannelSpec/publication URL binding necessary to put one READY video on the existing `Videos` shelf, preserving explicit creator review, media rights, owner/CSRF, and immutable P5 publication. Neither Q2 nor Q3 may expand into new placement-management/merchandising UI. After independent **Q3 GREEN**, separately review proposed `c6-channel-video-placement` for add/remove, multiple shelves, ordering, homepage featured selection, visual channel preview and Publish Changes UX. Do not create or run this correction yet. The owner reported a successful real AWS encode on 2026-10-18; absent a newly verified source-bound Q1 closeout, that report is not an independent Q1 GREEN disposition. CloudFront, device and production gates remain separate.

## 2026-10-18 documentation reconciliation and actual starting point

The [current-state ledger](../CURRENT-STATE.md) supersedes dated operational summaries elsewhere in this roadmap. FireLaunch root remains `0.6.7`; the bounded [Add Video staging closeout](../tasks/c6-video-publishing-ux/closeout.md) is GREEN for private upload, Postgres media/rights/shelf and restart at release `20261017T025825Z-59a5a1e6921b`. AWS Foundation nested-key correction was deployed, but live encoding (Q1), free-approved public CloudFront release (Q2), and actual installed Vega playback (Q3) are NOT QUALIFIED. The three manual prompts were fast-forward merged onto `main` on 2026-10-18; execute the current main files rather than an old documentation branch. Retain historical phase closeout dispositions and keep Q1 paid-job, Q2 CDN/publication, and Q3 creator release approvals distinct. No version bump or service action follows from documentation reconciliation.


## 2026-10-19 owner-approved c6-usability correction: resumable video workflow and two-hour admission

**DOCS APPROVED / PROMPT STACK AUTHORED / IMPLEMENTATION NOT RUN OR QUALIFIED.** The creator's individual video becomes an easy-to-find, large closeable/reopenable Studio popup (mobile full-screen sheet). It progressively collects data from initial video selection through private upload, verified MediaConvert HLS, metadata/artwork/shelf readiness and explicit channel-wide creator approval/publication. It must retain durable CatalogItem/MediaAsset identity and work across modal close, reload and project re-entry, while showing truthful server-derived states. Closing a popup does not cancel an active in-tab transfer or server-side encoding; an interrupted browser transfer is not automatically recoverable without an actual resumable-upload design. Existing Home and Catalog video cards deep-link into it.

Restore video-duration maximum from 30 minutes to 2 hours **across all stages** (1-7200 seconds). Required implementation includes Studio/backend duration checks, safe large-source hashing and multipart/session admission, and HLS verifier/publication/revocation graph scaling beyond the existing 250 segments/600 objects/1000-key cleanup. The server's current 2 GB file ceiling remains an independent limit and must be presented honestly. Do not mark two-hour managed processing live-qualified from local tests.

New fixed-version [c6-usability](../tasks/c6-usability/README.md) contains sequential implementation checkpoints plus independent manual UX closeout. This **supersedes only the former delay of basic video-entry/placement/publish usability**, which the client needs before the October 23 noon deadline. Keep advanced multi-shelf merchandising, ordering, featured layouts and drag/drop under post-Q3 c6-channel-video-placement. Q2 F7 lifecycle/revocation remains PARTIAL and Q2 NOT GREEN; Q3 device qualification is unstarted as of the cited current-state ledger. Do not rewrite older evidence or infer approval to unpause paid jobs, change AWS/CloudFront, deploy staging, expose media or publish creator content.

## 2026-10-19 c6-usability closeout/deployment acceleration

Owner-approved update: replace P6's exhaustive UX qualification with a focused first-creator smoke, reuse existing implementation test evidence, and after passing checks deploy ONLY the schema-compatible c6-usability app to the existing live Studio at firelaunch.jfin.dev using the existing protected archive/hash, encrypted backup, health and rollback workflow. No paid processing of any duration, no queue/EventBridge/CloudFront/IAM/CloudFormation/DNS changes, new creator public release, customer-media cleanup or schema migration. If host access, precise operator grant or rollback is absent, report the deployment blocker instead of privilege expansion. This note is a prospective authorization, not an implementation, deployment or Q2/Q3 Green claim.

## 2026-10-19 c6-usability autonomous client-ingest readiness override

The owner expanded P6 from a UI smoke-and-deploy to a bounded autonomous final repair-and-launch operation. After P1-P5, fix directly observed defects (up to two focused cycles), ship schema-compatible tested Studio through its protected backup/release/rollback path, then verify and enable the existing client-account FireLaunch MediaConvert queue and completion event processing with exact private S3, limited permissions, cost monitoring and no unapproved job backlog. Reversible staging AWS corrections necessary for receiving client videos are pre-authorized; paid test encoding, public content publication, broad CloudFront access, destructive jobs, unsafe migrations and unrelated AWS/VPS changes are not. Future client-initiated encodes may cost money. This planning entry is not runtime readiness evidence and does not close Q2 F7, Q3, or Vega package gates.

## 2026-10-19 supporting-media approval and correction

**OWNER APPROVED DOCUMENTATION / STACK TO BE AUTHORED / NOT IMPLEMENTED OR LIVE QUALIFIED.** [ADR 0014](../decisions/0014-video-supporting-media.md) and [c6-supporting-media](../tasks/c6-supporting-media/README.md) adopt one logical media aggregate per video, using existing separate private and approved delivery buckets (no new thumbnail bucket or bulk migration). P0: selected or generated thumbnails render immediately throughout Add Video, uploading/encoding, Home/Catalog, reopenable popup and private TV Preview; saved artwork is owner-scoped and remains visible after reload. P0: validated artwork is published only by explicit creator-reviewed immutable release through exact allowlisted managed CloudFront paths, not external image hosting. P1: optional private WebVTT track language/version/storage model and simple UI if bounded, but missing subtitles never block video work. Native captions/public subtitle delivery and any PublishedManifest wire extension are deferred beyond the initial client-use deadline unless separately qualified.

Coordinate source with in-progress c6-usability playback restoration and its P6 deploy: this is a separate supporting-media correction with its own independent closeout; never rewrite P1-P5 runner commits or report a historic NOT GREEN gate as passed. Creator/public artwork IAM/CloudFront changes are NOT implicitly authorized by existing AWS ingest/queue configuration approval. No paid encoding, public publication, data migration or infrastructure changes follow merely from this documentation approval. Release #1, Q2 F7 and Q3 device state remain protected.

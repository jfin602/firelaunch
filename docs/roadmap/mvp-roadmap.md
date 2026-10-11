# FireLaunch MVP Roadmap

Bootstrap date: 2026-10-08.
Hackathon deadline: 2026-10-23 12:00 PM PDT.

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

P0's historical post-hackathon deferrals remain true for P0 and the active `c0-real-tv-qualification` correction. The following are now **promoted** into a new, separate launch-MVP roadmap: accounts/hosted persistence (P2), bounded content imports (P3), remotely published TV manifests (P5), permitted synchronization (P6), and limited FireLaunch billing/support (P7). Analytics, viewer commerce, other TV platforms and multiuser teams remain deferred.

## Launch-MVP target

**Positioning:** Your Amazon catalog. Your own Fire TV channel.

**Audience:** Video, audio and writing creators already selling within Amazon, but without Fire TV development expertise. Each owns a **separate branded Vega app**, Amazon Developer account/listing, generated source and release lifecycle. No combined FireLaunch viewer application.

**Golden path:** Sign in -> identify/import permitted catalog -> review provenance, rights and playable media -> generate creator-specific TV experience -> refine Preview/agent/editor -> build/creator-owned submission -> publish immutable live manifest -> automatically synchronize authorized catalog changes.

**Historical P7 is not a SaaS entry gate:** P0/P7 remained NOT GREEN at `0.0.7`. The 2026-10-09 correction also ended BLOCKED / NOT GREEN, though the tested Vega package and VirtualDevice path passed. **SaaS P1–P3 may start and qualify without full P7 GREEN, an AWS account, Bedrock, a certified Linux Mint host, a physical Fire TV, or Appstore approval.** Their own security/contracts/import gates still apply. Unresolved browser, Publish, aggregate and platform checks transfer to the affected later phase; nothing is retroactively called GREEN.

**Estimated engineering horizon:** 12–16 engineering weeks from SaaS development kickoff, for a solo developer using bounded AI prompt stacks. Amazon provider approval and Appstore review are external schedule risks. Version bands and durations are planning targets, not completed releases. Focus implementation prompts on <=8-minute bounded work, with focused checks; closeout owns aggregate suites/browser/device gates.

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

**Qualification target policy:** The actual Vega VirtualDevice is the required authoritative P5 development test target; a physical Fire TV is NOT necessary for P5 GREEN and is deferred to P8 launch/hardware compatibility. P8 closeout must observe the SAME installed release VPKG fetch a newly approved compatible revision through a device-reachable HTTPS public resolver without reinstall, then retain last-known-good across offline restart, reject bad/incompatible releases and observe authorized rollback as a new monotonic release. Browser/unit fixtures alone do NOT qualify that. No production VPS or Bedrock account is necessary to begin implementation; P5 final qualification still needs real controlled HTTPS reachability and actual installed-TV evidence. Never claim VirtualDevice proof guarantees physical device behavior.

Introduce approved immutable PublishedManifest revisions, HTTPS deployment resolver, draft/live separation, schema validation, TV cache, rollback and compatibility. Remote layout/catalog changes require no VPKG rebuild; native/runtime changes still do.

**GREEN:** On a real qualified Vega target (VirtualDevice accepted for P5), the same installed VPKG receives an approved remote channel revision and safely recovers from network/incompatible-manifest failures. Actual physical Fire TV remains a P8 release gate.

### P6 — Automatic Catalog Synchronization (0.6.x, weeks 10–11)

Build idempotent source workers, diffing, audit/health, retries, reconciliation, granular field ownership, creator override protection and review queue. Default new items to review; grace missing items. Creator-controlled HTTPS feeds are the guaranteed sync path. Enable Amazon APIs only after actual authorized access and permitted TV uses.

**GREEN:** A supported external catalog change flows through policy and publication to the installed TV without reinstalling the app; revocation, failure and conflicts are handled truthfully.

### P7 — Creator-Owned Publishing and SaaS Operations (0.7.x, weeks 12–13)

Implement unique app/release identity, build/readiness provenance, screenshots/store-copy/assets, export, creator-controlled Developer Console handoff and submission tracking. Add minimal FireLaunch subscription/billing, privacy/export/deletion, support and operations workflows. No credential scraping.

**GREEN:** A real creator can package and submit a distinct branded application using their own Developer Console without writing code or transferring app ownership to FireLaunch.

### P8 — Polished MVP Launch Qualification (0.8.x, weeks 14–16)

Pilot video/audio/writing creators and repair onboarding, accessible remote focus, actual media playback, performance, network/restart/rollback, sync failure recovery, privacy and operational issues. Validate at least one real creator-owned Amazon Appstore **approval**, not just submission. Qualify a physical Fire TV, not only browser Preview or simulated artifacts. Only evidenced launch-blocking fixes during closeout.

**GREEN / launch:** All launch acceptance gates below are directly proven; otherwise NOT GREEN with blockers and recovery path.

## SaaS phase entry and carried-forward P7 gates

- **P1 entry (immediate):** Contracts, architecture, provider-access feasibility and source-rights work can begin using the committed c0 repairs. No AWS credentials, Bedrock call, full P7 GREEN or real physical TV is required.
- **P2 entry:** P1 contracts accepted; hosted accounts, isolation and persistence can be qualified independently of AI credentials or television.
- **P3 entry:** Implemented P2 account/project authorization is available but P2/c2 are NOT GREEN. P3 starts with automated authenticated tenant-denial tests; real simultaneous two-profile Google browser isolation is retained for P3 P8, not required before implementation. New importer routes must enforce and test ownership; no Amazon API approval required. HTTPS staging/cross-bucket recovery is retained as an explicit unqualified preproduction gate.
- **P4 GREEN:** Live provider-neutral (non-mock) catalog-grounded generation, persisted validated mutations and usable Studio Preview; new real-browser editor regression and suitable aggregate checks on the integrated candidate.
- **P5 GREEN:** Same actual installed Vega package receives compatible remotely published manifests and recovers safely; direct on-target device proof required, supported production build host verified before claiming production readiness.
- **P6 GREEN:** Real permitted external feed/source changes reach an installed app without a new binary; errors and overrides are handled.
- **P7 GREEN (SaaS phase, distinct from historical P0/P7):** Studio Publish readiness, package provenance and creator-owned Amazon Developer Console submission/handoff are directly exercised.
- **P8 LAUNCH:** Physical Fire TV, rights-safe and device-reachable production/default media and artwork, full aggregate/browser/operational regression, and actual creator-owned Appstore approval. Launch requirements stay intact.
- **Historical P0/c0:** Both closeouts remain NOT GREEN. Outstanding P0 Bedrock, Mint host support, default demo assets/loopback, current Studio editor and Publish evidence, aggregate check and physical hardware must stay traceable; a successful future P4 provider does not retroactively prove an untested P0 Bedrock request.

## MVP launch acceptance gates

1. Nontechnical creator completes account -> import -> playable Preview without coding.
2. Video, audio and writing creator templates are distinct, meaningful, D-pad navigable and rights-safe.
3. Each app/listing/source/artifact remains creator-owned and exportable independently.
4. At least one supported external source syncs approved items to a real installed TV app, including retries and safe rollback, without new VPKG.
5. Physical Fire TV proof shows an actual package, focus, Back, navigation, playback, remote refresh and network recovery.
6. At least one independent creator-owned app achieves actual Amazon Appstore approval; all other statuses remain truthful.
7. Isolation, token/media handling, restore, monitoring, privacy/export/deletion and support are qualified.
8. Three representative real creator pilots (video, audio, writing) complete; critical UX defects are closed.

## Launch exclusions and dependencies

Defer shared teams, Fire OS/Roku/other TV platforms, live TV/EPG, viewer IAP/affiliate-led TV commerce, advertising, deep analytics, general transcoding service, unbounded AI source modification and unofficial Developer Console submission. Amazon approvals and content rights are external hard gates. Preserve real TV and code export as enduring product invariants.

Phase 1 is GREEN / QUALIFIED; Phase 2 P7 and c2 remain NOT GREEN. Phase 3 is closed CATALOG GREEN for the tested local workflow at root `0.3.8`, with hosted release NOT QUALIFIED and outstanding S1–S6 security/infrastructure evidence retained for preproduction. Phase 4 is activated at root `0.4.0` with executable, not-yet-run P4 prompt stack documented in `docs/tasks/p4/`. Its next gate is runner validation and implementation; P8 independently qualifies live provider/browser behavior. Historical `c0-real-tv-qualification` remains separately BLOCKED / NOT GREEN. No feature enters an active stack without approved scope.

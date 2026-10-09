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

Add creator login, private ownership-aware APIs, relational project persistence, media storage, secrets, backups/migrations, deployment monitoring and explicit import from local P0 projects. Preserve standalone source export. No teams.

**GREEN:** Two real creator accounts cannot access each other's projects/media/deployments; restart and backup/restore recover valid state.

### P3 — Catalog Import and Discovery (0.3.x, weeks 4–5)

Build normalized catalog and source identity, provenance, stable external IDs, duplicate handling, rights and Collection management. Implement CSV/JSON, creator-controlled HTTPS feed and media uploads. Amazon seller/author URL or ASIN may identify a source where allowed, but must not imply verified ownership or automatic universal data retrieval.

**GREEN:** Creator imports/curates a substantial catalog without manually re-entering every item; unlicensed playback and unverified source imports cannot be silently published.

### P4 — Catalog-Driven Channel Generation (0.4.x, weeks 6–7)

Generate differentiated video, audio and writing TV experiences using the existing ChannelSpec/ChannelAgent. Provide meaningful content, collections, media previews, beginner-friendly progressive editing, live D-pad Preview and safe creator overrides. Prompt-first and Code are advanced alternatives.

**GREEN:** Three representative catalogs result in distinctly appropriate, polished, navigable TV previews; regeneration cannot erase manual customization. At least one real non-mock provider must take a representative imported catalog through grounded ChannelAgent calls, validated ChannelSpec mutations, persistence and usable Preview. **Bedrock is optional**; AWS is not a P4 requirement. Mock-only runs cannot qualify this gate.

### P5 — Live Channel Delivery (0.5.x, weeks 8–9)

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
- **P3 entry:** P2 account/project authorization available; creator-controlled feeds/files work without Amazon API approval.
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

Post-review engineering flow: `/docs-apply` -> `/prompt-ass` -> `/prompt-plan` -> `/prompt-write p1`, while `c0-real-tv-qualification` remains separately owned. No new feature enters a completed/active stack without approved scope.

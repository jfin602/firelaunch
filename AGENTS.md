# FireLaunch Agent Instructions

## Read order

Before implementation:
1. BOOT.md
2. docs/VISION.md
3. docs/PRINCIPLES.md
4. docs/PRODUCT-MODEL.md
5. docs/ARCHITECTURE.md
6. docs/workflow.md
7. the active docs/tasks/<stack>/ README, prompt-assessment and implementation-plan
8. the current prompt

## Repository behavior

- Inspect current source before editing.
- Keep changes inside the active prompt scope; do not pull later P0 work forward merely because the interface is visible.
- Prefer TypeScript and explicit contracts.
- Fail closed on malformed ChannelSpec, unsafe paths, missing toolchains and false build claims.
- Never commit secrets, AWS credentials, Amazon credentials, private developer-console data or generated user media.
- Do not automate Amazon account login by scraping or credential capture.
- Never fabricate external validation.
- Preserve creator ownership: generated projects must be ordinary source trees usable outside FireLaunch.

## P0 sequencing

P0 is deliberately staged:

- P1 owns contracts/channel engine/persistence/API foundation.
- P2 owns shared TV semantics/Vega generation/toolchain discovery.
- P3 owns Studio/Preview/focus/playback.
- P4 owns ChannelAgent/tools/mock/Bedrock.
- P5 owns Code/Build/Publish.
- P6 owns cross-system convergence/polish.
- P7 owns final real browser/Vega qualification only.

Later prompts build on prior checkpoints. Do not use a prompt to redesign earlier Green boundaries unless direct evidence proves a blocker and the current prompt explicitly owns that repair.

Preserve ChannelSpec, preview/source parity, Vega-first output, provider-neutral agent boundary and truthful validation.

Do not add authentication, billing, team collaboration, cloud multi-tenancy, arbitrary app marketplaces, Fire OS parity, Developer Console credential handling or generic IDE features.

## TV UX invariants

- Treat preview as a 10-foot TV UI, not a responsive website.
- Every interactive TV element is reachable through directional focus navigation.
- Focus is obvious.
- Back behavior is deterministic.
- Virtual remote and keyboard drive the same command abstraction.

## Agent/runtime invariants

Preferred flow:
User request -> ChannelAgent -> structured tool request -> validate mutation -> apply ChannelSpec -> persist -> preview refresh.

Bedrock is the primary real hackathon provider. Mock mode is deterministic and test-only/demo-fallback.

## Generated project invariants

- One FireLaunch project generates one self-contained Vega project.
- Generation is deterministic from ChannelSpec plus checked-in template/runtime version.
- Custom code edits are not silently overwritten.
- com.amazon.category.main is required in the Vega manifest.
- A build artifact exists only when the actual build command succeeds and the file exists.

## Validation

Each implementation prompt runs the smallest sufficient focused tests plus affected build/typecheck and `git diff --check`.

P6 owns aggregate pre-closeout convergence validation.

P7 owns real browser and Vega simulator/device evidence plus the final aggregate closeout.

Do not substitute provider command output for FireLaunch-owned validation.

## Git

When executed by `scripts/codex-stack.mjs`, Codex runs with explicit config overrides for `sandbox_mode="workspace-write"`, `approval_policy="never"`, and workspace network access so implementation prompts can edit the repository and install declared dependencies. The sandbox/runner contract still protects Git ownership and out-of-workspace mutation.

- do not create commits;
- do not rewrite/move HEAD;
- read-only Git inspection is allowed;
- leave successful changes in the working tree;
- the runner owns the checkpoint commit.

If an explicitly accepted dirty tree exists, inspect and continue it rather than resetting it.

## Post-P0 creator-owned launch roadmap (accepted 2026-10-09)

The P0 sequencing and explicit "do not add authentication/billing/cloud" restriction above apply to historical P0 and the bounded `c0-real-tv-qualification` correction **only**. They do not forbid the approved post-P0 P1–P8 launch roadmap. Preserve P0's NOT GREEN closeout and the active correction's narrow scope; do not rewrite its evidence or silently move SaaS work into that stack.

During post-P0 implementation, read [the launch roadmap](docs/roadmap/mvp-roadmap.md) and ADRs 0004–0008 alongside `VISION.md`, `PRODUCT-MODEL.md` and `ARCHITECTURE.md`.

Hard invariants for P1–P8:

- Every creator owns an independently published branded Vega app, Developer Console account/listing, generated source and media. Do not create a shared multi-creator FireLaunch viewer application.
- Default to catalog-first onboarding with prompt-first as an optional alternative. Build meaningful video/audio/writing experiences, not just product cards.
- Preserve `ChannelSpec` as presentation truth, its validated mutation/agent path, TV semantics parity and protected code export. CatalogSource/CatalogItem/MediaAsset and PublishedManifest have distinct responsibilities.
- Discovery by Amazon name/URL/ASIN does not authorize source import, TV reuse or playback. Never promise a universal Amazon author/seller connector. Document and test permissions/rights before enabling specific adapters.
- Imported field provenance, creator-owned overrides, review-by-default new items and grace state for removals protect creator work.
- Publish immutable versioned live manifests with compatibility checks, last-known-good cache, safe refresh and rollback. Native changes require real qualified packages.
- Enforce per-creator API/data/asset/credential access. Protect secrets and private data from published TV manifests and exported projects; plan backups, deletion and operational diagnostics.
- Each phase is an independently scoped Prompt Stack. Target bounded implementation prompts (normally <=8 minutes), focused checks during implementation, aggregate testing and browser/device evidence at closeout. External approval and device statuses must be factual.
- Keep the `/docs-review` -> approval -> `/docs-apply` -> `/prompt-ass` -> `/prompt-plan` -> `/prompt-write` gates. The runner owns commits inside executable stacks.

## SaaS kickoff and P7 repair carry-forward (2026-10-09)

The c0 qualification/repair loop executed three cycles and closed BLOCKED / NOT GREEN. It did verify a release VPKG and Vega VirtualDevice navigation/detail/playback/Back on a tested candidate. Historical P0/P7 and correction closeouts remain unchanged and must not be relabeled GREEN.

- Start post-P0 **P1–P3 immediately** on their own contract, hosting and catalog-import gates. AWS/Bedrock, P7 GREEN, formal Mint support, physical Fire TV and Appstore approval are **not** prerequisites. Check the committed repairs and any local worktree changes before implementing.
- Post-P0 **P4** requires a real, supported **non-mock AI provider** with catalog-grounded validated/persisted channel mutations and usable Preview. Do not require Bedrock; keep deterministic tests offline. Qualify the affected real-browser/editor regression and integrated aggregate checks.
- **P5** independently verifies installed-app remote manifest updates and fallback; **P6** verifies supported feed/source sync to TV; **P7** (the later SaaS publishing phase) verifies live Publish readiness and creator-owned submission; **P8** requires production-compatible toolchain, physical Fire TV, rights-safe media/artwork, operations/security, full regressions and real Appstore approval.
- Track P0-only Bedrock, original default demo loopback/artwork, supported host, browser/Publish/aggregate and physical-device blockers honestly without holding unrelated early SaaS work hostage. Later successful provider work does not retroactively qualify P0 Bedrock.

See [ADR 0008](docs/decisions/0008-launch-ai-provider-policy.md) and [the launch roadmap](docs/roadmap/mvp-roadmap.md).

## Historical hosted phase P2 (2026-10-10; NOT GREEN)

P1 contracts/rights feasibility qualified at root 0.1.5; the committed P2 activation baseline is 0.2.0. Read docs/tasks/p2/README.md, prompt-assessment.md and implementation-plan.md for this phase.
- Authenticated creator identity comes from verified sessions, never request-provided owner IDs; deny by default across list/read/write, agent, code, build, bundle, file/media and export surfaces.
- Hosted mode must not make existing local filesystem/CLI build or arbitrary edited source executable cross-tenant. Disable build (and any unsafe unisolated execution) in hosted mode until a tested isolation boundary exists.
- Preserve P0 single-user local data as an explicit migration source; no automatic or destructive reinterpretation of project IDs/ChannelSpec.
- P2 uses real Postgres constraints and owner-scoped transactions; tests must prove cross-account denial, restart persistence and recovery. Schema validation alone is insufficient.
- P3 owns catalog ingestion; P4 live AI; P5 manifests; P6 sync; P7 creator publishing. Do not add those into P2.
- P2 implementation uses runner-owned commits (not manual agent commits); Phase 2 P7 is browser/manual qualification and may close NOT GREEN if live identity, independent accounts or restore proof are unavailable.

## Closed Phase 3 — Catalog Import and Discovery (2026-10-10)

Root activation baseline: `0.3.0`, building on P2 implementation at `0.2.7`. Read docs/tasks/p3/README.md and carried-forward-gates.md before assessment, planning or authoring prompts. Keep P2 P7 and c2 historical NOT GREEN; do not silently redefine the acceptance gate or assert that production hosting is qualified.

**Closeout:** Phase 3 P8 closed CATALOG GREEN for the tested local workflow / HOSTED RELEASE NOT QUALIFIED at root `0.3.8`. See docs/tasks/p3/closeout.md. P1–P7 implementation checkpoints are completed. Two real Google identities were tested sequentially, not in simultaneous independent profiles; full foreign API/CSRF/session, HTTPS callback/cookie and independent HTTPS S3 restore remain open preproduction gates. P4 scope was approved through prompt authoring and has an executable, not-yet-run stack at docs/tasks/p4/ (activation baseline root 0.4.0); historical release gates remain separate.

- Phase 3 P1 uses automated two-principal authentication/tenant regression tests and does not require a manual browser preflight. Real two-profile Google login and live cross-account denial are deferred to independent P3 P8 closeout. Preserve CSRF, cookie and session guards; all catalog/import/object APIs must check owner scope. Never label the deferred live gates GREEN without direct evidence.
- Preserve the P1 versioned CatalogSource/CatalogItem/MediaAsset/Collection/rights/provenance contracts as the domain baseline. Extend contracts only for a concrete evidence-backed implementation need without altering canonical `ChannelSpec` v1 or the TV semantics.
- P3 owns **initial** creator-controlled CSV/JSON, HTTPS feed snapshot ingestion, reviews/duplicates/Collections, licensed media attachment and simple catalog-first Studio UI. P6 owns scheduled refresh, workers, diff/reconciliation and automatic sync.
- Treat untrusted feed URLs and redirects as SSRF input: disallow localhost/private/link-local/cloud metadata targets, DNS rebinding and oversized/slow responses; enforce HTTPS and bounded parsing. Static file imports require safe sizes/structure and creator approval. Avoid unapproved Amazon scraping, API calls or TV rights claims.
- Never infer TV rights or playback from a title, ASIN, Amazon listing, uploaded file or URL. Preserve raw source/provenance and creator overrides separately. New items require review; missing-item removal and remote publication are outside P3.
- Keep upload/evidence objects private and owner scoped, reject dangerous MIME/content/path forms and guard their capabilities. P5 owns public immutable TV manifest delivery; hosted unisolated native builds remain disabled.
- P3 can begin without approved remote HTTPS staging, but do not mark production hosting or the full inherited security gate GREEN until HTTPS Google callback/secure-cookie, cross-account isolation and independent HTTPS S3 bucket restoration are directly qualified. Missing external staging proof must be visible in P3 closeout and carried to the preproduction release gate.
- Preserve the original c0/P0 outcomes and P1 GREEN evidence. Use focused tests within implementation checkpoints, one aggregate and real browser/security acceptance at closeout, with runner-owned commits.


## Active Phase 4 — Catalog-Driven Channel Generation (2026-10-10)

Root activation: `0.4.0`. Read docs/tasks/p4/README.md, prompt-assessment.md and implementation-plan.md with Phase 3 closeout before P4 prompts. P1–P7 target `0.4.1`–`0.4.7` and runner-owned commits; P8 is independent browser/live-provider closeout at `0.4.8`, no self-commit. Do not rerun historical P3.

- Reuse creator-owned CatalogItem, MediaAsset, Collection, source provenance and rights from P3. CreatorAccount/project authorization comes from verified session; never pass a caller-supplied owner into generation or model context.
- Preserve the ChannelSpec draft/TV semantics contract, legacy projects, Vega parity, validated mutation tools, revisions and custom code protection. Explicit informational books have no fake playback; audio/video must behave appropriately.
- Keep separate display/playback rights and approved creator selection; do not infer rights from discovery, uploaded files or unverified Amazon data. Draft authenticated media Preview is NOT public publishing; do not leak S3 keys, evidence/tokens, signed URLs or private catalog metadata into generated/exported source.
- P4 generates three distinct video/audio/writing drafts, with stable bindings and non-destructive regeneration. The ChannelAgent must be grounded in bounded owned catalog context; a real non-mock provider call is REQUIRED for P4 GREEN. Mock-only tests cannot qualify the phase; Bedrock is not mandatory.
- Keep P2/c2 NOT GREEN and P3 CATALOG GREEN / HOSTED RELEASE NOT QUALIFIED. S1–S6 identity/API/staging/HTTPS S3 gaps remain preproduction gates. Do not add P5 manifests, P6 scheduled sync, P7 Creator Console submission or P8 physical Fire TV to this stack.

## Active c4-fix correction (2026-10-11)

Phase 4 P8 closed **NOT GREEN / HOSTED RELEASE NOT QUALIFIED** at root `0.4.8`; see docs/tasks/p4/closeout.md. GitHub `main` committed its historical closeout/version as `3a0a0de`, although the original P8 report described the state before that commit. Reconcile actual local worktree/HEAD non-destructively before running any correction stack. Do not erase or retroactively change historical P4 results.

Read docs/tasks/c4-fix/README.md, prompt-assessment.md and implementation-plan.md. The `c4-fix` correction has **three automated implementation prompts and one final manual closeout** all at **unchanged root 0.4.8**. P1 verifies/fixes migration recovery 7-vs-9, P2 checks EXISTING Bedrock Converse adapter and safe local Nova Lite `us-east-2` configuration without root keys or required paid calls, P3 safeguards rights-aware Studio/catalog regeneration, restart and owner isolation. P4 alone runs the final aggregate and writes an evidence-based local disposition. No VPS deployment is required.

A c4-fix LOCAL GREEN is not P4 GREEN: ADR 0008 still requires a real supported non-mock catalog-grounded tool/save/Preview trace and original P4 browser/product gates. AWS pending verification, media rights, S1–S6 hosted HTTPS auth/S3/two-profile checks, P5 installed Vega remote-manifest delivery and later physical device/Appstore are explicitly OPEN, not passed. P2/c2/P0/c0 remain historical NOT GREEN and P3 remains bounded CATALOG GREEN. Runner owns checkpoints; no agent commits; never change root or workspace versions in this fixed-version correction.

## Active Phase 5 — Live Channel Delivery (2026-10-11)

The committed c4-fix closeout (`00e3df5`) is LOCAL GREEN at root `0.4.8`, but original Phase 4 remains NOT GREEN and hosted production NOT QUALIFIED. Phase 5 activation root is `0.5.0`. Read docs/tasks/p5/{README.md,prompt-assessment.md,implementation-plan.md} and ADR 0009. Runner-owned P1–P7 target root 0.5.1 through 0.5.7, with P8 independent MANUAL VirtualDevice + HTTPS closeout targeting 0.5.8. Preserve project/creator/rights boundaries and strict ChannelSpec/media manifest contract; books may be informational only without playback; release is explicit creator-approved immutable publication, never an automatic draft edit. Owner-scoped write APIs and public read-only sanitized TV resolver are separate; no secrets, signed capabilities, private objects or remote executable code in manifests. A valid installed client keeps a last-known-good and safe bundled fallback; rollback must be a new rights-checked sequence, not history mutation.

P5 GREEN requires DIRECT evidence from the SAME real installed VPKG on Vega VirtualDevice fetching a changed approved compatible manifest via device-reachable HTTPS without rebuild/reinstall, safe offline/restart/incompatible fallback and creator-authorized rollback. VirtualDevice is authoritative for **P5 qualification**, NOT a physical Fire TV compatibility guarantee. Physical hardware and actual Appstore approval are deferred to P8; production VPS and Bedrock verification are not P5 entry requirements. Keep S1–S6 hosting and original P4 non-mock provider blockers open. Hosted legacy no-auth APIs must never be internet exposed. The runner owns checkpoint commits; implementation agents never commit or rewrite HEAD.


## Approved future P6 AWS Media Foundation (docs approval 2026-10-11)

ADR 0010 fixes FFmpeg + private S3 originals/delivery + CloudFront OAC as the initial media path. The **active authored P5 stack, its P8 manual prompt and version 0.5.x are unchanged**. This is a docs-only approval, not evidence that AWS infrastructure exists or the P6 stack has run. New P6 (0.6.x) handles bounded upload/encoding/rights-safe HLS delivery. Planned catalog sync becomes P7 (0.7.x), publishing/SaaS operations P8 (0.8.x), and physical Fire TV/Appstore launch P9 (0.9.x). Preserve all historical references in past closeouts; update future planning references, not historical gate names.

P6 constraints: no video transcode on muffinos, no untrusted FFmpeg command/flags or path execution, no public S3 buckets, no cross-owner object access, no silent publishing from uploads, no assumption that YouTube/Amazon streaming content may be rehosted, no S3 private keys or expiring signed URLs in exported/Vega manifest data. Approved free VOD first; viewer paywalls/IAP, Roku/Fire OS native clients, DRM and live linear TV are deferred. Use [ADR 0010](docs/decisions/0010-aws-media-delivery.md) and [AWS runbook](docs/integrations/aws-media-delivery.md) for future assessment/plan/prompt work.

## Active c5-vega correction (2026-10-12)

The original Phase 5 P1–P7 implementation checkpoints and P8 NOT GREEN closeout are on main. Do not repeat its implementation stack. Run the bounded fixed-version `c5-vega` stack at unchanged root 0.6.0: native SDK/Metro build compatibility (P1), controlled rights-safe HTTPS publication/device runbook (P2), independent installed-VPKG VirtualDevice and rollback/failure closeout (manual P3). Never change historical `docs/tasks/p5/closeout.md`; c5 receives its own evidence and separate GREEN/NOT GREEN result. No source changes outside prompt scope, no invented media rights/physical/production proof and no cloud video pipeline or passwordless SSH provisioning. Owner explicitly approved starting P6 P1–P7 immediately at 0.6.0, while c5/P5 live qualification stays NOT GREEN and deferred to integration/manual P8. Never waive source rights/security controls or final qualification.

## Active P6 implementation decision (2026-10-12)

The owner deferred c5-vega P3's real HTTPS/creator-rights/same-installed-VPKG qualification until Phase 6 integration. This does not convert c5/P5 to GREEN. P6 implementation P1–P7 is unblocked at 0.6.0, but actual P5 auth, CSRF, tenant rights, immutable release and resolver contracts must be preserved. No AWS credentials, native device or live media is required for offline implementation. At manual P8, real CloudFront/Vega evidence is still required; see docs/tasks/p6/deferred-qualification.md.

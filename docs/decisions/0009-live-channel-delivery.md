# ADR 0009 — Creator-approved live channel delivery

Status: Accepted for Phase 5 documentation / implementation
Date: 2026-10-11
Owner: FireLaunch
Scope: SaaS P5 (0.5.x) remote manifest publication and installed Vega consumption
References: docs/roadmap/mvp-roadmap.md, docs/ARCHITECTURE.md, docs/tasks/p5/, docs/decisions/0008-launch-ai-provider-policy.md

## Decision

ChannelSpec is draft TV presentation truth; the catalog and MediaAsset rights/provenance remain independent source truth. A ChannelDeployment is an immutable creator-owned native identity (distinct per project) with one live release pointer. A creator explicitly reviews and approves a source/revision/rights-checked snapshot. Publication stores an immutable public-safe PublishedManifest with a globally unique release ID, increasing release sequence and content digest, then atomically activates its deployment's pointer. An edit in Studio alone NEVER changes public TV content.

A release contains only versioned data/layout/catalog references already understood by the installed client and **stable, device-reachable HTTPS rights-cleared media**. No public viewer credentials are needed to read *published* public-safe data. All approval/publish/history/rollback writes are owner-authenticated, CSRF-protected, revision-checked and audited. Never leak private source IDs/records, owner emails, tokens, private S3 keys, temporary signed capabilities, raw media evidence or executable instructions. Native packages cannot download and execute arbitrary source/code via this route. The configured HTTPS resolver is pinned at build time to the creator's deployment, not learned from untrusted manifest data.

## Informational writing content

Informational books are legitimately non-playable: publication must accept approved writing-only manifests without a fake playback URL, duration, playable asset or Play transition. If display artwork is used, it must have an independently approved TV-display right and valid public binding; presentation with no artwork must use an explicitly supported text-only schema or remain blocked with honest readiness, not invented licensing. Audio/video require separate approved playback media and rights. All public references are allowlisted and verified against a current owner-scoped catalog during publication.

P5 P1 retains ChannelSpec v1's required content artwork field. A book can publish with no playback binding only when its artwork is a separately rights-cleared, stable public HTTPS asset. The draft generator's local `assets/catalog-placeholder.png` is not evidence of TV-display permission and cannot publish. An artwork-free text-only release remains blocked until a compatible presentation and TV rendering contract is explicitly added and qualified.

## Identity, immutability and rollback

Owner/project/deployment IDs, catalog and ChannelSpec revisions and selected bindings determine approval authority. Revalidate immediately before publish, including revoked media/rights and permission changes, and fail closed on conflict. Store canonical release bytes/digest and sequence immutably. Pointer transitions use transactional CAS, and retries/idempotency must not create accidental releases. Historical releases remain auditable, but rollback creates a NEW, higher-sequence, creator-approved release based on prior content after REVALIDATING current rights, not pointing the live pointer backwards or editing history.

## Public resolver / trust boundary

Provide GET-only, bounded, strictly sanitized public release and current-pointer endpoints, with appropriate pointer freshness and immutable-release caching. Immutable content is verified by digest/integrity and strict schema/version/deployment checks; HTTPS authenticity and stable pinned origin are required. Authenticated creator mutation endpoints remain private and inaccessible to untrusted TV data. A limited development HTTPS staging origin may expose only safe public routes. The unauthenticated legacy server must never be internet-exposed and the production hosted S1–S6 gates remain unresolved until directly qualified. Public release does not grant rights to any unlicensed asset or private uploaded object.

## Native refresh and safety

The generated Vega app includes stable deployment identity, pinned HTTPS resolver and bundled fall-back projection. At startup, use verified persisted last-known-good (LKG), otherwise bundled baseline. Refresh over HTTPS with bounded timeout/response; accept only schema-compatible, deployment-matching, integrity-valid release with appropriate monotonically increasing sequence (rollback increases sequence); render atomically without breaking existing focus/navigation semantics. Persist verified LKG across process restarts using the API confirmed supported by the installed Vega SDK. Any offline, bad JSON, 404/500, timeout, oversize, wrong deployment, bad integrity, unsafe media or incompatible schema preserves LKG/bundled content without blanking. A remote data update never changes native package identity, binary dependencies, runtime code, application permissions or supported schema version.

Offline clients may hold content that was later revoked. P5 must document cache lifetime, revocation propagation and the limits of offline deletion; it must NOT promise instantaneous removal on an unplugged TV. Future emergency-block approaches require their own verified mechanism.

## Qualification and deferrals

For **P5 GREEN**, the same REAL installed VPKG (record SHA-256) on Vega VirtualDevice receives visibly different, approved HTTPS manifest revisions without reinstall, demonstrates offline restart LKG, rejects invalid/incompatible updates, performs authorized new-sequence rollback and maintains usable D-pad detail/Back. VirtualDevice is **sufficient** for P5; physical Fire TV is unavailable and its hardware-specific compatibility remains UNQUALIFIED until P8 launch. Never claim the simulator is a physical Fire TV or infer Appstore acceptance.

A production VPS is not a P5 entry prerequisite; controlled device-reachable HTTPS staging is required for final P5 proof. Bedrock activation/live non-mock provider is an inherited P4 gate, not P5's TV data-path prerequisite. P6 periodic source sync, P7 Amazon Console submission, P8 physical Fire TV and actual Appstore approval, and hosted S1–S6 remain independent. No historical P0/c0/P2/c2/P4 NOT GREEN is reclassified by this ADR.

## Consequences

Extend existing publication contracts and Postgres repository instead of inventing a parallel channel model. Publication UI explicitly separates Draft vs Live and native store submission. Require rights evidence for device-reachable test media, or qualify a writing-only authorized text/artwork presentation instead of fabricated licensed playback. Prefer small deterministic unit/integration tests in implementation; real VPKG, HTTPS and VirtualDevice evidence belongs to one independent P5 P8 manual closeout.

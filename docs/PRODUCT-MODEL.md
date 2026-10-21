# FireLaunch Product Model

## Active Creator Studio information architecture — Phase 8 decision (2026-10-21)

**Documentation-only target, not implemented/qualified.** The current source still uses the historical eight-surface Studio until P8 work is performed. Owner-approved five primary destinations are **Home**, **Library** (Catalog and media rights), **Channel** (existing Create/Agent as AI Assistant, Design as Appearance, Content as Pages & Shelves), **Publish** (explicit rights-reviewed immutable live content) and **Export** (creator-bound native Vega build/download, **Advanced > Source** for protected editable generated code). Interactive TV Preview is a prominent toolbar/editor companion, not a redundant top-level route. The existing VideoWorkspace remains the reusable creator-owned modal/sheet rather than a duplicate video editor.

**One-action native export (P8 P4 target):** **Build & Export App** is a single intentional creator command that initiates or resumes a verified asynchronous Vega package delivery. Source generation is an internal export preparation step for ordinary creators, not a prerequisite Code-page action: produce a safe ephemeral source input from the exact creator-approved immutable published release when no source exists or saved generated source is stale but unmodified. Reuse valid up-to-date creator source, including protected custom edits, without overwriting it; an outdated or incompatible custom edit must remain intact and produce a clear conflict/resolution action. Drafts are never silently published or used in place of the approved release. An approved deployment, rights-cleared published release, isolated native worker and authenticated owner-only ZIP are required. Existing matching in-flight/ready jobs are reused, and the download remains explicitly accessible after the asynchronous build even if browser auto-download is blocked. A new native binary is not required for compatible approved data-only manifest updates. **Planned only**; no implementation, Appstore submission, viewer billing or public-rights changes are implied.

The desktop right inspector is **contextual-only**: open only for meaningful selected editing context and dismiss/deselect without reserving an empty grid column. Library, Publish and Export are full-width workspaces. No new agent, catalog, editor, publication engine or native worker is implied by the navigation change. Preserve accessible keyboard/remote preview and mobile UI, owner/security/rights boundaries, and Desert Heat shell distinct from creator ChannelSpec branding. See [P8](tasks/p8/README.md) and [Studio visual baseline](design/studio-visual-baseline.md). Historical P0 surface names below are retained as historical design, not current navigation authority.

## Phase 8 Wave 2 — human-first page layouts and full-screen TV Preview (owner approved 2026-10-21)

**Design target only; Wave 1 P5 is GREEN/DEPLOYED, Wave 2 is not implemented.** Under **Channel**, the creator-facing subview becomes **Pages & Layout** (replacing Pages & Shelves). A normal user chooses a page name plus one of three clear visual templates—**Hero, Grid, Rows**—then chooses existing content and previews; Home seeds Hero by default and subsequent pages suggest Rows. The default page is useful without requiring manual modules. Template choice seeds an ordered section composition; it is **not** a locked independent layout definition or a reason to delete existing sections on later edits.

Pages have one canonical `ChannelSpec` representation and a human-first editor: page list, large central composition, contextual-only properties for real selection, visible Save/Saved/error feedback, friendly Add Section / Choose Content / Edit Text / Change Image / Move Up/Down controls. Six supported TV-safe section choices are **Featured Hero, Content Row, Content Grid, Image Banner, Text Area, Image + Text**. Initial hero/rail/grid/text reuse current modules; new static image/split types require compatible validated contracts and both Studio and generated Vega rendering, not an unrelated HTML canvas. `Customize` reveals a few safe presets for crop, text position, size, density, background and spacing, not arbitrary pixels or executable source.

**View full screen** is an always-discoverable Channel/Preview action presenting the same interactive television state in a viewport-filling shell (Fullscreen API when allowed, accessible modal fallback). Preserve page, focus, playback and editor scroll across transitions; provide explicit Exit and a distinct TV Back behavior. Published content/rights and 10-foot D-pad semantics do not change because the preview expands.

**Compatibility gate:** An installed native client may receive only approved compatible layout changes it understands; new section types unsupported by its renderer require **Requires App Update / Blocked**, never silent Publish Now. Keep old `schemaVersion=1` data loadable or use an explicit supported migration policy, and preserve creator-owned static-art rights. Full interaction design and qualification criteria: [human-first page layout spec](design/page-layout-human-first.md); continuation plan: [p8b](tasks/p8b/README.md). No freeform site editor, duplicate preview engine, new auto-publication, or Phase 8 completion is implied.

## Primary user

A creator, brand or small media organization that has video content and wants a branded TV destination without hiring a dedicated TV application team.

Developers are also users, but the default workflow must not require TV-platform expertise.

## Core nouns

### ChannelProject

The creator-owned FireLaunch workspace.

Contains:
- ChannelSpec
- content metadata
- project assets
- agent transcript/change history
- generated-project metadata
- build/readiness state

P0 uses local filesystem persistence. Cloud accounts/workspaces are deferred.

### ChannelSpec

Canonical structured definition for the normal channel experience.

Minimum shape:
- id, title, slug
- brand
- navigation
- pages
- content catalog
- playback defaults
- schemaVersion

Brand includes logo/art references, colors, typography intent and display options.

Navigation references pages by stable IDs.

Pages are composed from bounded TV modules such as hero, rail, grid and text/about.

Content items include stable ID, title, description, artwork, playable media URL and optional duration/category/series metadata.

P0 may add fields when required, but avoid a generic arbitrary JSON page builder.

### ChannelAgent

Provider-neutral orchestration boundary that turns creator language into validated structured operations.

P0 tools should cover:
- inspect current channel
- set brand
- add/update/remove page
- add/update/remove module
- add/update/remove content
- reorder navigation/module/content references
- apply a validated bounded patch
- request generation/readiness actions

Bedrock is the primary real provider integration. Mock mode produces deterministic tool calls for tests and offline demo fallback.

### TV Preview

Interactive 16:9 projection of ChannelSpec.

It must exercise the same semantic page/module/content rules as the generated channel and support directional focus, select/enter, back, virtual remote buttons, keyboard equivalents, visible focus, content detail and playback.

The preview is not allowed to be a static screenshot.

### GeneratedVegaProject

Self-contained source project produced from a checked-in template/runtime plus ChannelSpec.

It must be inspectable in the Code surface and usable independently from FireLaunch after export.

### BuildArtifact

Evidence-backed output of the Vega build path.

A record contains project/spec revision, command/toolchain identity, time, exit status, artifact path and artifact hash when practical.

No artifact record exists merely because generation succeeded.

### SubmissionBundle

FireLaunch-prepared Appstore materials:
- VPKG reference when actually built
- app/store copy
- app icon/artwork checklist
- screenshots
- support/privacy fields
- device target notes
- compliance/readiness checks
- unresolved human actions

P0 does not automate credentialed Developer Console submission.

## Golden path

1. New Channel.
2. Enter title and short intent, optionally add logo/content.
3. FireLaunch creates a valid starter ChannelSpec.
4. Agent produces/refines the first channel composition.
5. TV Preview becomes immediately navigable.
6. Creator asks for changes or uses Design/Content controls.
7. Creator can open Code and inspect/edit the generated project.
8. Generate/Validate updates source and readiness.
9. Build uses the locally installed Vega toolchain.
10. Publish presents a truthful readiness report and submission bundle.

## Studio information architecture

Use a focused creator shell with persistent project identity and these primary surfaces:
- Create / Agent
- Design
- Content
- Code
- Build
- Publish

The TV Preview remains visually central during creation/refinement.

Do not clone a general IDE.

## Demo fixture

Ship a rights-safe local/sample Wild Earth-style project with placeholder/generated imagery or repository-owned assets and a small set of playable demo media that is legally usable.

## Explicitly deferred

- login/accounts
- billing
- team collaboration
- hosted transcoding/CDN
- subscriptions/IAP
- advertising
- analytics
- multi-TV-platform export
- component marketplace
- automated Developer Console credentials/submission

## Historical 2026-10-09 launch product model (current phase override below)

The preceding P0 nouns, local storage, golden path and deferrals are historical, not descriptions of the finished hosted product. Launch additions extend the canonical `ChannelSpec` model; they do not replace its validated TV presentation contract.

### Identity and creator-owned deployment

- **CreatorAccount:** login, customer/service entitlement, privacy/export/deletion and ownership principal.
- **CreatorProfile:** public brand and contact/media attribution, separate from private account data.
- **ChannelProject:** creator-scoped workspace containing one channel and its catalog configuration; no shared team access in MVP.
- **ChannelDeployment:** one independent Fire TV application identity, package identifier, manifest endpoint, artifact/release lineage and Amazon Developer Console listing status. Each creator owns the app/account/listing, not FireLaunch. One account may own multiple independently published projects.

### Catalog, media and creator-reviewed updates

- **CatalogSource:** type, provider/external identity, permission/verification state, feed or seller authorization, refresh capability, last-success/error and safe secret references. Supported launch fallback: creator-controlled CSV/JSON, HTTPS feed and media uploads.
- **CatalogItem:** stable internal ID, namespaced source IDs (including ASIN where applicable), type, title, metadata, artwork, provenance, imported field ownership, rights state and association to Collections.
- **MediaAsset:** independently authorized video/audio/artwork references or uploads, codec/playability data where needed, licensing/rights declaration, delivery eligibility and captions/other metadata.
- **Collection:** curated series, bookshelf, featured programming, album/playlist or rail, stable item references and editorial order.
- **ImportReview:** creator-initiated repeat import with provenance, override protection and explicit approval/rejection. Previously proposed scheduled SyncPolicy/SyncObservation behaviors are retired from the forward product plan; preserve any persisted legacy types pending compatibility audit.
- **PublishedManifest:** immutable, versioned, public TV-safe snapshot composed from approved ChannelSpec, catalog selection and media references, linked to one ChannelDeployment and compatible client schema.

`ChannelSpec` is canonical for presentation and TV navigation. The catalog records canonical content inventory and provenance. Publication validates and projects both; neither imports nor AI models may bypass schema validation or creator review rules.

### Source trust states

- **Discovered:** a possible source or item match; identity and import rights unverified.
- **Verified:** the creator has demonstrated control/permissions using a supported mechanism.
- **Imported:** an explicitly reviewed creator-controlled source snapshot; background refresh is not implied.

An Amazon author/seller name or ASIN cannot authorize import. No universal KDP, Audible, Seller Central or affiliate-content access is promised. Amazon connectors ship only when authorization and downstream TV use are proven.

### Field and update policies

Source-owned fields may update only on creator-initiated, reviewed imports; creator-owned fields must not be overwritten. AI suggestions remain proposals until accepted. New external items default to review; no automatic missing-item deletion is performed. Draft items and private tokens never enter published payloads. Failed repeat imports leave the last approved release intact.

### Launch golden path

Account -> creator-initiated catalog import/rights -> video/audio/writing-specific generation -> Preview/edit -> explicitly approve a live manifest -> download independent creator-owned Vega package -> native playback; the installed app can refresh already approved published releases. Prompt-first creation and advanced Code remain optional. A product listing without licensed playable content is not a finished TV experience.

### Launch gates and deferrals

Target evidence includes three real creator pilots (video/audio/writing), one creator-owned Appstore-approved app, physical Fire TV navigation/playback and remote refresh, plus tenant isolation, backup/rollback and support readiness. These are not current accomplishments.

Defer team management, more TV platforms, arbitrary code agent autonomy, full transcoding marketplace, live TV/EPG, viewer IAP/advertising and undocumented Developer Console automation.

### Hosted creator ownership semantics (P2)

`CreatorAccount` is the server-side billing/ownership/security principal; an authenticated OIDC subject is a login identity mapped to one account, and an authenticated session is not itself an account ID. A `ChannelProject` has exactly one owning creator for the MVP; one creator can own several projects and separate deployments, but no team membership or shared workspace authority exists. No user-supplied ownership claim can transfer a project or cross the tenant boundary.

An optional `ChannelDeployment` has a globally unique native package ID and release lineage; it is not automatically created merely by importing a local project. Project/spec and imported external catalog identity are separate from account/deployment identity. Private asset/evidence records and credential references must be owned, auditable, revocable and excluded from public TV payloads. P2 implements only private storage foundations, not P3 imports or P5 public manifest publishing. P2 preserves exportable ordinary generated source without giving one creator access to another creator's files or tokens.

### Phase 3 catalog and import user model (implemented local; bounded CATALOG GREEN, 2026-10-10)

A `CatalogSource` is a creator-and-project-scoped origin with its own proof of retrieval/display permission. `CatalogItem` stores stable source-scoped external identifiers and immutable observed source metadata separately from creator editing overrides; an item can be a non-playable book or listing. `Collection` expresses deliberate programming order (bookshelf, playlist, album, featured rail), not a playback license. `MediaAsset` is independently attached to a catalog item and may be private/rights-unknown even when inventory is complete. An evidence reference is not itself a verified grant, and neither a public Amazon identifier nor an upload demonstrates television reuse permission.

**Phase 3 creator workflow:** choose a source type -> upload CSV/JSON or supply a permitted HTTPS feed -> inspect parsed records, invalid rows and duplicates -> approve selected changes -> curate collections -> attach owned/licensed media and separate display/playback rights -> save a project-scoped catalog draft. Creator override fields survive repeated imports. New external items require review; no automatic publication or silent missing-item removal. Empty and non-playable inventories are valid drafts but not implicitly playable television channels. P4 owns generation into ChannelSpec; P5 owns approved remote public delivery. Automatic external catalog refresh/reconciliation is no longer planned.

Phase 2 P7 and c2 remain **NOT GREEN**. P3 completed its implemented local catalog foundation with automated tenant regression and sequential live Google identities; simultaneous independent real browser profiles, full foreign API negatives, HTTPS OIDC/cookie behavior and independent HTTPS S3 recovery remain unqualified preproduction security gates. Neither passed catalog tests nor local-only authentication are grounds to label the entire hosted service production-qualified.


### Phase 4 channel draft generation model (activated 2026-10-10)

P4 maps creator-selected, persisted approved CatalogItems and Collections into a project-owned ChannelSpec **draft**, without changing the original catalog/provenance. Stable catalog-to-presentation bindings and revision-checked updates must preserve deliberate manual brand, order and text edits on regeneration; a collection determines organization, not permission to show or play. Non-playable books/listings can have rich text/detail without a media URL or Play behavior. Video and audio content must have genuinely suitable playback semantics when independently licensed/eligible; missing or revoked rights show honest unavailable states.



**Phase 5 published delivery:** A creator-owned ChannelDeployment holds one stable native package identity and approved public HTTPS resolver. ChannelSpec and catalog remain editable private drafts; editing alone does not publish. Creator approval binds project/catalog revisions and rights; immutable PublishedManifest snapshots and an atomic release pointer control what an anonymous installed television reads. Informational books do not require playback; audio/video require approved device-reachable TV playback rights and separate display rights. The TV validates compatible releases, stores last-known-good state and falls back on bad or offline fetch; rollback is a new approved, monotonically sequenced release, not mutable history. A real VirtualDevice suffices for P5 testing of one same-installed-VPKG remote update, while physical Fire TV and Appstore approval stay P8 release gates. No live Bedrock or production VPS is needed to start the implementation. See ADR 0009.
P4 uses bounded server-authorized catalog inspection and provider-neutral ChannelAgent structured mutations, never raw model-generated JSON replacement or client-provided creator IDs. A successful real non-mock model call grounding on imported catalog plus persisted, valid ChannelSpec change and interactive Preview is required for P4 GREEN. Deterministic starter layouts work offline for video, audio and writing; mock tests do not prove live provider qualification. Authentication/private Preview and generated-source sanitization remain separate from P5 public immutable media/manifest delivery; Automatic external catalog synchronization is removed from the forward product roadmap. Full hosted release security readiness remains unqualified until inherited S1–S6 gates pass.


## Historical P6 AWS media plan (initial FFmpeg design; superseded by ADR 0011)

P5's historical approved PublishedManifest/ChannelSpec contracts remain the compatible native client baseline. P6 extends existing `MediaAsset` with owner-scoped original upload identity, content hash, probe metadata, rendition-set version, encoding profile, FFmpeg job/attempt, verification results and delivery-ready state. Do not substitute media assets for ChannelSpec presentation identity or replace previously approved publication releases. All private originals, upload sessions, worker credentials and evidence remain outside public/exported contracts. Encode jobs and HLS rendition metadata have independent revisions and retries.

Media moves through upload pending -> uploaded -> probing -> processing -> verified/ready or failed; separately track TV-display/playback rights, approval, revocation and delivery eligibility. FFprobe can approve safe stream copy/repackaging, otherwise transcode a bounded two-quality HLS profile (480p/720p initially, optional 1080p). Every rendition-set publication must resolve to stable validated CloudFront HTTPS media usable by the P5 wire format, with no signed private S3 URL or temporary query credentials. Private storage from P2/P3 for small evidence and uploads remains distinct; P6 handles scalable video masters.

For **future** subscribers, public playback manifests must not contain per-viewer credentials. Viewer identity, Amazon/Roku billing and playback entitlements require a separately approved device/provider contract. Initial P6 is free-to-view rights-cleared video. P6 (0.6.x) precedes planned P7 sync (0.7.x), P8 publishing/SaaS (0.8.x), P9 launch (0.9.x); all earlier P6/P7/P8 references in historical phase plans remain historical, not renamed evidence.

## Current owner-approved phase/product override (2026-10-20)

[P7](tasks/p7/README.md) owns downloadable Vega ZIP/native-device HLS qualification; [P8](tasks/p8/README.md) owns independent creative pipeline confirmation; [P9](tasks/p9/README.md) owns final October 23 MVP qualification. Bands 0.7.x–0.9.x are planned, not deployed. Automatic source polling/diffs/sync workers, auto-publishing catalog changes and standalone billing/Developer Console operations have been removed. Creator-driven imports/re-imports, explicit publication, published-manifest refresh and asynchronous MediaConvert responses to creator uploads remain. Legacy SyncPolicy/SyncObservation and prior P7/P8/P9 descriptions are historic; do not destructively remove stored compatibility records without a separate review.

## Current verified video baseline and future access (2026-10-18)

The minimal Add Video form and actual authenticated, owner/project-scoped private S3 upload are **staging qualified** with persistent catalog, distinct TV display/playback rights, selected Videos/custom shelf, artwork and reload/restart; [evidence](tasks/c6-video-publishing-ux/closeout.md). A verified upload preserves *placement intent*, not a public playable ChannelSpec binding. Real MediaConvert HLS, CloudFront publication and Vega playback remain unqualified under [p6-live-vod](tasks/p6-live-vod/README.md). Free approved delivery is distinct from conceptual future paid purchase/rental/subscription access; neither a public URL nor in-app paywall grants restricted viewer access. See [current state](CURRENT-STATE.md) and ADR 0013.

## Accepted managed VOD media lifecycle (2026-10-14, ADR 0011)

The historical P6 FFmpeg-job paragraphs above describe the initial implementation, not the currently approved future encoder. New FireLaunch-managed creator-uploaded videos depend on **AWS Video on Demand on AWS Foundation / MediaConvert** rather than a FireLaunch FFmpeg worker. The creator's existing MediaAsset/CatalogItem identity, upload ownership/rights and immutable rendition/publication linkage remain canonical. A managed job identity binds an owner-approved verified original to AWS account/region/job ID, immutable profile/version, private staging output, attempt/status/error and reconciliation state. READY requires trusted provider result and complete HLS verification; it is not a rights grant. Only a distinct explicit approved P5 publication may expose delivery URLs. Existing client ChannelSpec and public manifest playback contracts do not change. Legacy READY media and job records must survive correction; live cloud, playback and production qualification remain open. See ADR 0011 and c6-aws-vod.
## Creator Studio presentation target — Desert Heat (2026-10-17 UTC)

The owner-approved [visual baseline](design/studio-visual-baseline.md), [ADR 0012](decisions/0012-studio-visual-identity.md) and [original image provenance](design/references/README.md) establish a **future** full-viewport dark charcoal Studio with persistent project/sidebar and topbar, flexible central workspace and darkened red slot-canyon on contextual hero areas, contextual right action/inspector controls, restrained translucent elevated cards, readable typography/spacing, warm orange-to-red primary actions, and colorful media thumbnails retaining their own genre palettes. The dark outer frame in the screenshot is an illustration artifact, not a margin for the real app.

Reconcile this dashboard composition with the real Catalog, Create/Agent, Design, Content, Code, Build, Publish surfaces and the interactive 16:9 D-pad TV Preview. Actual source/import/Collection rights, private video upload/processing and creator-approved immutable publication take priority. Fictional user, titles, navigation entries and percentages are not new product features. Studio identity must never override creator-owned `ChannelSpec.brand` or Vega focus/navigation. This is docs-only design approval, not implemented/qualified behavior.

## Video access-policy compatibility (accepted 2026-10-17, ADR 0013)

The video asset and content inventory identity remains stable regardless of access model. The planned viewer access-policy domain recognizes `free`, `purchase`, `rental` and `subscription`; **only `free` is in initial P6 delivery scope**. The paid values are architectural future states, not current schema/UI fields or enabled catalog choices. Unknown or unimplemented protected states fail closed and are never promoted into publicly readable free HLS delivery. A shared private S3 -> MediaConvert -> verified private HLS processing pipeline feeds separate access-controlled publication/delivery paths. Approved free media can use stable CloudFront URLs in public manifests, whereas future protected media needs independent viewer entitlements and a versioned playback-resolution exchange outside immutable public manifests. Public release, creator TV display/playback rights and viewer entitlement are different authorizations. Already-public media cannot be made retroactively confidential by charging for it later. See [ADR 0013](decisions/0013-hybrid-video-access.md) and [P6 live-VOD plan](tasks/p6-live-vod/README.md).


## Creator video workspace: progressive lifecycle (owner approved 2026-10-19; c6-usability)

Each creator-owned video has one durable CatalogItem/MediaAsset identity and one reopenable, video-first Studio workspace. The workspace is a large accessible modal (full-screen sheet on narrow screens) accessible directly from Home, Catalog and each video card. It guides a human creator from first MP4/title/rights attestation through private upload, managed MediaConvert processing, video metadata/artwork, channel placement, verified publication review and post-publication management. Close/reopen and tab/project navigation must not erase server-backed work or claim to stop MediaConvert. Derive UI stages from current owned upload/processing/catalog/release records rather than creating a conflicting publication state machine.

Collect only the next necessary information: start with video file, editable title and one explicit TV display/playback/artwork attestation; keep description/category/thumbnail optional or progressively requested when relevant. Show next actions and plain-language blockers for missing provenance, TV-safe artwork, rights, verified HLS, ChannelSpec binding, deployment/readiness or publication authorization. Preserve the distinct audited rights scopes and never infer verification from a checkbox. A creator may keep a draft indefinitely. Any video saved in the library must reopen to the appropriate step and permit edits, replacement, retry, revocation and review as authorized. The modal owns presentation only; server-owned durable job state outlives it. Closing a modal must not abort an active browser transfer; closing or refreshing the browser during an incomplete transfer cannot be promised as resumable unless explicitly implemented with safe persisted multipart state and browser file re-selection.

Processing-ready is not public/live. The popup reuses existing Catalog/ChannelSpec projection and the existing creator-approved immutable LivePublication workflow, with an explicit confirmation stating that this changes the live channel, not merely an isolated video. Source provenance, exact verified rendition, rights, published HTTPS resolver and current project/catalog revisions must still pass server validation. Free-only currently; conceptual purchase/rental/subscription modes remain nonpublishable until protected access is implemented and qualified. Native Vega package build/export and Amazon submission are independent of video/channel publication.

Restore the supported media-duration admission target to 1-7200 seconds (two hours) end-to-end, including browser, server and verified HLS graph/publication limits. File size is an independent restriction: align the current Studio 250 MB admission with the existing 2 GB server ceiling if memory-safe browser checks and multipart uploads are validated; do not suggest any two-hour file automatically fits within 2 GB. Keep size limits truthful, enforced on both sides and separately review larger creator files. See c6-usability for the streaming hash, session lifetime, segment/object pagination, bounded cleanup and focused tests required for this change. This decision does not itself deploy or qualify 2-hour AWS processing.

## Per-video supporting media and immediate thumbnails (owner approved 2026-10-19; ADR 0014)

A creator's video groups its privately stored MP4, MediaConvert HLS, independently identified thumbnail versions and optional language-tagged subtitle tracks under one owned CatalogItem/video association. No separate supporting-media bucket is required. Legacy opaque private objects remain valid; group metadata and safe paths without bulk migration. Thumbnail rendering does not wait for video upload completion or encoding: selected custom JPEG/PNG (preferred) or a successfully extracted still appears immediately, persists as soon as safely possible, and replaces placeholders across Add Video, upload/progress, processing, Home, Catalog, video editor and private TV Preview. Stored thumbnails reload through an authenticated creator-scoped private-object fetch; an unavailable image falls back honestly. Private draft artwork is never made public just for Studio display.

On explicit creator-approved free publication, FireLaunch reviews display rights/provenance, verifies immutable selected artwork bytes and copies them into approved versioned delivery-only paths; it resolves a stable CloudFront URL into the existing PublishedManifest v1 artwork/media binding without changing the native wire contract. Editing the private artwork does not rewrite a currently live release. No external public HTTPS image URL is required for directly uploaded videos; legacy public URLs may remain an advanced compatibility option. The public CloudFront path policy must permit only approved precise image paths after separate operator authorization.

Subtitles are *optional* video supporting tracks (owner, video, normalized BCP 47 language, validated UTF-8 WebVTT, private object, checksum, version and rights/retirement semantics). A missing subtitle never blocks private or public video workflow. A private VTT track is not a qualified public or native caption feature. Public subtitle delivery/manifest changes and Vega device captions are deferred to a separately qualified compatibility step. See [ADR 0014](decisions/0014-video-supporting-media.md) and [c6-supporting-media](tasks/c6-supporting-media/README.md).

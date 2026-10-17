# c6-video-publishing-ux - Minimal creator video workflow

Status: OWNER-APPROVED DOCUMENTATION CONTRACT / IMPLEMENTATION NOT YET QUALIFIED
Date: 2026-10-16 (US Central); staging handoff 2026-10-17 UTC
Scope: Bounded manual one-off correction to FireLaunch 0.6.7 creator video workflow.
Execution: Manual GPT-6 Sol High; NOT a runner stack. No automatic version bump, commit, cloud provisioning or staging deployment.

## Why

The present Studio places Collections, private artwork/audio, repeated TV rights boxes, duration entry and Video master upload in one vertically stacked creator workflow. A privately uploaded S3 original was verified in staging, but that is not a published or playable TV item. A creator should manage videos and channels; FireLaunch manages storage, probes, encodes, catalog links, rendition readiness and release approval.

Staging reported one canonical firelaunch-staging.service on port 4184 at /srv/firelaunch/current, database firelaunch_alpha_067 schema 13, and a privately uploaded disposable MP4 that survived a restart and was denied to anonymous S3 reads. The running release was built from commit 7bf2c33 plus uncommitted upload changes. Treat the report as a handoff, not independently requalified evidence. Preserve the real original/canonical install and all data and recovery paths.

## One-screen Add Video contract

Five creator-facing fields:
1. Video file: required selection; project/creator determined from authenticated context, not a writable owner ID.
2. Title: required value; prefill from sanitized filename, editable before and after upload.
3. Description: optional free text, editable.
4. Category: optional choice defaulted to Videos or the project's existing video category. Do not require a new collection or channel choice when already inside a ChannelProject.
5. Thumbnail: optional custom image. Where a safe supported automatic frame extraction path exists, propose the generated still as the default; otherwise use an honest draft placeholder until artwork is ready. Never imply automatic generation succeeded when it did not.

One additional required creator action: a single explicit, unchecked attestation confirming rights for both TV display (including cover artwork where applicable) and TV playback/streaming for this uploaded work. Preserve separate, auditable display and playback rights in existing data/contracts. Record the assertion, subject, asset, applicable scope and timestamp according to existing models. An upload or attestation is not itself evidence of an independently verified grant. Additional rights details or third-party artwork provenance remain available in an advanced/needs-review path where needed; absent or revoked rights must never be silently allowed.

Do NOT request approximate duration, codec/resolution, S3 key, media use, storage destination, job ID, provider, TV playback URL or collection type. Derive duration/stream properties from supported trusted metadata inspection when ready, and enforce current server limits. Uploaded assets may remain incomplete or blocked until verified.

## Studio organization

- Primary creator action is Add Video, accessible from the relevant project video library/content view.
- Move Add/Edit Collection to a separate optional library management surface. An ungrouped video is permitted; channel default Videos shelf/category handles ordinary discovery.
- Retain general private media/artwork/audio capability in an appropriate advanced/general asset surface; do not delete its backend data model or make it a required first-video step.
- Keep upload state and publish state separate. Provide progress, repairable errors, retry/continue behavior and non-destructive persistence across reload.
- On success, link the uploaded MediaAsset to the project-owned CatalogItem, with stable identifiers and creator-edited metadata, without overwriting prior catalog associations. The expected channel TV presentation must use validated ChannelSpec draft/catalog bindings; creating a MediaAsset alone is not channel publication.
- Creator can review/change title, description, category and artwork in the library after upload.

## Truthful lifecycle and publication

Suggested user-facing phases: Draft -> Uploading -> Uploaded / Waiting for processing -> Processing -> Needs attention or Ready to publish -> Published. Derive from existing durable backend states; do not invent readiness or create a competing lifecycle. Distinguish a private successfully uploaded object, a verified playable rendition, a rights-approved item and a released immutable PublishedManifest. Never mark a video playable, public, Published or TV-qualified on the upload response alone.

Publishing is a distinct, explicit creator approval after media readiness, both rights scopes, required TV-safe artwork, project/catalog/ChannelSpec linkage, eligible CloudFront HTTPS playback and existing P5 publication safeguards. Reuse the existing immutable release pointer and last-known-good semantics. The creator must be able to leave a video as a draft indefinitely. Do not automatically publish after transcode, and do not invent device evidence.

## Media and security boundaries

- ADR 0011 controls new VOD: AWS Video on Demand on AWS Foundation / MediaConvert, private staging and verifiable HLS outputs. Do not revive FFmpeg worker processing, provision paid resources, switch buckets, or enable automatic public CloudFront output for this UI correction.
- Existing owned and CSRF-protected S3 multipart upload, MIME/size/hash limits, quota and cleanup, rights checking, revocation, private-object protection, foreign-tenant denials and signed URL exclusion remain intact.
- Respect optional thumbnail file validation and rights/provenance. A placeholder is not publication-qualified artwork; do not block saving a private draft for missing artwork.
- Current staging: MediaConvert/EventBridge/CloudFront disabled. Therefore allow private upload and truthful Waiting for processing / Processing unavailable indication, but forbid live publish/playback promises.
- Do not modify production/staging service, AWS, IAM, AWS buckets, databases, backup files, MediaConvert jobs or publishing pointers without explicit separate authorization.

## Minimum manual one-off acceptance

A. Existing staging upload behavior is preserved without discarding uncommitted upload changes; reconcile local HEAD/worktree before modifying anything, do not use reset/clean/forced pull.
B. One concise Add Video form includes the five inputs/defaults and a single unchecked attestation; collections, generic asset upload and approximate duration are not mandatory.
C. Title from filename and category default are editable, description can be blank; custom thumbnail is optional, honest fallback used when generation is unavailable.
D. Authorized upload creates durable owned draft CatalogItem + MediaAsset and sensible project/channel draft linkage; reload/restart retain edits and existing videos. No accidental publication.
E. Separate display/playback rights remain enforced and auditable; malicious client flags, foreign owner IDs, CSRF bypass, revoked rights and private media exposure are denied.
F. UI shows correct progress/failure/retry statuses; when AWS processing is disabled, Uploaded / Processing unavailable is honest and Publish remains blocked.
G. Focused tests pass for form, validation, rights and owner gates, metadata, compatibility, and blocked publish; run one appropriate aggregate check. Browser/manual proof when available; report any unverified gate.
H. A separate later qualification must exercise real S3 -> MediaConvert -> verified private HLS -> approved CloudFront -> immutable channel manifest -> SAME installed Vega VirtualDevice focus/detail/play/Back. No device or production Green inference from this one-off.

## Source and handoff

Canonical product and publication model: ../../PRODUCT-MODEL.md and ../../publishing.md.
Launch roadmap: ../../roadmap/mvp-roadmap.md.
Managed-provider authority: ../../decisions/0011-aws-vod-foundation.md.
Existing correction: ../c6-aws-vod/README.md.
Creator journey: ../../creator-onboarding.md.

This contract is documentation only. Manual implementation prompt supplied separately in the owner conversation. Do not create a runner manifest or mark a release Green solely from this document.

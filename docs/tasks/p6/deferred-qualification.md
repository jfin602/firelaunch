# Phase 6 deferred qualification gates

Owner decision: **2026-10-12** — proceed immediately with Phase 6 P1–P7 implementation on root `0.6.0`, deferring live P5/c5 qualification until Phase 6 integration, not removing those release gates.

## Directly established vs unproven

- P5 P1–P7 source is integrated, including strict publication/rights/public resolver and migration 010; historical [P5 P8](../p5/closeout.md) is NOT GREEN.
- [c5-vega P3](../c5-vega/closeout.md) is NOT GREEN. A real SDK-generated synthetic fixture VPKG was hash-verified; it was example-bound and **not installed** as an approved creator application. The VirtualDevice was available; no real creator release v1/v2/v3 was verified.
- An observed Flower Study video on Vega VirtualDevice has unknown build source, package identity, rights and origin; useful playback smoke only, not the same-installed release proof.

## Deferred gates: revisit during integration and no later than manual P8

| Gate | State | Evidence needed |
| --- | --- | --- |
| Creator OIDC/project and independently cleared TV display/playback rights | Unproven | Owned project/deployment, revisions, rights decision and authorized releases |
| Device-reachable public-only HTTPS manifest resolver | Unproven | Separate TLS vhost; manifest digest/ETag and denial of /api, Studio, private storage |
| One fresh creator/deployment-bound VPKG | Unproven | Actual installed package/version/hash, not example-origin fixture |
| Same VPKG remote v1→v2 update, offline LKG, invalid/downtime rejection, rights-approved new v3 rollback | Unproven | Actual device/network/screenshots/logs with no rebuild/reinstall |
| S3 private originals, durable FFmpeg processing and validated 480p/720p HLS | Unimplemented at start | P6 P1–P7 code then real AWS/operator evidence at P8 |
| CloudFront OAC, rights-safe publication and Vega HLS playback/seek/Back/recovery | Unproven | Private-S3 denial, real CloudFront HTTPS and native device proof |
| Historical P4 live provider, hosted S1–S6, physical Fire TV, Appstore, Fire OS/Roku | Separate gates | Preserve existing status and later owners |

P6 P1–P7 may run with mocked S3, synthetic local test media and headless checks; cloud account, test rights asset, creator public staging, and VirtualDevice are **not preflight requirements** for those implementation prompts. Actual P5 source/security functionality remains a hard implementation prerequisite: do not omit auth/CSRF/ownership, licensed rights checks, immutable manifests, or private S3. If missing, stop the affected implementation with a precise blocker.

**P6 P8 still cannot be GREEN without real rights-cleared S3→FFmpeg→CloudFront→Vega proof.** Deferred P5/c5 device sequence should be exercised alongside that integration where feasible, with separate closeout disposition; do not overwrite historical NOT GREEN reports. Cloud provisioning, staging DNS/Nginx changes, AWS spend and password-SSH access remain operator-controlled. Preserve Ngest.

## New managed provider carry-forward (2026-10-14)

Historical original P6 FFmpeg rows above are superseded as *future execution requirements* only by ADR 0011. Root 0.6.7 contains the historical FFmpeg implementation and must undergo fixed-version [c6-aws-vod](../c6-aws-vod/README.md) before live AWS-managed qualification. Future P6 P8 must demonstrate actual authorized S3 -> MediaConvert/Foundation -> private staged verified HLS -> explicit approved CloudFront -> installed Vega. All P5/c5 external gates, authorized rights, owner isolation and failed/retried-job safeguards remain open until directly proven. Do not reinterpret original NOT GREEN outcomes.

## Accepted live qualification override (2026-10-17)

The live [p6-live-vod](../p6-live-vod/README.md) plan and [Q1-Q3 matrix](../p6-live-vod/qualification-matrix.md) now organize future manual integration. [ADR 0013](../../decisions/0013-hybrid-video-access.md) permits **only explicitly approved free-to-view** CloudFront delivery with stable unsigned HLS URLs, subject to current IAM, OAC, exact `delivery/` path, private-origin negative tests, rights, publication and new operator authorization. Viewer-signature testing belongs to a future paid/protected delivery qualification; do not misstate this as an already-implemented paywall. Replace historical FFmpeg-only execution instructions with the managed AWS provider in new runs. Preserve historical P5/c5/P6 NOT GREEN evidence, real same-installed-VPKG refresh/offline/fault/rollback requirements and physical Fire TV/Appstore/hosted release gates.


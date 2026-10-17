# p6-live-vod - Qualification and acceptance matrix

Status: PLAN ONLY / NO LIVE Q1-Q3 EXECUTION
Authority: [README](README.md), [ADR 0013](../../decisions/0013-hybrid-video-access.md), ADR 0011 and current Phase 6 manual P8 runbook.

| Gate | Checkpoint | Required directly observed proof | Exit rule |
| --- | --- | --- | --- |
| F0 baseline | Q1 preflight | Actual single staging service/release/schema 13, backed-up rollback state, current AWS account/Region/stack, owner-approved sample, rights | STOP on mismatch/unsafe change |
| F1 operator permissions | Q1 | Real allowed/denied S3 actions using relevant assumed principals; separate publisher rights; no public originals/staged; review-only change sets before approval | Denials cannot be simulated-only |
| F2 cost + admission | Q1 | Explicit owner/operator AWS activation and limited paid-job consent; limits and spend observations; no automatic broad queue activation | STOP without approval |
| F3 encoder | Q1 | A real registered MediaConvert job, fixed profile, exact input/output, real observed status, error/retry/reconciliation, one suitable test master | No mocked job as GREEN |
| F4 HLS READY privacy | Q1 | Complete master/variants/segments with valid paths, MIME/bytes/hash and verified private staging; anonymous/CDN denial, no published manifest change | Q1 GREEN if F0-F4 pass |
| F5 viewer policy | Q2 | Free delivery policy pursuant to ADR 0013; canonical-path guard, restricted OAC S3, direct unapproved/staged/original denial, operator-approved CDN change set and enablement | No paid HLS on free path |
| F6 owned release | Q2 | Real account/project/deployment/rights/artwork, public-only TLS manifest host, approved verified video placement and explicit creator Publish, immutable release checksum/sequence, full approved CloudFront HLS graph | Q2 GREEN if F5-F6 pass |
| F7 revocation and isolation | Q2 | Cross-owner API denial, CSRF negatives, cannot publish draft/processing/revoked/foreign, bounded CDN invalidation & known caching limits, source and original privacy | Critical negative failure is NOT GREEN |
| F8 real player | Q3 | Fresh owned generated VPKG, exact package+hash/SDK/VirtualDevice OS, single install, actual adaptive HLS play/pause/seek/Back and error/recovery screenshots/logs | Browser simulator alone insufficient |
| F9 same package | Q3 | Published changed v2 live refresh without reinstall; offline LKG and invalid origin rejection; explicit rights-checked new v3 rollback showing v1 while preserving historic release bytes | Q3 GREEN if F8-F9 pass |
| F10 full closeout | P6 | Qualified Q1/Q2/Q3, final aggregate tests and exact failure/skip counts, Ngest unaffected, real job spend/quotas, carried P5/c5 status and remaining physical/Appstore/S1-S6 gaps | Only then claim bounded P6 live-VOD GREEN |

Use per-gate PASS, FAIL, BLOCKED or PARTIAL with timestamp, exact candidate SHA, sanitized evidence location, account/region and responsible operator. Do not infer new external evidence from offline tests or earlier staging uploads. Rollback/recovery must preserve immutable releases, S3 history, prior manifests and creator data; never remove source artifacts solely to clean up fixture.

## Strictly deferred after P6

Protected viewer entitlement/billing (`purchase`, `rental`, `subscription`), token exchange, signed CloudFront cookie/URL propagation and renewal, DRM, territory enforcement, refunds, Amazon purchase integration, physical Fire TV qualification and real Appstore approval. These require their own design, compliance review, implementation and device tests. Free videos may still be commercially monetized through sponsorship or future ad services, subject to separate platform/policy review.

# p6-live-vod - Real managed HLS publication and Vega qualification

Status: OWNER APPROVED MANUAL PLAN; 2026-10-18 owner reports a successful encode, but Q1 completion and Q2/Q3 live qualification are NOT independently confirmed by this document. See actual task closeouts.
Date: 2026-10-17 UTC
Type: Three MANUAL GPT-6 Sol High qualification checkpoints, not a runner stack.
Version: Existing running `0.6.7` stays unchanged for preparation and correction; historical P6 P8 proposed `0.6.8` must not be advanced without a separately reviewed version/closeout decision.
Authority: [hybrid access ADR 0013](../../decisions/0013-hybrid-video-access.md), [managed provider ADR 0011](../../decisions/0011-aws-vod-foundation.md), [qualification matrix](qualification-matrix.md).

## Purpose and trusted starting evidence

Demonstrate the complete creator workflow: authenticated Add Video -> private verified original -> real managed HLS -> explicit approved release -> approved CloudFront public free HLS -> native Vega VirtualDevice playback.

The `c6-video-publishing-ux` staging closeout is **STAGING UX GREEN** for source `86af42f4dc9ba48a8c5c823e59f100fa10698026`, deployed as `/srv/firelaunch/releases/20261017T025825Z-59a5a1e6921b` (archive SHA-256 `59a5a1e6921b010d02dfa31afb2790cfb0e945a6b12bda2608cc00c1112cb018`) with `firelaunch-staging.service`, port 4184 and PostgreSQL schema 13. One rights-owned 22,083-byte MP4 successfully uploaded privately; catalog/media/rights/shelf survived reload/restart and separate identity Studio denial; external MediaConvert/CDN/Vega proof does **not** exist. Staging state must be rechecked at run time, never inferred from documents. The short UX fixture might not be suitable for qualifying full 480p/720p encoding.

`c6-aws-vod` is LOCAL GREEN only; it does not qualify deployed processing. The client's existing `firelaunch-staging-foundation` stack has a previously qualified `UPDATE_COMPLETE` policy correction, while the last observed queue was PAUSED, EventBridge DISABLED and CloudFront DISABLED. Reinspect the actual live values; old operator documents misstate infrastructure as wholly undeployed. Keep client AWS account `363242105231`, Region `us-east-2` and separate developer-owned/client-owned stack authority clear. Do not touch unrelated account `309403336615` or launch duplicate stacks.



## Related creator usability correction (owner decision 2026-10-19)

[c6-usability](../c6-usability/README.md) separately owns the progressive reopenable per-video Studio popup, guided reuse of the *existing* publication UI and fully checked two-hour (7200-second) media limits. This revises the former deferral only for the basic client-facing video workflow needed before the October 23 noon deadline. It does not authorize adding advanced shelf ordering, multiple placements, featured merchandising or drag/drop before independent Q3 GREEN. Q2 remains responsible for the real approved free CDN/manifest and video lifecycle F7 proofs; Q3 remains responsible for real installed Vega playback. A popup saying Published cannot replace those direct observations. Neither Q1/Q2/Q3 nor any operator, paid AWS, CDN, deployment or creator approval is waived. See [current state](../../CURRENT-STATE.md) for dated evidence.

## Work sequence and stop gates

### Q1 - Real private processing

Inspect current repo, hosted service, AWS access and budget, account/region, existing resources, S3 source ownership/rights, MediaConvert fixed profile, queue and SQS/EventBridge binding. Qualify least-privilege control/publisher/service role and actual S3 permissions. Prepare operator-reviewed, bounded activation and rollback; obtain explicit approval for queue/rule changes and paid job. Run one suitable rights-owned short test master, obtain trusted MediaConvert job and event/reconciliation results, verify 480p/720p if suitable, exact original-to-job correlation and private HLS master/variants/segments/MIME/bytes/hashes. Prove READY is private, staging not CDN-accessible and no publication happened. Fail with specific AWS/job blockers rather than bypassing security.

### Q2 - Explicit free-video publication

**Minimum playback bridge only (owner decision 2026-10-18):** Reuse the already-persisted default `Videos` shelf/category and existing `CatalogItem`, `Collection`, `ChannelSpec`, `MediaAsset`, and P5 publication contracts to place **one** verified, owned, rights-cleared video in the first creator-approved live channel. The current catalog projection accepts public HTTPS media and may withhold `managed_hls` media from playable drafts; Q2 may correct only the necessary safe READY managed-HLS -> trusted reviewed HTTPS delivery URL binding. Resolve URLs server-side from the exact verified rendition; do not inject private staged/original URLs, placeholder signed URLs, or fake readiness into exportable ChannelSpec. Require publication validation and creator approval. Do not build new channel-placement, multi-shelf, ordering, drag-and-drop, featured-placement, or publish-workflow UI in Q2.

Resolve public-only device-reachable HTTPS manifest origin and creator-bound ChannelDeployment without exposing Studio/API; recheck rights-cleared TV artwork, title, shelf and verified private rendition. Apply ADR 0013: approved free HLS may use stable unsigned CloudFront URLs **only after** reviewed operator CDN policy enablement, verified viewer path guard, OAC private-S3 policy and tests for unapproved/foreign/staged/original paths. Maintain separation of control and publisher permissions. One actual creator approval promotes immutable verified rendition to canonical `delivery/` and publishes a versioned P5 manifest; verify full public HLS graph and resolver digest/ETag and fail-closed revocation limits. No paid/rental/subscriber content publication or fake IAP.

### Q3 - Installed Vega VirtualDevice

Run Q3 against the minimal Q2 published video and existing `Videos` shelf. No new channel placement or merchandising UX is required for the native-device test; limit source repairs to adaptive HLS playback, released-manifest behavior, and evidenced device faults.

Confirm installed Vega toolchain and actual VirtualDevice. Repair the generated adaptive HLS player as needed for the installed SDK's supported playback mode; the present template uses direct `VideoPlayer.src`, so inspect and qualify MSE/adaptive support rather than assuming HLS works in URL mode. Build and hash a fresh creator/deployment-bound VPKG from actual owned project/source; install once. Observe HLS start, pause, seek, Back, network recovery, focus/detail, and real device requests. Then perform same-installed-package approved manifest v1->v2, offline/invalid-release last-known-good, and a new approved v3 rollback, with no rebuild/reinstall. Preserve P5/c5 historical NOT GREEN and their independent gate statuses.

Each stage gets a separate factual GREEN/NOT GREEN report and stops at hard external gates. A Q1 GREEN does not imply Q2/Q3 are GREEN. P6 end-to-end GREEN requires all three plus full carried-forward release gates. Aggregate test policy: targeted tests during corrections, one final Node 24/npm 12 `npm run check` at final convergence plus `git diff --check` and browser/AWS/device observations. Do not repeat full suites unnecessarily.

## Explicitly deferred: post-playback placement tools

After Q3 is independently GREEN, review a separate proposed correction `c6-channel-video-placement` for creator-facing add/remove, multiple shelf assignments, explicit video and shelf ordering, featured placement, visual TV preview, and streamlined Publish Changes controls. This is a **future proposed scope**, not an active stack or an instruction to create/edit placement tools now. The existing `Videos` shelf and minimal Q2 binding are sufficient for the first playback qualification. Do not weaken owner/CSRF/rights or P5 immutable release safeguards to meet this sequencing decision.

## Safety and authorization

No authorization to turn on a queue, submit paid encoding, execute CloudFormation change sets, enable CloudFront, create signing keys, change DNS/HTTPS ingress, publish creator content, alter IAM, or deploy software is supplied merely by this documentation approval. Stop for separately scoped operator and creator publication approvals. Budgets notifications are not hard spend limits; use one-job admission/cost observation and check actual account credits/status. Protect originals, staged HLS, delivery, job history, rights, prior releases, database/schema 13, backups and off-host artifacts. Never restore the FFmpeg worker, deploy a second staging installation or affect Ngest. Record exact hashes/IDs with secrets and private content redacted.

Future viewer restrictions (`purchase`, `rental`, `subscription`) are **architecture-only** in ADR 0013. P6 creates no billing, entitlement, paid catalog UI or signed-playback feature. Unknown or restricted access policy must not be delivered on free public paths.

## Manual prompt assessment, plan and execution

Documentation assessment and plan: [prompt-assessment.md](prompt-assessment.md) and [implementation-plan.md](implementation-plan.md).

Run the following **manually and in order**, never through the Prompt Stack runner:

1. [Q1-managed-private-hls.txt](Q1-managed-private-hls.txt) - controlled real MediaConvert and private verified HLS. Requires separate AWS operator authorization and spend consent before live activation.
2. [Q2-free-cloudfront-publication.txt](Q2-free-cloudfront-publication.txt) - a real rights-approved FREE release over public-only HTTPS and CloudFront. Requires separate operator CDN and explicit creator publication approvals.
3. [Q3-vega-device-playback.txt](Q3-vega-device-playback.txt) - adaptive HLS on the real installed Vega VirtualDevice, v1/v2 remote update, offline LKG, isolated fault handling and new approved v3 rollback. Requires Q1/Q2 GREEN and additional release consent.

Prompts are ASCII-only text and may use up to three focused fix/retest cycles inside their own boundaries. They are authored instructions, **not executions or permission to incur AWS charges**. This manual task does not have a runner manifest, /activate gate or runner-owned commit. Do not run `npm run codex:stack -- p6-live-vod`.

The approved Q1-Q3 documents and ADR 0013 were fast-forward merged into **GitHub main on 2026-10-18**. Before running prompts, inspect local `git status`, branch and HEAD, and bring the current main documents into the checkout without discarding unrelated work; a dirty or diverged tree requires explicit non-destructive reconciliation. GitHub main and the local checkout are not proof of the last deployed staging release. Read [current state](../../CURRENT-STATE.md) and recheck external status. The old docs branch is historical, not the default execution source.

Record each checkpoint in `docs/tasks/p6-live-vod/Q1-closeout.md`, `Q2-closeout.md`, `Q3-closeout.md` only when actually exercised; summarize independent P6 result in `closeout.md` only after real testing. Keep separate UNKNOWN/NOT GREEN gates visible, avoid preemptive closeout files and do not claim execution from prompt authoring.

# p6-live-vod - Prompt assessment

Status: APPROVED PLAN / PROMPTS AUTHORED FOR FUTURE MANUAL EXECUTION, NOT RUN
Date: 2026-10-17 UTC
Model: GPT-6 Sol High for Q1, Q2, Q3.
Task type: three manual, independently closable qualification sessions, not a runner stack.
Scope authority: [README](README.md), [qualification matrix](qualification-matrix.md), [ADR 0013](../../decisions/0013-hybrid-video-access.md), [ADR 0011](../../decisions/0011-aws-vod-foundation.md).

## Decision

Use exactly **three dependency-ordered manual prompts**, each allowed a small bounded fix/retest loop and its own evidence-based GREEN/NOT GREEN closeout. The difference between stages is an external safety boundary, not an arbitrary implementation slice:

- Q1: real verified private S3/MediaConvert/EventBridge/SQS -> private READY HLS, **CloudFront disabled**.
- Q2: separately approved verified private READY -> **public free-only** CloudFront + owned creator-approved immutable PublishedManifest; no device claim.
- Q3: real creator/deployment-bound VPKG using a qualified HLS player on Vega VirtualDevice, then same installed binary release refresh/LKG/rollback.

A single combined live prompt risks crossing paid AWS, CDN public exposure and creator publication approvals without clear handoffs. More than three baseline prompts would repeat account/identity/source inspection and increase friction. Each prompt may make *bounded* repairs only for its own evidence; it must not preempt later gates. One prompt cannot be GREEN simply because its source compiles or a mock passes.

## Trusted start and drift risks

- [c6-video-publishing-ux closeout](../c6-video-publishing-ux/closeout.md) reports 0.6.7 staging UX GREEN for source 86af42f4dc9ba48a8c5c823e59f100fa10698026, release 20261017T025825Z-59a5a1e6921b, on the only canonical firelaunch-staging.service at API port 4184 and schema 13. The real 22,083-byte MP4 was privately uploaded and survived restart, but no HLS or publication was tested.
- [c6-aws-vod closeout](../c6-aws-vod/closeout.md) supports LOCAL GREEN only for managed job submission, trusted GetJob reconciliation, private HLS graph validation, and FFmpeg worker retirement. Provider settings, costs, output formats and native device are unqualified against real AWS.
- [deployed foundation correction](../c6-aws-integration-contracts/foundation-change-set-review.md) previously observed client account 363242105231, us-east-2, existing UPDATE_COMPLETE foundation, managed queue PAUSED, EventBridge DISABLED, CloudFront DISABLED. Recheck actual account, roles, policy, deployment and pricing on execution, not based solely on old documentation.
- Old infra/aws-media/template.yaml and client-account proposals are historical. Never redeploy an upstream Foundation stack or recreate buckets/CDN. Existing operator procedure under scripts/staging and infra/aws/staging is authoritative only after current source/live inventory.
- Upload success intentionally does not produce ChannelSpec playback or a published URL. Catalog/collection placement intent persists separately. Q2 must approve an eligible ready rendition through existing P5 contracts, not force an upload into a playable manifest.
- Existing templates/vega-channel/src/App.js sets VideoPlayer.src directly; native adaptive HLS compatibility is unproven. Q3 owns a targeted Vega player correction and real SDK/device testing.
- Later viewer-signature blockers in older integration docs apply to paid/protected video, not approved public-free delivery under ADR 0013; this change does not waive private S3 rights, canonical delivery prefixes, CDN exposure tests or paid-content fail-closed protection.

## Source boundaries to inspect, not rewrite

Q1: apps/server/src/{media-upload-service.ts,media-convert-provider.ts,managed-media-coordinator.ts,managed-media-job-repository.ts,media-convert-event.ts,media-convert-events-queue.ts,media-storage.ts,media-pipeline-repository.ts}; infra/aws-media/{hls-avc-aac-v1.settings.json,README.md}; infra/aws/staging/cloudformation/02-firelaunch-staging-foundation.yaml; scripts/staging/README.md. Database 013 managed attempts; current Roles Anywhere/default credential chain, MediaConvert queue/role, private S3 and SQS. Studio video status only if a narrowly proven defect requires repair.

Q2: apps/server/src/{publication-repository.ts,public-resolver.ts,media-storage.ts,api.ts}; apps/studio/src/LivePublication.tsx; hosted ChannelDeployment/ChannelSpec catalog projection and rights; docs/tasks/p5/public-https-staging.md; infra/aws/staging/cloudformation/02-firelaunch-staging-foundation.yaml; CloudFront distribution/OAC viewer-path guard and publisher role. No new paid/entitlement schema or client-facing paid selector.

Q3: templates/vega-channel/src/{App.js,release-client.js,remote-release.js}; packages/{generator,tv}; actual installed Vega CLI/SDK and VirtualDevice; docs/tasks/c5-vega/device-runbook.md and existing public-only resolver. Repair player lifecycle/MSE only as required; do not replace native client or weaken P5 remote-release integrity.

## Required external approvals and stop points

Documentation approval is NOT authorization to start billable encoding, unpause queues, enable EventBridge/SQS services, execute CloudFormation, enable public CloudFront distribution, change DNS/Nginx, deploy to canonical staging, issue signing keys, publish creator content or touch unrelated VPS services. A private rights-cleared fixture, exact operator identity, spend bound and permitted resource identifiers are prerequisites for Q1 live changes. Q2 needs distinct operator CDN/HTTPS activation and authenticated creator approval to publish; Q3 needs explicit owner consent for v2/v3 releases and isolated network/fault injection. Operator must inspect change sets before an execution decision. Stop a stage at the first missing permission without trying a broad sudo/password or alternate unapproved AWS account.

AWS Budgets alerts do not cap charges. Queue concurrency is not a bill limit. Do not expose staged or private bytes to CloudFront, including an opportunistic diagnostic workaround. Stop and protect the previous state on integrity/security regressions. Do not reset worktrees, overwrite uploads, drop/rewrite schema, delete buckets, break Ngest or resurrect the retired FFmpeg worker.

## Qualification and evidence policy

Q1 proves F0-F4 in qualification-matrix.md via actual trusted provider job and S3 HLS graph; Q2 proves F5-F7 via approved free public release and denial/revocation checks; Q3 proves F8-F9 with a single installed actual owner-bound VPKG, device playback and v1/v2/v3/LKG. F10 is the independent aggregate after all stages. A missing required real integration gate makes that stage NOT GREEN; do not use simulated tests to fill missing AWS/browser/device evidence. At each stage record source SHA, version, approved change IDs, rollback, exact checks/test counts/skips, redacted external IDs and actual costs where measurable. Use local focused tests per repair, one final full npm run check after convergence and stable source, not repeated in every small cycle.

Historical P5/c5/P6 closeouts stay NOT GREEN; 0.6.8 version advancement is separately approved, not automatic. Protected purchase/rental/subscription access, DRM, native signed-cookie/URL propagation, entitlement purchase validation, physical Fire TV and Appstore are outside this task.

## Authoring disposition

Prompt authoring is ready. Q1-Q3 are independent UTF-8 ASCII-only .txt files in this folder; handoffs point to each checkpoint's actual closeout. They intentionally cannot create a runner manifest or activate a stack. No live execution or qualification is claimed by authoring.

# c6-usability — Progressive creator video workspace

Status: DOCS APPLIED / PROMPTS AUTHORED / NOT EXECUTED OR QUALIFIED.
Approved: 2026-10-19 US Central. Deadline: October 23 at noon.
Version: root and lockfile 0.6.7 unchanged for all prompts.
See [assessment](prompt-assessment.md), [plan](implementation-plan.md), [product model](../../PRODUCT-MODEL.md), [architecture](../../ARCHITECTURE.md), [current state](../../CURRENT-STATE.md).

## Goal

One per-video, closeable/reopenable Studio popup on desktop and full-screen sheet on mobile. Add Video and each Home/Catalog video card open this workspace directly. Progressively request only the next needed information from initial file/title/unchecked display-and-playback rights, through private multipart upload, MediaConvert processing, artwork/metadata/collection review, basic channel draft placement, explicit channel-wide publication and post-publication maintenance. Private drafts are valid indefinitely.

Use existing owner-scoped CatalogItem, MediaAsset, upload sessions, managed jobs, ChannelSpec, ChannelDeployment, published release and rights/provenance contracts as source of truth. Closing the popup must not cancel an in-tab upload or server-managed encoding. Reopen after refresh from server state. Browser exit during unfinished upload cannot recover the File without real resumable-upload support; warn and offer safe retry. Show distinct Uploaded, Processing, READY, Needs review and Published, never fake progress/publication.

The popup must reuse the existing LivePublication readiness/approve/publish API, displaying that approval affects the whole reviewed live channel. Publishing remains separate from native Vega package export/Amazon submission. Free-only current path; do not expose paid/restricted media through unsigned CDN links. Keep advanced Catalog/provenance controls reachable, not first-page clutter.

## Two-hour support

Restore 1..7200 seconds end-to-end: client/server validation, safe large-file checksum+multipart/session behavior, MediaConvert HLS verification, public release graph and scoped revoked cleanup. Browser is presently 250 MB versus backend 2 GB; align to the existing 2 GB server ceiling only after memory-safe browser hashing and transport checks. Two-hour duration does NOT guarantee arbitrary files fit 2 GB. The current HLS profile (two variants, six-second segments) produces roughly 2403 objects at two hours, beyond existing 250-segment/600-object/1000-key limits. Change bounded pagination, memory and deletion behavior; never just raise a form constant. Actual paid two-hour processing and Vega remain separately qualified.

## Sequential stack

| Prompt | Scope | Model | Browser |
| --- | --- | --- | --- |
| [P1](P1-video-popup-library.txt) | Modal, stable identity and direct Home/Catalog access | GPT-6 Sol High | no |
| [P2](P2-upload-durability-two-hour.txt) | Background in-tab upload, incremental hash, 7200-sec admission | GPT-6 Sol High | no |
| [P3](P3-two-hour-hls-integrity.txt) | Paged verified HLS graph/publication and scoped cleanup | GPT-6 Sol High | no |
| [P4](P4-progressive-review-publish.txt) | Progressive data and existing explicit channel publish | GPT-6 Sol High | no |
| [P5](P5-creator-polish-tests.txt) | Lifecycle/status/a11y/client usability convergence | GPT-6 Sol Medium | no |
| [P6](P6-independent-usability-closeout.txt) | Fast UX smoke plus guarded live Studio deployment, manual | GPT-6 Sol High | yes |

P1-P5 use the runner; the runner owns commits. Exactly one final manual P6 closeout. No /activate; <=8 minute target / 15 minute ceiling per implementation checkpoint. Focused tests during implementation and reused at P6; only minimal focused verification and builds at closeout, not another full aggregate. Actual current checkout/version and dirty changes must be inspected before starting.

## Safety and execution

Owner update 2026-10-19: P6 is an autonomous repair, guarded deployment, and client AWS ingest-readiness task. The owner pre-authorizes required reversible, least-privilege configuration within the existing FireLaunch staging foundation in client account 363242105231/us-east-2, including enabling the existing MediaConvert queue/completion EventBridge rule after checking there are no unapproved pending jobs, and narrowly scoped IAM/S3/CORS/app integration fixes. Do NOT submit any paid test encode or public creator release. Only client-initiated future uploads may submit billable jobs. Preserve budget monitoring, exact roles/private S3, origin paths, existing release #1, Q2/Q3 gates and protected backup/rollback. No unrelated AWS resources, blanket credentials, public media exposure, destructive operations or unsafe migration. Preserve source rights, owner/CSRF, private S3 originals/staging, approved release #1, native device and Q2/Q3 historical evidence. Q2 F7 remains PARTIAL/NOT GREEN, Q3 UNSTARTED. Advanced multi-shelf ordering, featured and drag-and-drop remain deferred until Q3 GREEN.

After safely synchronizing GitHub main into the intended local checkout:

    npm run codex:stack:validate -- c6-usability
    npm run codex:stack -- c6-usability

The runner stops before P6; run its fast manual UX smoke and protected live Studio deployment after P1-P5 pass. If operator permissions/backup/rollback are unavailable, report DEPLOYMENT BLOCKED rather than bypassing controls. This authoring does not deploy the product.

## Urgent playback/artwork regression — must repair before P6 deployment

Owner screenshots (2026-10-19 Firefox) show TV Preview failing to play AV Test In HD and an uploaded thumbnail still rendering as a placeholder. Follow [R1 browser-playback and thumbnail repair](R1-browser-playback-thumbnail-repair.txt) against the actual local/deployed source, which may be newer than GitHub main; P6 now requires both defects repaired and focused tests/browser smoke before deployment. A private READY HLS asset cannot be made public just to obtain preview playback. No paid encode, public publication, CDN exposure or destructive AWS work is authorized by this repair. If either blocking regression persists, UX NOT GREEN and do not deploy that candidate.

## Owner-approved P6 acceleration (2026-10-19)

P6 autonomously repairs observed blocking issues (maximum two focused cycles), runs quick browser/targeted checks, deploys the tested app via the protected exact-command backup/rollback process, and puts the existing AWS private-upload/MediaConvert-completion pipeline into a ready-for-client-upload state. Configuration activation is pre-authorized only for the existing verified staging resources; check pending jobs and cost guards before unpausing. Do not trigger paid test encoding or change public content. Report UX, deployment and AWS readiness independently; Q2, actual two-hour paid processing and Vega qualification remain separate.

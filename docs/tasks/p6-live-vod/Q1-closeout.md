# p6-live-vod / Q1 closeout - GREEN reported for F0-F4 private encoding

Date: 2026-10-18 UTC (report supplied by FireLaunch owner).
Status: **Q1 GREEN for F0-F4, as reported by the owner from the completed source-bound Q1 qualification.**
Evidence provenance: **transcribed from the owner's 2026-10-18 closeout report, not an independent re-execution or an exact copy of the private worktree record.** The full original remains at `/home/jfin/.codex/worktrees/q1-live-vod/firelaunch/docs/tasks/p6-live-vod/Q1-closeout.md`. The exact local file was not available to this GitHub documentation update. Preserve it and reconcile its exact source fingerprint, sanitized media/rendition IDs, hashes, event details, fixture license, and gate evidence before Q2 publication. Do not substitute this summary for the original evidence or claim fresh AWS/database access.

## Qualified scope reported

- **Candidate:** `HEAD 150fd5b` plus **four uncommitted media source/test files**, root version `0.6.7`. The four paths and their content SHA-256/source fingerprint were not supplied in the chat summary and are **not reconstructed here**. The Q1 tested candidate may differ from the current GitHub `main` head. Do not lose or replace the original dirty worktree; use the source-bound local report to reconcile.
- **AWS identity:** client AWS account `363242105231`, Region `us-east-2`; owner reports a refreshed scoped `firelaunch-deployer` session and an independent read of the real provider job.
- **MediaConvert job:** `1792298238156-lo2djx`, observed terminal state **COMPLETE**. Its queue/profile/input/output/intent fields must be read from the original source-bound report or safely reverified; they are not listed in the supplied chat summary.
- **Private output:** **seven private HLS objects** reportedly passed checksum and format checks. Their master/variant/segment inventory, MIME, sizes and digests are recorded in the local Q1 evidence, not copied or invented here.
- **Application state:** PostgreSQL reportedly contains the correctly owner-scoped rendition in durable **READY** state. Exact creator/project/catalog/media/rendition keys and SHA-256 must be reconciled from the original closeout and private read-only DB route. READY means private processing success, **not** channel publication.
- **Security and publication:** queue **PAUSED**, event-processing rule **DISABLED**, CloudFront **DISABLED** at closeout; **no publication** created. The preflight had observed anonymous private original access denied (HTTP 403). Private staged object exposure, IAM tests and event-reconciliation details should be read from the original source-bound report before treating their individual requirements as independently documented here.
- **Checks:** **258 passed, 15 skipped, 0 failed**, with all **seven workspace typechecks and builds passing**, as reported. Skips were not itemized in the supplied summary and must not be represented as passes.
- **Budget:** owner reports AWS Budgets displayed **$0 posted** against the **$20/month** alert budget at that time; actual charges can lag and this does not establish zero final cost or a hard spending cap.
- **Operator access:** owner reports the existing protected read-only database route worked and **no new 24-hour sudo grant** was needed or made.

## F0-F4 qualification ledger (owner's recorded disposition)

| Gate | Reported result | Evidence boundary |
| --- | --- | --- |
| F0: staging/AWS/rights baseline | **PASS** | Qualified in the original Q1 worktree record; exact source/rights evidence needs transfer or read-only cross-check |
| F1: permissions and private-origin denial | **PASS** | Owner's F1 result; full IAM/HTTP decision matrix not copied into this summary |
| F2: spending approval and one-job admission | **PASS** | Owner's F2 result; precise approval, quotas and cost estimate/actual details in original local report |
| F3: real correlated MediaConvert encoding | **PASS** | Real job `1792298238156-lo2djx` observed COMPLETE by owner |
| F4: full private HLS/READY and no publication | **PASS** | Seven HLS objects checked and owned durable READY reported; exact hashes/rendition IDs in local source-bound evidence |

**Disposition:** Owner's final independent Q1 manual qualification was **GREEN for F0-F4**. This GitHub file exists to carry forward that reported result and identify the exact primary evidence; it is **not** a fresh independent AWS qualification, nor a substitute for the private source-bound details. The previous Q1 preflight NOT GREEN before AWS activation is historical, superseded for this specific tested candidate by the later owner-reported F0-F4 PASS. Other P5/c5/hosted, Q2 public delivery and Q3 device gates remain separate and unqualified.

## Required Q2 handoff and evidence reconciliation

Q2's locally reported first attempt closed **BLOCKED / NOT GREEN** solely because `main` lacked a documented Q1 GREEN record. The owner says its report is at `/home/jfin/dev/firelaunch/docs/tasks/p6-live-vod/Q2-closeout.md`; do not revise that historical disposition or pretend a public release occurred.

Before any Q2 publication action:

1. Non-destructively retrieve the **actual full** `Q1-closeout.md` from the Q1 worktree and its sanitized source-bound evidence, reconcile this transcription with it, and if necessary replace/extend this summary through a reviewed documentation-only update. Never clobber its four uncommitted source/test edits or discard its exact hashes.
2. Verify the qualified READY video against the **actual** target candidate/runtime and private PostgreSQL, including exact owned creator, project, catalog item, media asset, rendition set, private HLS master digest, source rights and default `Videos` shelf. These identifiers were not provided here and **must not be invented**.
3. Q2 may begin a **fresh read-only preflight** only after confirming Q1 GREEN is applicable to the same asset and runtime; this document alone does **not** authorize CloudFront, public manifest, DNS/Nginx, AWS, staging deployment, or creator publication.
4. Follow [Q2 free publication prompt](Q2-free-cloudfront-publication.txt) and [qualification matrix](qualification-matrix.md). Use the minimum trusted READY managed-HLS to `ChannelSpec`/approved stable HTTPS publication binding for **one** video in the existing `Videos` shelf. Keep expanded shelf ordering, featured placement, and creator placement UX deferred until **after Q3 GREEN**.
5. Obtain specific operator and creator approvals before any actual AWS change, public CDN activation or immutable creator publication. Preserve private originals, staging objects, backups, distinct tenant/CSRF/rights gates, previous releases and Ngest.

## Change boundary

This is a documentation-only transfer of the owner's Q1 result. No AWS API call, paid job, deployment, service restart, database migration, source commit/merge, CloudFront activation, Q2/Q3 execution or version bump occurred while authoring this file.

**Next action:** copy or reconcile the original detailed Q1 report into the repository without losing existing source-bound evidence, then re-run Q2's read-only eligibility preflight. Report Q2 GREEN only after separately observed and authorized published-delivery gates F5-F7.

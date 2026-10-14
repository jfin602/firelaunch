# Phase 6 AWS live video infrastructure handoff — 2026-10-14

Status: **PREPARED / NOT DEPLOYED**. AWS profile `firelaunch-admin`, Region `us-east-1`, account ending `6615`. No video upload, transcode, account-plan change, stack execution, Ngest change, SSH change, production service change, commit, or HEAD move occurred. This note is separate from the historical c6/P6 closeouts.

## Account reconnaissance

| Check | Direct result |
| --- | --- |
| Identity | IAM user `firelaunch-admin` in active account `309403336615`, created 2026-10-11. The user has `AdministratorAccess`; this is an operator identity, not a server runtime role. |
| Account plan | **Unverified.** The account API returns active state, not Free/Paid plan. MediaConvert `DescribeEndpoints` and `ListQueues` both return `SubscriptionRequiredException`. Treat service use as blocked; do not assume a plan upgrade is authorized. |
| Credits and expiry | **Unverified.** `billing get-credits` returns `AccessDeniedException: IAM user access not activated`. An authorized account owner must inspect AWS Settings/Billing directly; no balance or expiry was inferred. |
| Budget | Monthly USD 20 `Testing` cost budget exists. Email alerts are configured for actual `>85%` (USD 17), actual `>100%` (USD 20), and forecast `>100%`. AWS Budgets does not stop resources or charges. |
| Cost | Cost Explorer estimated unblended cost USD 0 for 2026-10-01 through 2026-10-14. Forecast is unavailable for insufficient history. This is delayed estimated billing data. |
| Existing media resources | No S3 buckets, CloudFront distributions/OACs, application IAM roles, CloudFormation completed stacks, MediaConvert queues proven, EventBridge rules or SQS queues were found. MediaConvert queue inventory itself was denied by subscription, so absence of queues is not proven by that API. |
| Public access | No account-wide S3 Public Access Block configuration exists. The proposed buckets each enable all four bucket-level blocks, bucket-owner-enforced ownership, SSE-S3 and TLS-only bucket policies. Set account-wide block separately only after reviewing unrelated future S3 requirements. |
| Quotas | Service Quotas lists 10 MediaConvert queues per Region and a default 200 concurrent jobs per on-demand queue. These published quota values do not override the observed subscription denial. Proposed queue concurrency is one. |

## Proposal and change set

The historical `template.yaml` assumes an FFmpeg worker. `foundation-overlay.yaml` assumes pre-existing buckets, CDN and control-plane role. None were found, so the new [foundation-initial.yaml](foundation-initial.yaml) is a fresh FireLaunch-specific **CREATE** stack, not the stock AWS Foundation deployment or an update of historical templates. It uses the checked-in `hls-avc-aac-v1.settings.json` profile (480p/720p); no provider job settings are accepted from a browser.

Change set `firelaunch-p6-initial-20261014-review3` in stack `firelaunch-p6-media-foundation` is `CREATE_COMPLETE / AVAILABLE`, **unexecuted**. Its CloudFormation template requires `CAPABILITY_NAMED_IAM`. It contains exactly 16 `Add` actions, no `Modify`, `Remove` or replacement: two versioned private S3 buckets, two TLS/OAC bucket policies, one CloudFront OAC, one GET/HEAD HTTPS distribution, one cache policy, control-plane/publisher/MediaConvert roles, a paused one-job on-demand MediaConvert queue, encrypted event and dead-letter SQS queues with two source-rule-limited policies, and one disabled EventBridge rule. No S3 objects, public ACLs, reserved queue pricing commitment or automatic public output are included. Source and output buckets and the distribution have retention policies for later stack removal.

Template SHA-256: `ef717c31e3ac3897350d0d0870f2e87c2f47e49cfbb89f90f6383662eb239adb`. `cloudformation validate-template` passed; the live change set lists only additions. CloudFormation validation and a change set do **not** prove that execution would succeed, that MediaConvert will accept the profile, that deployed OAC/S3 denial works, or that the service is available to this account.

The change set's review parameter `StagingOrigin=https://firelaunch.jfin.dev` matches the current Studio host. **Its `ControlPlanePrincipalArn` is the operator IAM user only because no server runtime principal exists in this AWS account. Do not execute this review change set as production configuration.** Replace it with a verified short-lived server runtime principal and create a new reviewed change set; never put the operator's long-lived IAM credentials on the server. The IAM user also requires identity-side `sts:AssumeRole` authorization to assume the control role.

The MediaConvert service role can read only `original/` objects and write only `staged/` objects. The OAC policy can read only `delivery/` objects. The event rule filters account, Region, queue and job status; EventBridge alone can send to the private queues. The control role admits/uploads/verifies originals, reads and normalizes staging, submits/observes jobs and receives queue messages. The publisher role alone can read staged and write approved delivery. **Current server code constructs S3 clients from one default AWS credential chain and does not switch to publisher-role credentials for publication.** Until that credential separation is implemented and tested, the least-privilege proposed roles cannot be used for a successful end-to-end publish. Granting delivery writes to the control role to bypass this would defeat the intended boundary.

## Cost and account limits

For one 30–60 second H.264 video at **up to 30 fps**, the existing two outputs are one SD 480p and one HD 720p. AWS Price List for `us-east-1` Basic single-pass AVC lists USD 0.0075 per SD output minute and USD 0.015 per HD output minute, so estimated encoding is **USD 0.01125–0.02250** for 30–60 seconds. Above 30 fps, different settings, rejected jobs/retries, and actual profile classification can change the charge. Add S3 request/storage, CloudFront viewer traffic, SQS/EventBridge and logs if used. Empty infrastructure has no MediaConvert job charge, but the USD 20 budget is an alert and not a hard ceiling. Credits, eligibility, and Free/Paid plan compatibility remain unknown. No paid test may proceed while MediaConvert returns `SubscriptionRequiredException`.

## Review, activation and rollback

1. Account owner verifies plan, usable credits and expiry, MediaConvert availability in `us-east-1`, and whether any plan change is needed. **Do not upgrade automatically.** Separately verify rights for a creator-owned 30–60 second source and artwork. The current change set is for architecture review only.
2. Establish a narrow, short-lived server AWS principal and update the template parameter/trust. Complete the publisher-role credential split in FireLaunch and test it. Create a replacement `CREATE` change set with the reviewed principal and exact HTTPS Studio origin; inspect every action, bucket name, IAM trust and OAC policy. Seek separate operator approval before `execute-change-set`.
3. After approved execution, record stack outputs. Set server-only `FIRELAUNCH_MEDIA_AWS_REGION=us-east-1`, `FIRELAUNCH_MEDIA_ORIGINALS_BUCKET=<OriginalsBucketName>`, `FIRELAUNCH_MEDIA_DELIVERY_BUCKET=<DeliveryBucketName>`, `FIRELAUNCH_MEDIA_CLOUDFRONT_ORIGIN=https://<CloudFrontDomainName>/`, `FIRELAUNCH_MEDIA_CLOUDFRONT_HOSTS=<CloudFrontDomainName>`, `FIRELAUNCH_MEDIACONVERT_ACCOUNT=309403336615`, `FIRELAUNCH_MEDIACONVERT_QUEUE_ARN=<MediaConvertQueueArn>`, `FIRELAUNCH_MEDIACONVERT_ROLE_ARN=<MediaConvertRoleArn>`, and `FIRELAUNCH_MEDIACONVERT_EVENT_QUEUE_URL=<MediaConvertEventQueueUrl>`. The default AWS SDK credential chain must resolve the **runtime control role**, not the operator user; publication must separately assume `<PublisherRoleArn>`. Keep credentials and private object identifiers out of Git, browser, generated source and published manifests.
4. Before a job, verify deployed bucket public-access blocks, anonymous direct-S3 denial, OAC denial for `staged/`, delivery-only bucket policy, queue `PAUSED`, event rule `DISABLED`, full profile acceptance and budget notifications. Record immutable private source SHA/bytes, owner, rights, quota and durable job intent. Enable the exact stack-output EventBridge rule and one-job MediaConvert queue only for the approved test window, then admit one job through the authenticated FireLaunch path. A source upload or MediaConvert `COMPLETE` never publishes. Check `GetJob`, private HLS graph and creator-approved promotion before any CDN request; test the installed Vega package separately.
5. On failure, pause the MediaConvert queue and disable the EventBridge rule, reconcile job IDs and SQS/DLQ, leave originals/staging and prior published versions intact, and correct policies via a new change set. Do not delete a stack or buckets blindly: S3 buckets and distribution are retained, and their objects and versioned data require a separate inventory and approval. To abandon the **unexecuted** proposal, delete the review change set only. Recheck the USD 20 budget and actual billing after any approved test.

Approval review command (read-only):

```sh
aws --profile firelaunch-admin --region us-east-1 cloudformation describe-change-set \
  --stack-name firelaunch-p6-media-foundation \
  --change-set-name firelaunch-p6-initial-20261014-review3
```

There is deliberately no execution command in this handoff. Change-set review does not authorize account-plan changes, deployment, upload, transcoding or public media release.

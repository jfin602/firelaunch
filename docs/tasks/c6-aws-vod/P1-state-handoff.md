# P1 managed media state handoff

This is a local schema and repository checkpoint at root `0.6.7`. No AWS job was submitted.

## Durable identity and admission

`managed_media_job_attempts` is additive to migration 011/012. Each row owns one immutable intent token, processing job, verified upload identity, attempt (at most three), profile hash, private staging prefix, AWS account and Region. The provider job ID is nullable only until registration and is unique with account and Region. Composite foreign keys preserve creator/project/item/asset ownership. Existing READY renditions and P5 manifests remain unchanged.

`ManagedMediaJobRepository.reserve()` requires a verified creator identity, owned video asset, verified upload, unrevoked rights, expected job version and a bounded attempt. A pending or failed legacy job can be admitted; a leased legacy job must finish or fail through its existing lease first. READY and revoked jobs cannot be adopted. An existing live intent is returned idempotently. `MediaWorkerRepository.claim()` and the legacy creator lease path exclude jobs with any managed attempt. No managed path is connected to upload submission yet.

P2/P3 must use `ManagedMediaProvider` from the private contracts module and persist the intent **before** invoking MediaConvert. A lost CreateJob response leaves the intent unresolved. [AWS documents](https://docs.aws.amazon.com/mediaconvert/latest/apireference/idempotency.html) that `clientRequestToken` deduplicates only within one minute; a retry beyond that window must first reconcile a trusted provider job ID or stop for operator review. The intent token can be used in `userMetadata`, but metadata or `jobs-manifest.json` alone is never owner proof.

## Observation and cancellation

`register()` accepts only a trusted submit result matching the reserved account and Region. `observe()` accepts the strict normalized `ManagedJobObservation` with registered AWS job ID, account, Region, one of `SUBMITTED`/`PROGRESSING`/`COMPLETE`/`ERROR`/`CANCELED`, and an error code only for `ERROR`. P2 must verify the EventBridge source, detail type, envelope/detail account, Region and correlated job ID before reduction. [MediaConvert events](https://docs.aws.amazon.com/mediaconvert/latest/ug/mediaconvert_event_list.html) do not normally emit `SUBMITTED`; use it for CreateJob/GetJob state, and normalize nonterminal `INPUT_INFORMATION`/`STATUS_UPDATE` to `PROGRESSING` only after validation.

Duplicate, older and conflicting terminal observations are ignored. `ERROR` or `CANCELED` makes the processing job `failed` with the existing compatible `encode_failed` code; the provider error code stays private in the attempt row. A later attempt requires a fresh expected job version and consumes the next of three total attempts. `COMPLETE` records provider completion but leaves the processing job pending. P3 must verify the entire private HLS graph and rights before creating a READY rendition. `due()` and CAS `checkpoint()` support restart reconciliation.

Revocation is locally final even if provider cancellation fails. It sets `cancel_requested_at`, removes readiness, and blocks late observations. If a submit response arrives after revocation, `register()` still records its job ID for best-effort cancellation; `cancellationsDue()` and CAS `cancellationChecked()` support that follow-up. P2/P3 must wire actual `CancelJob` and distinguish successful cancellation from a failed/unknown provider call. No staged object becomes public through any P1 transition.

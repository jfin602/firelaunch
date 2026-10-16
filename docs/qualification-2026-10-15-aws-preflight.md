# FireLaunch staging AWS integration preflight — BLOCKED

Observed 2026-10-16 01:11 UTC (2026-10-15 CDT). Repository HEAD: `01069f0` at root `0.6.7`. This is a preflight report, not P6/P5/Vega qualification. No AWS stack update, change set, MediaConvert job, CloudFront enablement, S3 write, VPS change, certificate request, or deployment was performed.

## Verified live state

- AWS CLI `2.38.0` using `firelaunch-deployer` in `us-east-2` returned account `363242105231` and `arn:aws:sts::363242105231:assumed-role/FireLaunch-Staging-Deployer/...`.
- `firelaunch-staging-foundation` is `CREATE_COMPLETE`, with the expected execution role. Drift detection `18507350-c8fe-11f1-90c0-02947b42f5d5` completed `IN_SYNC`, zero drifted resources. All 14 foundation output values in the supplied `outputs/stack-outputs.json` match live `describe-stacks` output.
- The live MediaConvert queue is `PAUSED`; the job event rule is `DISABLED`. The CloudFront distribution `E3E4ESF38V413L` is disabled, has an OAC, has origin path `/delivery`, has no trusted key group yet, and has a viewer-request lock function. The media bucket policy grants that distribution read access only to `delivery/*`. Account and media-bucket S3 Block Public Access settings are all enabled.
- The live app and publisher roles have the supplied permissions boundary and their respective managed policies. App role trust is limited to the stated Roles Anywhere CA, trust anchor, and exact VPS subject CN. Publisher role trust names only the app role. The repository already uses default AWS credentials for originals/staging and refreshable STS `AssumeRole` credentials for publication; `FIRELAUNCH_MEDIA_PUBLISHER_ROLE_ARN` is the required server-only variable. The current publication session requests 3600 seconds; the continuation document suggests 900 seconds as an example, so duration can be reviewed without weakening the role split.

## Bundle and repository reconciliation

The supplied archive is already represented in the initially untracked `infra/aws/staging/` tree. All 17 archive files are present; 13 are byte-identical. Four scripts differ because the local copies require explicit app-user selection, preserve existing key/configuration, avoid a potentially unsafe live write probe, and separate change-set creation from execution. These local safety edits were preserved. The live foundation template differs from the local template only by a final newline. The older `infra/aws-media/foundation-overlay.yaml` is a review-only proposal that would create another queue, service role, event queue, and rule; it must not be deployed alongside this foundation as-is.

## Blocking mismatches

1. **S3 key layouts and IAM permissions differ.** Current application keys are `media/<creator>/<project>/<asset>/staged/<set>/...` and `media/<creator>/<project>/<asset>/delivery/<set>/<hash>/...`. The deployed app and MediaConvert policies read/write only top-level `staged/*`, and the publisher policy writes only top-level `delivery/*`. IAM simulation with `aws:RequestedRegion=us-east-2` and `s3:ResourceAccount=363242105231` returned `implicitDeny` for the app's actual staged read, the service role's actual staged write, and the publisher's actual delivery write. It allowed the app's top-level staged read and publisher's top-level delivery write; the app's top-level delivery write was denied. This is a policy/key contract mismatch, not a reason to widen app permissions.
2. **CloudFront origin path does not map to the emitted URL.** FireLaunch emits `https://dl2jzii5bnotd.cloudfront.net/media/.../delivery/...`; the deployed distribution prepends `/delivery` to the origin request, so it would request `delivery/media/.../delivery/...`, not the object written by FireLaunch. AWS documents this origin-path behavior. The current disabled distribution prevents exposure while this is resolved.
3. **Viewer signing is not integrated.** The deployed template will require CloudFront signed requests once its signing key group is enabled. FireLaunch currently records a stable unsigned HLS master URL in the public manifest and has no CloudFront signed-cookie or signed-URL path for every playlist and segment on the Vega client. Signing only the master would not cover the remaining HLS requests. The current public-manifest contract and the requested signed distribution need an explicit design decision and offline/device validation before any CDN enablement.

The archive's `firelaunch-staging.env` still has a placeholder for the already implemented `FIRELAUNCH_MEDIA_PUBLISHER_ROLE_ARN` variable. This is a configuration dependency, not authorization to deploy the value to the VPS yet.

## Offline qualification

- The foundation template passed `aws cloudformation validate-template`; VPS and deployment scripts passed `bash -n`.
- Focused managed-media, credential-split, HLS, hosted-policy, and infrastructure tests: **33 passed, 0 failed**. Server typecheck and build passed. `git diff --check` passed. These tests use local fakes and did not prove AWS data-plane or Vega behavior.
- The supplied VPS scripts were inspected. Step 1 keeps the private key on the VPS and refuses overwrite; step 2 checks certificate/key match and CA chain before installing a `credential_process` profile while preserving other profiles; step 3 verifies the expected STS role and originals-bucket reachability. Step 3 intentionally does **not** prove delivery-write denial; IAM simulation and a separately authorized bounded live probe are required after certificate installation.

## Stop and dependencies

Preflight did **not** pass. Resolve and review one consistent S3 key/IAM/CloudFront origin mapping and a signed HLS access design compatible with the installed Vega client and public manifest contract. Keep staging private and the distribution disabled until these contracts pass offline tests and a reviewed change set is explicitly authorized. After that, verify the VPS service user and access, generate its key and CSR **on the VPS**, obtain the client's signed certificate, install the verified official Roles Anywhere helper, and prove the VPS STS identity and role denials. Staging deployment, live object probes, CloudFront delivery, MediaConvert activation/job submission, rights-cleared media, billable qualification authorization, and Vega playback remain outstanding. Historical P5/c5/P6 live gates remain open.

Primary CloudFront references: [origin path](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/DownloadDistValuesOrigin.html) and [signed cookies for HLS](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-choosing-signed-urls-cookies.html).

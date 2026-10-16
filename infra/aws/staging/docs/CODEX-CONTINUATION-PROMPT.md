# Superseded delivery activation step (2026-10-15)

This original continuation prompt describes the deployed pre-correction state. Its top-level `staged/` and `delivery/` IAM layout and its instruction to enable CloudFront by supplying a public key are **not safe next steps** for the current application. The local correction at `docs/tasks/c6-aws-integration-contracts/closeout.md` keeps CloudFront disabled, changes the proposed foundation paths to nested `media/<creator>/<project>/<asset>/...`, and separates the client-owned IAM handoff. Viewer-signed HLS has not been implemented or qualified on installed Vega; stop before VPS, CDN, jobs or publication.

You are continuing FireLaunch staging integration for JFin. Work in the existing FireLaunch repository and on the existing staging VPS. Do not create a new app, change hosting, replace the database, or alter the deployment architecture.

FIXED FACTS (verified 2026-10-15 from CloudFormation outputs; do not change or invent values)
- AWS account: 363242105231 — the ONLY account for FireLaunch. Never use or modify account 309403336615.
- Region: us-east-2.
- Human access: JFin's AWS IAM account access portal https://aa-9j7mp5d1b.account-access.us-east-1.app.aws with two assigned roles in 363242105231:
  - firelaunch-developer-jfin (read-only)
  - FireLaunch-Staging-Deployer (deploys the foundation stack through the execution role; media/job/queue/log operations; delivery cleanup + CloudFront invalidation; cannot publish to delivery/, cannot assume the publisher role, cannot touch IAM users/keys, KMS signing, Roles Anywhere, billing or org settings)
- CloudFormation execution role (must be passed for every foundation change): arn:aws:iam::363242105231:role/firelaunch-access/firelaunch-cfn-deployer
- Stacks: firelaunch-staging-access (client-owned, do not modify), firelaunch-staging-foundation (yours to maintain), firelaunch-staging-workload-identity (client-owned, do not modify).
- Originals bucket: firelaunch-staging-originals-363242105231-use2
- Media bucket (staged/ = MediaConvert output, delivery/ = published): firelaunch-staging-media-363242105231-use2
- MediaConvert queue (PAUSED, on-demand): arn:aws:mediaconvert:us-east-2:363242105231:queues/firelaunch-staging-encode
- MediaConvert service role: arn:aws:iam::363242105231:role/firelaunch/firelaunch-mediaconvert
- Job event queue: https://sqs.us-east-2.amazonaws.com/363242105231/firelaunch-staging-mediaconvert-events (DLQ: ...-events-dlq). EventBridge rule firelaunch-staging-mediaconvert-jobs is DISABLED. Job-state audit log: /firelaunch/staging/mediaconvert-job-events
- CloudFront: distribution E3E4ESF38V413L, host dl2jzii5bnotd.cloudfront.net, origin path /delivery via OAC E3FC82P2MZSJ0K. Currently DISABLED and locked (403) until a signing public key is supplied.
- VPS workload identity (IAM Roles Anywhere):
  - Trust anchor: arn:aws:rolesanywhere:us-east-2:363242105231:trust-anchor/a6180607-0f41-4054-9654-d5f16df17d56
  - Profile: arn:aws:rolesanywhere:us-east-2:363242105231:profile/709699e9-1312-4eb6-ac48-9bb129335911
  - App role: arn:aws:iam::363242105231:role/firelaunch/firelaunch-staging-app (accepts ONLY a certificate with CN=firelaunch-staging-vps issued by "FireLaunch Staging Roles Anywhere CA")
  - Publisher role: arn:aws:iam::363242105231:role/firelaunch/firelaunch-staging-publisher (assumable ONLY by the app role)
- Bedrock: NOT authorized yet. No role may invoke models. Do not invoke Bedrock. Keep the model configurable.
- IaC + scripts: the firelaunch-aws-infra bundle (cloudformation/, scripts/, outputs/, docs/).

RULES
- Never put developer credentials on the VPS. Never copy private keys off the machine that generated them. Never commit credentials, private keys, or certificates' private material.
- Every billable step (encoding job, Bedrock call) needs explicit written authorization from the client (Michael) first; record who authorized it and when.
- Never solve a permission error by giving the app role publisher rights or by widening IAM; report it.
- Do not claim anything works until you have run the verification command and captured its output.

TASKS (in order; stop and report on any failure)
1. Verify identity. On your workstation: install current AWS CLI v2; in a browser sign in to the account access portal and open account 363242105231 with role FireLaunch-Staging-Deployer; then run `aws login --profile firelaunch-deployer` (choose region us-east-2 and the session tile). Run `aws sts get-caller-identity --profile firelaunch-deployer` and confirm Account=363242105231 and assumed-role/FireLaunch-Staging-Deployer. If it shows 309403336615, stop. Configure Codex to use AWS_PROFILE=firelaunch-deployer. (`aws sso login` does not work with this access method.)
2. Import/reconcile IaC. Add the bundle to the repo under infra/aws/ (exclude nothing secret — the bundle contains none). Run `aws cloudformation detect-stack-drift` on firelaunch-staging-foundation and confirm IN_SYNC. Compare outputs/stack-outputs.json with `describe-stacks`. Reconcile any existing infra proposals in the repo with these names; do not create duplicate resources.
3. Publisher credential split. In the app, keep the default AWS credentials = app role (profile firelaunch-staging-app). For publication only, call STS AssumeRole into the publisher role ARN above (short session, e.g. 15 min, with a session name that identifies the asset). Only the publisher credentials may write/delete delivery/ objects or create CloudFront invalidations. Define the config variable name in code; do not hard-code ARNs.
4. VPS key + CSR. Copy scripts/vps/ to the VPS. As root run `FIRELAUNCH_APP_USER=<app unix user> ./01-generate-key-and-csr.sh`. Send ONLY /etc/firelaunch/aws/firelaunch-staging-vps.csr to Michael.
5. Certificate exchange. Michael signs it (docs/CLIENT-RUNBOOK.md §1) and returns firelaunch-staging-vps.pem + firelaunch-staging-ca.pem. Verify the certificate matches the VPS key (step 6 does this).
6. Short-lived VPS credentials. Install aws_signing_helper from the official AWS IAM Roles Anywhere credential-helper page (verify its SHA-256). Run `./02-install-certificate-and-helper.sh firelaunch-staging-vps.pem firelaunch-staging-ca.pem`. This writes profile firelaunch-staging-app with credential_process.
7. Verify VPS STS. Run `./03-verify.sh`. Required: Account 363242105231 and arn:aws:sts::363242105231:assumed-role/firelaunch-staging-app/<serial>; delivery/ write must be denied for the app role. Save the output.
8. Staging environment variables. Apply outputs/firelaunch-staging.env values to the app config (AWS_PROFILE=firelaunch-staging-app on the VPS). Add the publisher-role variable defined in task 3. Leave BEDROCK_MODEL_ID unset/disabled.
9. Deploy the existing app to staging using its existing deployment scripts. Do not change hosting.
10. Boundary checks (non-billable): with the app profile confirm originals put/get, staged read, delivery write DENIED; with assumed publisher credentials confirm delivery put/delete allowed and originals write DENIED. CloudFront: generate an RSA-2048 signing key pair ON THE VPS (private key stays there, readable only by the app user), put the PUBLIC key PEM into a parameters JSON file and run scripts/deploy-foundation.sh with CloudFrontSigningPublicKeyPem set; review the change set (it adds a public key + key group, removes the lock function, and enables the distribution). Then verify an unsigned request to https://dl2jzii5bnotd.cloudfront.net/<any> returns 403 and a signed one for a test object returns 200. Protect manifests AND segments (signed cookies scoped to the asset path, or signed URLs on every playlist/segment).
11. Enable processing (ONLY after Michael authorizes encoding in writing): redeploy the foundation with QueueStatus=ACTIVE and EventProcessingState=ENABLED; start the app's event consumer.
12. One authorized, rights-cleared qualification encode: H.264/AAC HLS 480p + 720p through firelaunch-staging-encode with the firelaunch-mediaconvert role; outputs under staged/. Watch /firelaunch/staging/mediaconvert-job-events and the event queue; confirm the DLQ stays empty.
13. Verify HLS: master and variant playlists and all segments exist under staged/, correct content types (application/vnd.apple.mpegurl / video/MP2T or as MediaConvert writes them), playable locally.
14. Rights-controlled publication and revocation: publish via the publisher role to delivery/, play through CloudFront with signed access; then revoke (delete delivery objects + invalidation via publisher credentials) and confirm new requests fail. Document that already-downloaded content and in-flight cached responses cannot be recalled and that signed URL/cookie expiry bounds exposure.
15. Vega virtual-device playback of the signed HLS stream; capture logs.
16. Evidence: record commands, outputs, job IDs, timestamps, and pass/fail per step in docs/qualification-<date>.md. Afterwards set QueueStatus back to PAUSED unless Michael says otherwise.

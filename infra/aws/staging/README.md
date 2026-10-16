# firelaunch-aws-infra

**2026-10-15 integration correction:** The deployed top-level `staged/` and `delivery/` assumptions in this original bundle do not match FireLaunch's nested `media/<creator>/<project>/<asset>/...` keys. The local foundation template now proposes corrected nested IAM/OAC paths, no CloudFront origin path, and `DeliveryDistributionEnabled=false`. Nothing in this bundle has been redeployed. Read `docs/tasks/c6-aws-integration-contracts/closeout.md` and `client-iam-handoff.md` before using the older continuation instructions. Viewer-signed HLS is not yet implemented or Vega-qualified; do not enable the distribution.

Infrastructure as Code for FireLaunch staging in AWS account 363242105231 (us-east-2).
Start with HANDOFF.md. No credentials, private keys or secrets are in this bundle.

- cloudformation/01-firelaunch-staging-access.yaml        client-owned (deployer role, execution role, KMS CA key, budget, analyzer)
- cloudformation/02-firelaunch-staging-foundation.yaml    developer-maintained (S3, MediaConvert, events, CloudWatch, CloudFront, app/publisher permissions)
- cloudformation/03-firelaunch-staging-workload-identity.yaml  client-owned (Roles Anywhere, app + publisher roles)
- iam/firelaunch-developer-boundary.v2.json               permission boundary applied to every FireLaunch workload role
- outputs/stack-outputs.json, outputs/firelaunch-staging.env   deployed values
- scripts/deploy-foundation.sh                            change-set based foundation updates (deployer role)
- scripts/ca/firelaunch_ca.py                             KMS-backed CA: make-ca / sign-csr / verify (client admin only)
- scripts/vps/01..03                                      VPS key + CSR, certificate + credential helper install, STS verification
- docs/CLIENT-RUNBOOK.md, docs/CODEX-CONTINUATION-PROMPT.md

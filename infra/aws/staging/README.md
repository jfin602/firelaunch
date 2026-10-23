# VegaLaunch AWS infrastructure migration status

**2026-10-23 rename status: NOT GREEN.** This directory contains the deployed AWS stack's historical FireLaunch physical resource names, templates, role policies, client certificates, and output snapshots. The application now uses VegaLaunch environment keys and a VegaLaunch AWS profile, but the live buckets, IAM roles, MediaConvert queue, and related AWS resources still have their original physical names. These templates are retained as an inventory of that deployed stack; do not use them to create replacement resources or rename resources by text substitution. An explicit data-preserving AWS and installed-client migration is still required. The live S3 CORS policy is managed separately by the client and must not be overwritten from this directory.

**CURRENT READ FIRST (2026-10-18):** The client's existing `firelaunch-staging-foundation` stack was updated and its nested-key/OAC correction reached `UPDATE_COMPLETE` on 2026-10-16. See [direct deployment evidence](../../../docs/tasks/c6-aws-integration-contracts/foundation-change-set-review.md), [current state](../../../docs/CURRENT-STATE.md) and [p6-live-vod Q1-Q3](../../../docs/tasks/p6-live-vod/README.md). The last recorded queue was PAUSED, EventBridge DISABLED and CloudFront DISABLED; verify live values. Approved free-to-view delivery uses [ADR 0013](../../../docs/decisions/0013-hybrid-video-access.md) after separate qualified Q2 activation, whereas protected paid delivery/signing is not implemented. This documentation change **does not** enable a distribution, submit a job or approve costs. Do not deploy a second Foundation stack or follow the old signer-based CDN activation sequence.

**HISTORICAL 2026-10-15 note:** The old top-level `staged/` and `delivery/` assumptions were incompatible with nested `media/<creator>/<project>/<asset>/...` keys. Historical instructions below describe the original setup and must be reconciled against the deployed corrected stack before use.

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

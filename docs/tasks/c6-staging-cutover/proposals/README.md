# C6 client IAM and rollback review artifacts

## Client-owned IAM change set — not created

Use [workload-identity-private-recovery.yaml](workload-identity-private-recovery.yaml), SHA-256 `2fb3ecefe682e11a2096fa1d240a6e5ef5a970ddcc98d312752da63c030b96dd`. It was derived from the **live** `firelaunch-staging-workload-identity` template, SHA-256 `c5962ebd60ff14cb316cc13774130fa770a8024cc39448a0188eb5002d3f621a`. The checked-in stack 03 template differs from live in the publisher role's `sts:SetSourceIdentity` trust action; using it directly would unintentionally change that trust. The old [private-object-access.yaml](private-object-access.yaml) is superseded and must not be deployed.

The local `firelaunch-admin` and other client profiles had expired sessions on 2026-10-16. `firelaunch-deployer` is restricted to Foundation change sets and its execution role cannot attach an app-role policy. A client administrator must reauthenticate through the supported AWS login flow; do not use the deployer or broaden its permission. After checking account `363242105231` and the exact client administrator ARN, create a **review only** change set:

```bash
aws sts get-caller-identity --profile firelaunch-admin --region us-east-2
sha256sum docs/tasks/c6-staging-cutover/proposals/workload-identity-private-recovery.yaml
aws cloudformation create-change-set \
  --profile firelaunch-admin --region us-east-2 \
  --stack-name firelaunch-staging-workload-identity \
  --change-set-name c6-private-recovery-review-20261016 \
  --change-set-type UPDATE \
  --template-body file://docs/tasks/c6-staging-cutover/proposals/workload-identity-private-recovery.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameters \
    ParameterKey=CaCertificatePem,UsePreviousValue=true \
    ParameterKey=VpsCertificateCommonName,UsePreviousValue=true \
    ParameterKey=CaCommonName,UsePreviousValue=true \
    ParameterKey=DeveloperBoundaryArn,UsePreviousValue=true \
    ParameterKey=AllowDeployerPublisherTesting,UsePreviousValue=true \
    ParameterKey=DeployerRoleArn,UsePreviousValue=true
```

Inspect the returned change-set ID with `aws cloudformation describe-change-set --profile firelaunch-admin --region us-east-2 --change-set-name <returned-id>`. Require exactly `ApplicationRole` modification without replacement and `PrivateRecoveryRole` addition, plus the new output. Check all six parameters are preserved, current trust/publisher/profile resources are unchanged, and the role boundary remains attached. Stop on any unexpected change. **Do not execute** until the owner explicitly approves that exact ID and the bounded synthetic S3 writes. A change-set prediction is not deployment or permission proof.

## Separate 0.5.8 rollback build

[0.5.8-aws-profile-compat.patch](0.5.8-aws-profile-compat.patch), SHA-256 `42a804a48988f073229eb0c70d485d01c82557d59cb9f832be46d9e53cc6d893`, applies to source commit `2330dcf` (root 0.5.8). It adds only the explicit named-profile private S3 adapter and matching restore CLI mode, one SDK credential-provider dependency, lockfile changes and a focused configuration test. Migrations stop at 010; no schema, route or product behavior was changed. It does not modify the original 0.5.8 release.

An independently built tarball is at `artifacts/c6-storage-rollback/firelaunch-0.5.8-aws-profile-compat.tar.gz` (ignored by Git), SHA-256 `e28e1c90a7f0b00963888849555bd0613a3e38c60200c4b68428b58e155d2210`. The tarball is a local candidate, not a deployed or AWS-qualified rollback binary. Preserve the patch and build inputs for reproduction; copy the tarball into protected release storage only after identity, schema-10, authenticated AWS object and full restoration checks pass.

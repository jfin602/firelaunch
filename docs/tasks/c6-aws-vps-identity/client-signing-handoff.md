# FireLaunch staging VPS certificate signing handoff

Status: **PUBLIC CSR READY FOR CLIENT SIGNING** (2026-10-15 CDT). The certificate has not been signed or installed; VPS STS access is not yet qualified.

## Verified target and current preparation

- VPS: `muffinos` at `87.106.146.255`, reached with the pre-existing pinned SSH host key and `deploy` SSH identity. The host reports Ubuntu 24.04 and hostname `muffinos`.
- Application service: `firelaunch-staging.service` is active with `User=deploy`, `Group=deploy`, working directory `/srv/firelaunch/current`, and environment file `/etc/firelaunch/staging.env`. The process runs as `deploy`; do not use a presumed `app` account.
- AWS CLI 2.38.1 was installed under `/home/deploy/.local` by the official AWS installer; its package GPG signature passed verification. The official IAM Roles Anywhere helper 1.8.5 was installed at `/home/deploy/.local/bin/aws_signing_helper` after matching the SHA-256 published by AWS (`beec9ed1c492d93db809890f16713e3556353294b823c2184ad4e891f1b2b54d`).
- `/home/deploy/.aws/config` is mode 0600 and contains only the `firelaunch-staging-app` profile with the actual trust-anchor, Roles Anywhere profile, and app-role ARNs. `/home/deploy/.aws/credentials` was absent. The running service process exposed no `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, or `AWS_SESSION_TOKEN` environment keys. This does not prove the root-only service environment file contains no credentials; inspect it before enabling the profile.
- The service was not restarted or deployed. No AWS API call or infrastructure mutation was made as part of VPS preparation.

The owner prepared `/etc/firelaunch/aws` as `deploy:deploy` mode 0700 and granted `deploy` traversal of its parent. This let the verified service user generate its own key and CSR without sudo. Root SSH with the existing key remains denied; password-gated administrative sudo was not used. No sudo password or private key was transferred.

## Public CSR transfer and evidence

The expected paths are:

| Item | Path | State |
| --- | --- | --- |
| VPS private key (never transfer) | `/etc/firelaunch/aws/firelaunch-staging-vps.key` | **Generated on VPS only**, `deploy:deploy` 0600 |
| VPS public CSR | `/etc/firelaunch/aws/firelaunch-staging-vps.csr` | **Generated**, `deploy:deploy` 0600 inside private directory |
| Development-machine public CSR | `docs/tasks/c6-aws-vps-identity/firelaunch-staging-vps.csr` | **Transferred and validated** |

The reviewed `01-generate-key-and-csr.sh` ran on `muffinos` as `deploy` with `FIRELAUNCH_APP_USER=deploy`. It created a P-256 private key and CSR in the private service-owned directory. A second run reported that the existing matching pair was retained. The script refuses to replace a different key or CSR.

Only the CSR was transferred to the development machine with:

```bash
scp -o StrictHostKeyChecking=yes deploy@muffinos:/etc/firelaunch/aws/firelaunch-staging-vps.csr \
  /home/jfin/dev/firelaunch/docs/tasks/c6-aws-vps-identity/firelaunch-staging-vps.csr
openssl req -in /home/jfin/dev/firelaunch/docs/tasks/c6-aws-vps-identity/firelaunch-staging-vps.csr \
  -noout -verify -subject -nameopt RFC2253
```

Validation on both VPS and development machine: `Certificate request self-signature verify OK`; subject `subject=CN=firelaunch-staging-vps,O=FireLaunch`. The VPS private-key public key and CSR public key both have DER SHA-256 `899d2c6f89f133dc54d7d398c337c9c1278fe704927f453a68b1026e6a8c349d`. The transferred CSR file SHA-256 is `3aa80ae3352fabe442ec1933d95c2dca1d79af9396f0adc01c748cec528c366b` on both hosts. The public key reports `prime256v1`. Private-key material was neither printed nor exported.

## Client CA signing procedure

Follow [`CLIENT-RUNBOOK.md`](../../../../infra/aws/staging/docs/CLIENT-RUNBOOK.md) section 1. The client signs in to **their own admin role** in account `363242105231`, opens AWS CloudShell in `us-east-2`, and uploads only these public files: `firelaunch_ca.py`, `firelaunch-staging-ca.pem`, and the validated `firelaunch-staging-vps.csr`. The CA private key is the existing KMS key `alias/firelaunch-staging-roles-anywhere-ca`; never generate or replace it.

The exact Claude Code prompt for the client's independent signing session is:

```text
Sign the attached FireLaunch staging VPS public CSR under the existing client-owned
Roles Anywhere CA. Follow infra/aws/staging/docs/CLIENT-RUNBOOK.md section 1.
Use AWS CloudShell in us-east-2 under my own admin session. First run
aws sts get-caller-identity and stop unless Account is 363242105231 and the
identity is my expected AccountFullAccessRole. Upload only
infra/aws/staging/scripts/ca/firelaunch_ca.py,
infra/aws/staging/ca/firelaunch-staging-ca.pem, and
docs/tasks/c6-aws-vps-identity/firelaunch-staging-vps.csr.
Verify the CSR signature, exact CN firelaunch-staging-vps, and its SHA-256
3aa80ae3352fabe442ec1933d95c2dca1d79af9396f0adc01c748cec528c366b.
Run the existing sign-csr command with
--days 90. Do not create or replace a CA, trust anchor, role, profile, or
CloudFormation stack. Return only firelaunch-staging-vps.pem and
firelaunch-staging-ca.pem, plus the certificate subject, issuer, serial,
validity dates, extensions, and verification output. Never return a private key.
```

In CloudShell, the runbook's command is:

```bash
pip3 install --user asn1crypto cryptography
aws sts get-caller-identity
python3 firelaunch_ca.py sign-csr --ca firelaunch-staging-ca.pem \
  --csr firelaunch-staging-vps.csr --out firelaunch-staging-vps.pem --days 90
```

The signed certificate must be X.509 v3, issued by `O=FireLaunch, CN=FireLaunch Staging Roles Anywhere CA`, with exact leaf `O=FireLaunch, CN=firelaunch-staging-vps`; 90-day validity (maximum 397 days); critical `BasicConstraints CA:false`; critical `KeyUsage digitalSignature`; and `ExtendedKeyUsage clientAuth`. The signer rebuilds the subject and ignores requested CSR extensions. Return the leaf as `firelaunch-staging-vps.pem` and the public CA chain as `firelaunch-staging-ca.pem`. The expected CA certificate SHA-256 fingerprint is `FB:96:F1:29:C0:77:BB:A3:C4:2C:FD:42:D7:A6:89:F6:FA:5C:34:2D:DA:EA:AE:E6:A1:3E:8B:8B:68:6D:9B:B7`.

## Verify returned certificate before installation

On the development machine, inspect the public files:

```bash
openssl req -in firelaunch-staging-vps.csr -noout -verify -subject -nameopt RFC2253
openssl x509 -in firelaunch-staging-ca.pem -noout -fingerprint -sha256
openssl verify -CAfile firelaunch-staging-ca.pem firelaunch-staging-vps.pem
openssl x509 -in firelaunch-staging-vps.pem -noout -subject -issuer -dates -serial -ext basicConstraints,keyUsage,extendedKeyUsage
```

Compare `openssl req -in firelaunch-staging-vps.csr -noout -pubkey` with `openssl x509 -in firelaunch-staging-vps.pem -noout -pubkey`. On the VPS, compare the installed certificate's public key with `openssl pkey -in /etc/firelaunch/aws/firelaunch-staging-vps.key -pubout` **without displaying or exporting the private key**. Then use the reviewed `02-install-certificate-and-helper.sh` with `FIRELAUNCH_APP_USER=deploy`; it must preserve unrelated AWS profiles. Only after installation, run `03-verify.sh` to prove STS account `363242105231` and `assumed-role/firelaunch-staging-app/...`, followed by separately authorized IAM boundary and publisher checks. Add `AWS_PROFILE=firelaunch-staging-app` to the staging systemd environment only after that proof, and restart/deploy only under a separate staging rollout decision. No CloudFront enablement, MediaConvert job, Bedrock request, or media publication is part of this exchange.

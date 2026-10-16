# FireLaunch staging — client-only operations

These actions stay with the account owner (Michael). JFin's roles are denied all of them.

## 1. Sign the VPS certificate request (CSR)

JFin generates the private key **on the VPS** and sends you only `firelaunch-staging-vps.csr`.
The CA private key is the KMS key `alias/firelaunch-staging-roles-anywhere-ca`; it never leaves KMS
and only your admin role (or the account root user) may sign with it.

Easiest place to run this: **AWS CloudShell** in **us-east-2**, signed in through your own admin access.

1. Open CloudShell (region selector: US East (Ohio)).
2. Upload three files: `scripts/ca/firelaunch_ca.py`, `ca/firelaunch-staging-ca.pem`, and JFin's `firelaunch-staging-vps.csr`.
3. Run:
   ```bash
   pip3 install --user asn1crypto cryptography
   aws sts get-caller-identity          # must show 363242105231 and AccountFullAccessRole
   python3 firelaunch_ca.py sign-csr --ca firelaunch-staging-ca.pem \
       --csr firelaunch-staging-vps.csr --out firelaunch-staging-vps.pem --days 90
   ```
   The tool refuses to sign unless the CSR's signature is valid and its common name is exactly
   `firelaunch-staging-vps`. It rebuilds the subject itself, ignores any extensions requested in the CSR,
   and verifies the issued certificate before writing it.
4. Download `firelaunch-staging-vps.pem` and send it to JFin together with `firelaunch-staging-ca.pem`.
   Both are public; neither contains a private key.

Renewal: repeat every ~60–80 days (certificates are issued for 90 days by default, maximum 397).

## 2. Revoke or suspend VPS access

Fastest (seconds, no certificate work):
```bash
aws rolesanywhere disable-profile --region us-east-2 --profile-id 709699e9-1312-4eb6-ac48-9bb129335911
```
Already-issued STS credentials remain valid until they expire (max 1 hour, profile duration 3600 s).
To also cut existing sessions immediately, use IAM → Roles → `firelaunch-staging-app` →
"Revoke active sessions".

Permanent single-certificate revocation: publish a CRL to Roles Anywhere (`aws rolesanywhere import-crl`)
listing the certificate serial, or rotate: issue a new certificate and disable the profile until the VPS has it.

## 3. Switches only the client can flip (in `firelaunch-staging-access`)

| Parameter | Default | Meaning |
|---|---|---|
| `AllowQueueCreation` | `false` | Lets the CloudFormation execution role create/delete MediaConvert queues. CreateQueue is also how **reserved (paid commitment) queues** are bought and IAM cannot block that, so keep `false` except during a supervised change. |
| `BedrockModelArns` | empty | Approved Bedrock models for the deployer role (the app role's list is in the foundation stack). |
| `AllowDeployerPublisherTesting` | `false` | You chose to keep JFin's human role out of the publisher role. Must also be set in the identity stack. |
| `BudgetEmail`, `BudgetLimitUsd` | michael@mysticwatersmedia.net, 20 | Budget alerts. |

Update with your admin role:
```bash
aws cloudformation deploy --region us-east-2 --stack-name firelaunch-staging-access \
  --template-file cloudformation/01-firelaunch-staging-access.yaml --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides AllowQueueCreation=false --no-execute-changeset   # review, then execute
```

## 4. Authorizing billable work

- **Encoding**: tell JFin it is authorized; he redeploys the foundation with `QueueStatus=ACTIVE` (and later back to `PAUSED`).
- **Bedrock**: give the approved model / inference-profile ARN(s); set `BedrockModelArns` in the foundation stack
  (application role) and, if JFin should test manually, in the access stack (deployer role).
- AWS Budgets **only emails**; it does not stop spending. There is no project spend limit on this account
  (Advanced AWS Features is active).

## 5. Things that stay yours

Root user, billing and payment methods, the organization, Identity Center users/groups, account access
assignments, the CA key, Roles Anywhere trust, the two client-owned stacks, and any deletion of buckets or stacks.

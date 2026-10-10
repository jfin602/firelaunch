# p2 — Hosted Creator Platform

Status: READY TO RUN / NOT EXECUTED
Phase: 2 (post-P0 SaaS roadmap)
Activation root version: 0.2.0 (P1 closed GREEN / QUALIFIED at 0.1.5)
Model: GPT-6 Sol High for security-sensitive work; bounded lower-risk tasks may use Medium

## Goal

Convert FireLaunch's single-user local P0 kernel into an authenticated, owner-isolated and recoverable hosted creator workspace. Establish real login/session control, transactional Postgres persistence, project/deployment uniqueness, private asset/evidence boundaries, protected Studio/API and code export, a safe explicit P0 migration path and reproducible database+object backups. No teams or hosted arbitrary-code execution. Native Vega build in a multi-tenant hosted process stays disabled until separately sandbox-qualified.

P1 provided strict schemas but **no runtime authorization**. P2 does not implement P3 catalog ingestion, P4 live catalog AI, P5 live manifest service, P6 sync or P7 publishing/billing. Amazon, AWS, Bedrock, real TV, Appstore and historical P0/P7 GREEN are not P2 prerequisites.

## Prompt Stack

| Prompt | Focus | Version | Browser |
| --- | --- | --- | --- |
| P1 | OIDC authentication, session and CSRF | 0.2.1 | no |
| P2 | PostgreSQL creator/project/deployment persistence | 0.2.2 | no |
| P3 | All-route tenant isolation and signed-out Studio | 0.2.3 | no |
| P4 | Private media/evidence and secret storage | 0.2.4 | no |
| P5 | Explicit P0 local project migration and source portability | 0.2.5 | no |
| P6 | Backup/restore, audit and operational hardening | 0.2.6 | no |
| P7 | Independent real-browser/security/recovery closeout | 0.2.7 | yes |

P1–P6 are bounded implementation checkpoints. P7 is the **only** final closeout; runner stops before manual browser qualification by default. No agent Git commits inside runner prompts.

## Start and validate

From a committed, clean root 0.2.0 checkout with supported Node 24/npm 12 and provisioned test Postgres/storage:

```bash
npm run codex:stack:validate -- p2
npm run codex:stack -- p2
```

Use `--closeout` only for deliberate independent manual qualification per runner usage; do not treat prompt writing as implementation.

P2 implementation checkpoints advance **root** package.json and package-lock.json version metadata through 0.2.1–0.2.6. Closeout changes it to 0.2.7. Workspace package versions stay intact unless an evidenced build requirement demands change. The activation commit sets 0.1.5 -> 0.2.0.

## GREEN gate

- Two independently authenticated real creator accounts and browser/API adversarial tests proving complete isolation of projects, code, agent, bundles, deployments and private asset capabilities.
- Valid migration from local P0 with retained code customization and no source damage; DB-backed revisions, global package uniqueness and successful restart.
- Executed Postgres+object backup/restore in isolated resources, safe token handling and failure diagnostics; test-only authentication cannot enter hosted production.
- One aggregate repo check, runner validation, actual evidence/HEAD/version and honest closeout. Missing live issuer or restore proof -> NOT GREEN.

Historical P0/P7 and `c0-real-tv-qualification` remain NOT GREEN, even though a tested Vega VPKG/VirtualDevice path was proven separately.

See [prompt assessment](prompt-assessment.md), [implementation plan](implementation-plan.md), [P1 closeout](../p1/closeout.md), [roadmap](../../roadmap/mvp-roadmap.md).

# c2-hosted-qualification — Prompt assessment

Date: 2026-10-10
Decision: one browser-required manual correction closeout that executes a maximum of five bounded qual/repair cycles at **unchanged 0.2.7**.

## Proven versus unproven

**Previously reported P2 P7 passes:** runner validation; `git diff --check`; one aggregate root check 179/179; 10/10 focused security/recovery on isolated PostgreSQL 16; local Studio editing, Preview, browser reload persistence and remote navigation. These cannot establish a second real logged-in principal or production-style private object restore.

**Open blocking evidence:**
1. No real configured Google OIDC client/issuer + two separately authorized creator accounts completed the full sign-in/session and ownership path. The current `apps/server/src/auth/config.ts` explicitly configures Google; the hosted path requires `FIRELAUNCH_PUBLIC_ORIGIN`, `FIRELAUNCH_OIDC_CLIENT_ID`, `FIRELAUNCH_OIDC_CLIENT_SECRET`, `DATABASE_URL`. Actual HTTPS callback, server-to-server token validation and two live browser sign-ins are necessary.
2. P7 used the `IsolatedObjectStore` filesystem test adapter. The qualified storage implementation `private-objects.ts` has a separate `S3PrivateObjectStore` using AWS SDK S3 operations, and the operations runbook requires a **different source and restore bucket** plus a separate temporary Postgres database. P2 has no direct external S3 restore evidence.

## Prioritize evidence over implementation

- G0 preflight checks only resource availability and credentials' **presence**, never exposes their values or attempts unauthorized account creation.
- G1 independently logs in two authorized real creator identities, verifies secure/cross-origin/callback/session behavior and preserves redacted browser evidence.
- G2 repeats ownership adversarial probes across `apps/server/src/api.ts`, `hosted-repository.ts`, `hosted-workspace.ts` and `private-objects.ts` on the same hosted candidate; avoid test-only auth bypass.
- G3 exercises `operations-cli.ts` backup and restore against Postgres + genuine S3-compatible source/target buckets over HTTPS and compares restored bytes/hashes and per-owner reads.
- G4 repeats hosted Studio editor/Preview/logout/restart/source-export checks on the **repaired candidate**, not just the earlier local demo.
- G5 runs the final aggregate suite, stack validation, diff check, verifies no version or historical closeout drift, and writes an evidence-backed independent c2 closeout.

## Repair budget and stop conditions

At most 5 cycles. Each cycle starts from the current candidate, attempts all **available** gates, repairs only a directly evidenced defect in the qualified paths, runs focused validation and requalifies affected gates. The runner owns implementation commits only in an implementation prompt, whereas this **manual closeout** must not change HEAD or self-commit. Store any repairs uncommitted for owner review and note exact diff. Early terminate on full Green or inaccessible external approvals/credentials. Don't burn five cycles retrying the same missing prereq.

If defects exceed these bounded seams (provider redesign, bucket implementation rewrite, new SaaS features, broad security architecture or schema migrations), mark NOT GREEN and propose a narrower c2 follow-up stack instead of spending the loop on speculative work. Missing real OIDC or genuine S3 proof cannot be fixed by a passing mock unit test.

## Security and negative claims

Use only user-authorized test accounts, buckets and restore namespaces; no browser automation of third-party account provisioning or credential scraping. Never print secrets, raw tokens, email addresses, persistent signed object capabilities or private object keys in logs/Markdown/commits. Record issuer/environment and account aliases only in redacted form. Owner approvals to configure Google OAuth and private S3 remain external prerequisites; they are not manufacturing defects.

No physical Fire TV, Amazon Seller/Developer credentials, AWS Bedrock, Appstore approval, content feed ingestion, manifest/live sync or billing gate belongs to this correction. Historical P0/P7 and c0 do not change status. P2's original P7 closeout remains historical even if the correction reaches GREEN.

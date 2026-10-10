# c2-hosted-qualification — Phase 2 independent qualification/repair

Status: PREPARED / NOT EXECUTED
Type: Correction 2, browser-required manual qualification closeout
Required unchanged root version: `0.2.7`
Correction baseline: P2 P7 NOT GREEN; last implementation HEAD `eb881a9a9b1102ab3931cf1538b46bcdc838af9e`
Default model: GPT-6 Sol High
Repair budget: at most **five complete qualification/repair cycles**; early Green or a hard external blocker ends the loop

## Why this correction exists

Phase 2 P7 reports one full check **179/179 tests** and **10/10 focused security/recovery tests** on isolated PostgreSQL 16; stack validator, `git diff --check`, local Studio editor, Preview, reload persistence and remote navigation passed. Those results are prior evidence, **not proof of hosted release qualification**. P7 remained NOT GREEN because the host had neither a configured live Google OIDC issuer with two distinct legitimately controlled creator accounts nor an actual restore across independent S3-compatible buckets. The P7 closeout and root version `0.2.7` remained uncommitted at the time this plan was authored. Do not silently claim they are committed.

This correction closes only these runtime evidence gaps and any **directly observed** defects found while checking the already implemented paths. It does not reimplement authentication, database storage, P3 catalog import, P4 AI, P5 live manifests, P6 sync or P7 publishing/billing.

## Before execution: commit local P7 closeout separately

On the owner's machine, review and commit the already-written `docs/tasks/p2/closeout.md`, `package.json` and `package-lock.json` P7 changes from `eb881a9`. Do **not** run the correction with a dirty unreviewed 0.2.7 worktree or against remote `main` still at 0.2.6. The correction documentation was deliberately prepared on a separate GitHub branch to avoid clobbering this in-flight closeout. Cherry-pick the correction-doc commit only after the P7 closeout commit, verify `0.2.7` and a clean checkout, and run its validator.

Never turn P2 historical P7 from NOT GREEN to GREEN retrospectively. Correction Green, if achieved, is independent new evidence at `0.2.7`.

## One manual closeout prompt, up to five cycles

| Prompt | Purpose | Browser | Version |
| --- | --- | --- | --- |
| `P1-hosted-qualification-repair-closeout.txt` | Independent external-prerequisite preflight, up to five requalification/repair rounds and final c2 disposition | yes | 0.2.7 UNCHANGED |

This is an intentionally **single-closeout** correction stack; no preparatory implementation checkpoint can substitute for the real external gates. The Prompt Stack grammar requires exactly one final closeout prompt. Run `npm run codex:stack:validate -- c2-hosted-qualification` after integrating the docs. Browser/manual execution is required: the runner cannot perform this closeout unattended.

Read [assessment](prompt-assessment.md), [plan](implementation-plan.md) and the full [P1 correction prompt](P1-hosted-qualification-repair-closeout.txt).

## Gate policy

G0: source state and approved preflight environment (real OIDC configuration, two explicitly authorized creator logins and accessible Postgres/S3). G1: two live OIDC browser sessions and cookie/CSRF/session checks. G2: route-by-route tenant denial and authorized-owner success. G3: separate S3 source/restore buckets plus separate disposable Postgres restore, checksum and isolation verification. G4: real hosted Studio Preview/edit/reload, restart, safe export and blocked shared builds. G5: final aggregate validation and factual evidence.

Every gate must PASS on the final repaired candidate for c2 GREEN. No fake login, hardcoded test principal, filesystem object adapter, single-bucket prefix trick, skipped restore, or mere successful `npm run check` qualifies it. Stop honestly if the owner-controlled OAuth registration/accounts or real buckets cannot be provisioned. Record cycles actually attempted, exact evidence and remaining blockers in `docs/tasks/c2-hosted-qualification/closeout.md`. Never commit tokens, account addresses, keys, bucket secrets, database URLs or raw private objects.

## Reference boundary

- [Phase 2 original closeout](../p2/closeout.md) — historical NOT GREEN, created locally
- [Hosted Phase 2 plan](../p2/implementation-plan.md)
- [Recovery runbook](../p2/recovery-runbook.md)
- [P1 creator contracts closeout](../p1/closeout.md)
- [Historical c0 correction](../c0-real-tv-qualification/README.md) — remains NOT GREEN

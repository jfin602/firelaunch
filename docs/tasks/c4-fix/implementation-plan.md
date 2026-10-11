# c4-fix — Implementation Plan

Status: ready to execute after documentation integration
Version: root `0.4.8` unchanged for P1–P4; no internal workspace version changes
Entry: GitHub P4 P8 closeout commit `3a0a0de1639723ec70d3877fc6a5f455f2506365` (owner machine may need reconciliation)
Runner: P1–P3 implementation; P4 one independent manual closeout
Read: BOOT.md, AGENTS.md, docs/workflow.md, docs/roadmap/mvp-roadmap.md, docs/tasks/p4/closeout.md, docs/tasks/p4/provider-smoke.md, docs/tasks/c4-fix/{README.md,prompt-assessment.md,implementation-plan.md}, ADR 0008, and directly affected source and tests.

## P1 — Migration/recovery regression (Sol High, headless)

Inspect root check failure, migration SQL order (now through 009), recovery/ops health implementation and fixture/test setup. Determine whether migration health is correctly 9 and test expectation 7 stale, or whether recovery semantics regressed. Fix exactly the verified mismatch and add a stable test asserting migrations applied and safe recovery after restart, avoiding an expectation that becomes stale on the next valid migration. Preserve PostgreSQL isolation, restore transactionality and negative cases. Run failed recovery test directly plus minimal related kernel/operations checks, affected server typecheck/build and `git diff --check`. Do not hide the kernel failure with a skip or broad migration rewrite. No global aggregate yet.

## P2 — Bedrock Nova Lite local integration readiness (Sol High, headless)

Inspect `packages/agent/src/{bedrock,index,tools}.ts`, `apps/server/src/api.ts`, the existing Bedrock offline fixture tests and `docs/tasks/p4/provider-smoke.md`. Do **not** add a replacement adapter. Repair only a demonstrated configuration, transport, tool schema or error-reporting defect. Add targeted offline tests using an injected fake `BedrockRuntimeClient`/transport for Converse tool call/result, malformed response, model selection/configured-state truthfulness, no unauthorized catalog context, persistence and rejection as appropriate. Keep real model/network out of normal tests.

Write `docs/tasks/c4-fix/bedrock-local.md` explaining server-only variables `FIRELAUNCH_AGENT_PROVIDER=bedrock`, `AWS_REGION=us-east-2`, and region-supported `BEDROCK_MODEL_ID` (candidate `amazon.nova-lite-v1:0`); SDK default credential chain with IAM Identity Center or temporary role credentials; SSO/profile selection if installed; optional STS identity check, Bedrock model entitlement check, and the existing **opt-in** P4 catalog provider-smoke after AWS verification. Never ask for AWS root access keys, embed secrets, silently invoke a paid model, create a VPS or claim provider `configured=true` proves live success. Record exact validation and offline limitations. Run focused agent/server tests and affected typechecks/builds/diff check.

## P3 — Catalog Studio regressions and evidence (Sol Medium, headless)

Inspect existing P4 fixtures, `apps/server/test/catalog-generation-convergence.test.ts`, Studio tests/Preview/catalog UI, `apps/server/src/catalog-{projection,composition}.ts` and agent grounding. Add/adjust only focused deterministic tests needed to ensure: three creator-specific draft shapes; informational books show detail, Select non-play and Back; rights-eligible synthetic audio/video have correct focus/player semantics in harness; withheld/unknown/revoked rights stay excluded; manual name/text/order overrides and stable IDs survive repeated generation, re-read/restart; stale revisions and foreign principals deny mutation/export; no private capabilities leak into generated artifacts. Use real PostgreSQL fixtures if configured; report any skipped DB coverage precisely rather than asserting PASS. Preserve browser evidence from original P4 closeout as historical; do not fabricate rights-cleared HTTPS media, D-pad video/audio browser pass, or two real-profile checks. Focus affected tests, Studio suite as appropriate, typecheck/build and diff check. Minimal repair only for proven defects.

## P4 — Independent manual local closeout (Sol High)

Preflight all P1–P3 runner commits, actual HEAD, root `0.4.8` in package.json and two root lockfile entries, working tree and environment. The source P4 closeout commit is already upstream; never reset/overwrite accepted local changes. Inspect focused evidence, rerun only needed focused tests, run `npm run codex:stack:validate -- c4-fix`, ONE final `npm run check` with npm 12.x and Node 24.x, then `git diff --check`. Record seven typechecks, seven builds, kernel/Studio/runner pass/fail/skips, and any external preconditions not tested. Optionally verify local Studio browser navigation if a suitable browser exists; don't make it a substitute for live provider or licensed media.

Record `docs/tasks/c4-fix/closeout.md`: candidate SHA/version, P1–P3 checkpoints, commands/counts, local status `LOCAL GREEN` or `NOT GREEN`, explicit original P4 NOT GREEN until live non-mock saved model mutation and Preview are separately observed, hosted release NOT QUALIFIED with S1–S6 status, and P5 VirtualDevice requirements. If verification pending, list Bedrock smoke as BLOCKED/NOT EXECUTED, not PASS; leave opt-in smoke ready for later. Manual closeout does not self-commit or modify version.

## Shared guardrails

Preserve provider neutrality, IAM secret boundaries, owner-scoped selected catalog, strict validated revision-checked ChannelSpec mutation, rights checks and source export sanitization. Do not modify P4 original history or downgrade ADR 0008. Do not add P5 public manifest, P6 sync, P7 billing/submission, P8 physical-device qualification, production HTTPS OIDC/S3 infrastructure, or broad refactors. The runner exclusively owns checkpoint commits. All prompts target the same fixed root version 0.4.8. Each prompt records exact observed checks and gaps, not success by inference.

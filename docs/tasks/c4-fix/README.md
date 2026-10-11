# c4-fix — Phase 4 local correction and Bedrock readiness

Status: DOCUMENTED / PROMPT STACK AUTHORED / NOT EXECUTED
Type: Bounded correction to Phase 4 (0.4.x)
Root version: `0.4.8` UNCHANGED for every prompt
Baseline: [P4 P8 closeout](../p4/closeout.md) — PHASE 4 NOT GREEN / HOSTED RELEASE NOT QUALIFIED, committed as `3a0a0de1639723ec70d3877fc6a5f455f2506365`
AI provider chosen for local preparation: existing Amazon Bedrock adapter, Nova Lite in `us-east-2`, subject to account/model access
Models: Sol High (P1, P2 and manual P4); Sol Medium (P3)

## Purpose

Resolve the deterministic Phase 4 migration-recovery regression, make the EXISTING Bedrock provider safe and straightforward to configure locally without root keys or required paid calls, and regress Studio catalog generation and rights boundaries. This is a local development correction, NOT a production/VPS deployment or a reduction of P4's original live-provider acceptance gate.

P4 P8 documented 95 kernel passes, one failure (test expected migration 7; health returned 9) and one skip in the aggregate, after 7/7 typechecks and 7/7 builds; separate Studio 18/18, runner 104/104, focused 21/21 passed. Writing Preview, manual regeneration, reload and restart passed for one authenticated identity. Video/audio playback and second-profile coverage were unavailable, and no non-mock provider request succeeded. Never count these separate checks as an aggregate pass.

## Prompt stack

| Prompt | Responsibility | Model | Browser | Root version |
| --- | --- | --- | --- | --- |
| P1 — migration recovery | Verify current migration contract, repair actual recovery/test mismatch, add focused regression | GPT-6 Sol High | no | 0.4.8 unchanged |
| P2 — Bedrock readiness | Verify existing Bedrock Converse/tool integration, safe AWS credential-chain/local runbook, offline validation | GPT-6 Sol High | no | 0.4.8 unchanged |
| P3 — Studio convergence | Focused video/audio/writing and rights-safe Studio regressions; preserve overrides, restarts and denials | GPT-6 Sol Medium | no | 0.4.8 unchanged |
| P4 — independent closeout | Manual environment/stack/evidence review and ONE final aggregate `npm run check` | GPT-6 Sol High | manual | 0.4.8 unchanged |

P1–P3 are runner-owned implementation checkpoints; agents never commit or move HEAD. The runner stops before P4 and asks for a separate manual closeout. Only P4 writes `docs/tasks/c4-fix/closeout.md`. Do not rewrite the P4 historical closeout.

## Gates and disposition

**c4-fix LOCAL GREEN** requires: migration recovery genuinely passes its current contract; focused security/provider/media/Studio regressions and one final `npm run check` pass (report skips, with no new unjustified skips); 7/7 typechecks and builds, stack validator and `git diff --check` pass; supported local Bedrock configuration steps work without leaking credentials or falsely claiming a live call; no rights/tenant/revision regression. If any required local gate fails, correction is NOT GREEN. External account verification is reported BLOCKED/NOT TESTED separately and does not substitute for a local result.

**Original P4 remains NOT GREEN** until a separate independent qualification observes one successful *non-mock* catalog-grounded request, validated SAVED ChannelSpec mutation and visible Preview effect, plus its remaining full product/browser gates. Choosing `bedrock`, passing fixtures, showing `configured=true`, or invoking STS alone does not close that gate. Follow [P4 provider smoke](../p4/provider-smoke.md) only when AWS access is actually available and approved.

**Hosted release remains NOT QUALIFIED**: inherited P2/c2 and P3 S1–S6 two-profile/foreign API, HTTPS OIDC/secure cookies and independent HTTPS S3 gates; licensed and device-reachable media; public manifests, installed-Vega delivery, physical hardware and Appstore each retain their later qualification owners. Preserve P0/c0 NOT GREEN and P3 bounded CATALOG GREEN. Phase 5 implementation may be planned with these blockers visible; Phase 5 itself still requires real Vega VirtualDevice/device evidence for its own GREEN.

## Non-goals

No VPS, public endpoint, IAM root access keys, credentials in files/ChannelSpec/logs, fabricated media licenses, production release, new provider adapter, tenant auth rewrite, real paid model call in deterministic tests, automatic Appstore submission, physical Fire TV certification or broad Studio redesign. The opted-in live smoke can be performed later without changing `0.4.8`.

## Activation and execution

The source P4 closeout/version was reportedly uncommitted on the owner machine at HEAD `2aff7d8`, but the GitHub `main` baseline now contains the closeout/version commit `3a0a0de`. Before execution reconcile the **actual local** `git status`, root version and upstream branch non-destructively; do not reset, force-pull, overwrite or double-commit those changes. Documentation changes may originate on a separate Git branch and must be integrated after reconciliation. The runner requires the task folder locally present and the exact version `0.4.8`.

After integration, from the owner checkout:

```bash
cd /home/jfin/dev/firelaunch
git status --short
node --version
npm --version
npm run codex:stack:validate -- c4-fix
npm run codex:stack -- c4-fix
```

Use Node 24.15+ and npm 12.x. If the workspace is dirty, inspect and follow the runner's explicit continue decision; preserve accepted changes. Do not run P4 through the automated implementation runner. See [assessment](prompt-assessment.md) and [plan](implementation-plan.md).

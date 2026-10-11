# c4-fix — Prompt Assessment

Date: 2026-10-11
Decision: 3 focused automated checkpoints + 1 manual closeout at unchanged root `0.4.8`.
Authority: [P4 closeout](../p4/closeout.md), [Phase 4 plan](../p4/implementation-plan.md), [launch roadmap](../../roadmap/mvp-roadmap.md), [workflow](../../workflow.md), [ADR 0008](../../decisions/0008-launch-ai-provider-policy.md).

## Current evidence

P4 P8 is NOT GREEN: local hosted writing catalog produced a persistent informational TV draft; edits and same-input regeneration survived reload and API restart, with book Select/detail and Back. Video/audio fixture metadata lacks playback media/rights and was correctly excluded, so positive playback, navigation/focus and regeneration were not proven. Two real Google profiles and full foreign API matrix were not simultaneously available. Live non-mock catalog-grounded generation has zero successful calls. The final kernel aggregate failed a recovery assertion (expected applied migration 7, observed 9), after 7/7 builds and 7/7 typechecks; Studio and runner separately passed but the aggregate did not. P2/c2 and S1–S6 remain NOT GREEN/OPEN/PARTIAL; hosting is NOT QUALIFIED.

Observed source boundaries: `apps/server/migrations/` added migrations after the older recovery assertion; `apps/server/src/operations*` and recovery tests own applied-migration reporting. The actual expected-versus-observed contract must be inspected before repairs, not guessed. The supported `BedrockProvider` already exists at `packages/agent/src/bedrock.ts` using AWS SDK `BedrockRuntimeClient` and `ConverseCommand` with tool use; `packages/agent/src/index.ts` selects `mock`, `bedrock`, or `openai`. `apps/server/src/api.ts` creates it from the **server** environment. `docs/tasks/p4/provider-smoke.md` already defines an opt-in live request. Do not implement another provider, remove OpenAI support, or put a model key in the browser.

## Risks and decisions

1. **Migration drift vs real defect.** Migration 9 may be correct and the test may be stale, or the health/recovery contract may be broken. Inspect ordered migrations, health schema and recovery/restore behavior, then repair the narrowest proven defect. Regression must assert the canonical version/invariant (prefer deriving from known migrations when appropriate) and check real recovery/denial, never hard-code a new number blindly or skip coverage.
2. **AWS pending verification.** Prepare `AWS_REGION=us-east-2`, `FIRELAUNCH_AGENT_PROVIDER=bedrock`, and a supported `BEDROCK_MODEL_ID` (Nova Lite `amazon.nova-lite-v1:0` is the candidate, subject to region/model entitlement). Prefer an IAM Identity Center/SSO profile or temporary role credentials using the standard SDK credential chain; forbid root keys and checked-in credentials. The provider's `configured` status currently checks model ID only: document clearly that this is NOT authorization, model access or success. Unit tests stay offline; live smoke explicitly opt-in after verification.
3. **Rights safety.** Synthetic playable fixtures may prove state transitions and authorized media eligibility in tests but not browser/device playback. Do not reclassify `fixtures/video.json` or `fixtures/audio.json` as licensed. Keep revocation/withheld/unknown rights and privacy redaction fail-closed.
4. **Studio persistence.** Preserve creator brand, modules/order/text and stable catalog bindings through regeneration/reload/restart; verify informational detail never pretends to play, audio/video behave according to eligibility, safe export/no capability leakage, and two-principal denial via test fixtures. No invented live two-profile pass.
5. **Qualification semantics.** c4 local GREEN only covers the tests/configuration it actually qualifies. Original P4 NOT GREEN until real non-mock saved catalog mutation + Preview and remaining Phase 4 real-browser gates are proven. Hosted release remains NOT QUALIFIED independently; P5 device remote-manifest acceptance not waived.

## Dependencies and cost

P1 owns the deterministic failure so later runs cannot mask it; P2 covers existing provider integration/config without AWS credentials; P3 validates product regressions without changing launch boundaries; P4 runs a single final aggregate, reconciles precise skipped checks and records the truth. These are bounded tasks, not one prompt per missing external service. Avoid global `npm run check` in every implementation prompt. Use focused tests/typechecks/builds and `git diff --check` per checkpoint. Model policy: Sol High for P1/P2 and manual closeout; Sol Medium for P3.

## Success and failure criteria

The correction may be LOCAL GREEN when recovery and deterministic regressions pass; live AWS, licensed video/audio browser playback, two-profile hosted HTTPS security and S3 tests can be explicitly deferred **without** becoming PASS or rewriting ADR 0008/P4. Missing required local assertions, security regressions, leaked secrets, silent rights escalation or failed final aggregate means c4-fix NOT GREEN. No production-release or Phase 4 GREEN claims without direct independent external evidence.

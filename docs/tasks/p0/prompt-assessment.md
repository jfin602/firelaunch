# p0 — Prompt assessment

Status: Approved after one-shot reassessment on 2026-10-08.

## Decision

Use a staged GPT-6 Sol High Prompt Stack rather than the previously drafted GPT-6 Astra one-shot.

The product definition and architecture remain valid. The change is execution strategy.

## Why the staged stack is better

The original P1 one-shot combined several independently difficult systems:
- greenfield workspace/server/client foundation
- ChannelSpec/domain/persistence
- television semantics and focus behavior
- React Native for Vega generation
- polished creator UI
- provider-neutral agent + Bedrock
- code editing/regeneration safety
- local platform/toolchain execution
- publish/readiness logic
- aggregate test/documentation convergence

A single long-horizon run could plausibly implement them, but it creates a large retry surface. An early architectural mistake can contaminate multiple downstream systems before evidence exposes it.

The staged plan makes every major dependency a checkpoint.

## Model/cost assessment

P0 does not require Astra-level long-horizon reasoning for every task. Much of the work is conventional TypeScript/React/API/test implementation once interfaces are stable.

GPT-6 Sol High is the preferred P0 model because:
- each prompt has a bounded architectural objective;
- checkpoint commits make later context concrete;
- retries repair one slice instead of rediscovering the whole project;
- repeated context can benefit from caching;
- Astra can remain an escalation option for an exceptional cross-system blocker.

Do not use Astra merely for UI, CRUD, tests, persistence or routine integration.

## Prompt decomposition

### P1 — Product kernel

Establish the repository shape and canonical domain first:
- workspace/build/test foundation
- ChannelSpec v1
- pure channel mutations/selectors
- local project persistence
- safe server/API skeleton

Exit condition: a channel can be created, mutated, persisted and reopened without UI or AI.

### P2 — Television kernel

Resolve the platform-sensitive foundation early:
- shared TV semantics
- focus/navigation contracts
- generated Vega source/template
- manifest requirements
- generator determinism/parity contracts
- ADBT/Vega toolchain discovery/doctor

Exit condition: the project can deterministically generate credible Vega source from ChannelSpec and truthfully report toolchain state.

### P3 — Creator Studio

Project the stable domain into user experience:
- onboarding/create flow
- Design and Content
- interactive TV Preview
- virtual remote/keyboard
- visible focus
- detail/back/playback

Exit condition: the complete deterministic creator-to-preview workflow works without AI.

### P4 — Channel Agent

Add AI as another controller of the already-working domain:
- provider-neutral ChannelAgent
- validated structured tools
- deterministic mock
- Bedrock adapter
- transcript/status/error handling

Exit condition: natural-language changes travel through validated tools to ChannelSpec and preview.

### P5 — Code, Build and Publish

Connect the generated output to creator control and deployment:
- generated-source tree/editor
- custom-edit detection/regeneration protection
- bounded real build execution
- evidence-backed artifacts
- readiness checks
- submission bundle

Exit condition: generated code is inspectable/editable and the product truthfully distinguishes source generation, real build evidence and human Amazon submission steps.

### P6 — Hackathon convergence

Do not invent new architecture.

Integrate and polish:
- Wild Earth fixture
- full golden path
- cross-system regressions
- aggregate check
- README/MODULES/setup
- demo reliability and visual polish
- actual Amazon tool feedback observed so far

Exit condition: coherent candidate ready for independent real-platform qualification.

### P7 — Qualification closeout

Manual/browser gate only.

Prove:
- browser creator workflow
- persistence/restart
- real Bedrock if claimed
- real generated Vega source
- custom-code protection
- real VPKG build
- actual Vega simulator/Fire TV launch/navigation
- truthful publish/readiness
- demo rehearsal

## Risks and controls

1. **Schema drift**
   - Lock ChannelSpec and mutations in P1.
   - Later prompts consume contracts rather than invent parallel state.

2. **Preview/runtime drift**
   - Define shared TV semantics and generator contracts in P2 before Studio.
   - P3 tests Preview against those semantics.

3. **Vega uncertainty**
   - Pull tooling/manifest discovery into P2.
   - Missing tools are explicit blocked states, never guessed commands.

4. **AI masking deterministic defects**
   - Build P1-P3 without requiring AI.
   - P4 may only mutate through validated domain tools.

5. **Regeneration destroys custom work**
   - P5 requires explicit dirty/custom protection and tests.

6. **Repeated global validation cost**
   - P1-P5 use focused validation.
   - P6 owns aggregate pre-closeout convergence.
   - P7 repeats aggregate checks with manual platform proof.

7. **Closeout becoming implementation**
   - P7 may record evidence and small evidence/docs files only.
   - Remaining source defects force NOT GREEN and a correction stack.

## Closeout threshold

Green requires Prompt -> Product -> Real Television, not merely a polished Studio.

If no real build/runtime evidence exists, P7 is Not Green.

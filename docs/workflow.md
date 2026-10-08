# FireLaunch Engineering Workflow

Adapted from the current Dope repository process.

## Vocabulary

Prompt Stack is canonical.

A Prompt Stack may implement a roadmap phase or bounded correction.

Folder conventions:
- p<number> for pre-1.0 phases
- c<phase>-<lower-kebab-slug> for corrections

## Documentation gate

/docs-review
-> owner review
-> explicit approval
-> /docs-apply

## Implementation planning gate

/prompt-ass -> prompt-assessment.md
/prompt-plan -> implementation-plan.md
/prompt-write <folder> -> executable prompts + stack README

Assessment asks what must change and what risk exists.
Plan maps it onto source/boundaries.
Prompts reference the plan instead of restating the entire design.

## Task folder contract

docs/tasks/<stack>/

Recommended:
- README.md
- prompt-assessment.md
- implementation-plan.md
- P1-*.txt ...
- one final closeout prompt
- closeout.md after qualification

Exactly one final closeout prompt is required by the runner.

## Model policy

- GPT-6 Sol Medium: default bounded implementation.
- GPT-6 Sol High: difficult/risky work, P0 implementation and independent qualification.
- GPT-6 Sol XHigh: exceptional repair/review only.
- GPT-6 Astra High: exceptional long-horizon escalation when a cross-system blocker justifies the added cost.

Do not default to Astra for ordinary UI, CRUD, persistence, tests or bounded integration work.

## Staged implementation policy

A phase should prefer a dependency-ordered sequence of bounded checkpoints when the product spans multiple independently testable systems.

Each prompt should:
- begin from a coherent prior checkpoint;
- own one architectural slice;
- run focused validation;
- leave explicit handoff facts for the next prompt;
- avoid repeating work that an earlier checkpoint already established.

P0 follows:
domain -> TV/runtime -> Studio -> agent -> deployment -> convergence -> qualification.

If final qualification finds blockers, close Not Green and create a bounded correction stack rather than silently broadening closeout.

## Runner

Validate:
yarn codex:stack:validate p0

Run:
yarn codex:stack p0

Runner regressions:
yarn test:runner

The runner validates grammar/versioning, resumes completed checkpoints, asks before dirty-tree continuation, invokes Codex, retries bounded model-capacity failures, owns implementation commits, stops at browser-required gates and stores evidence under .codex-runs/.

Agents must not commit when runner-owned.

## Evidence

External/platform claims require direct evidence:
- Bedrock: actual provider call if claimed.
- Vega build: successful real build + artifact.
- simulator/device: actual launch/navigation.
- Appstore submission: actual Console/API evidence.

Use Green / Qualified only when closeout criteria pass.

## Time discipline

Implementation prompts should normally target a bounded work unit rather than a whole product.

Focused validation belongs inside each implementation prompt. Full aggregate checks and manual browser/device proof belong near convergence/closeout so the stack does not repeatedly pay for global validation.

## Closeout

Record exact HEAD/candidate, version, validations/counts, browser/device evidence, external-service evidence, known gaps and final Green / Not Green disposition.

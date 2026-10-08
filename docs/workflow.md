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
- GPT-6 Sol High: difficult/risky work and independent qualification.
- GPT-6 Sol XHigh: exceptional repair/review only.
- GPT-6 Astra High: exceptional long-horizon greenfield implementation.

P0/P1 is intentionally GPT-6 Astra High.

## One-shot policy

One-shot means one implementation prompt owns the approved MVP. It does not remove qualification.

P0 therefore contains:
- P1 implementation: Astra
- P2 closeout: independent browser/Vega evidence

If P2 finds blockers, close Not Green and create a correction stack.

## Runner

Validate:
yarn codex:stack:validate p0

Run:
yarn codex:stack p0

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

Ordinary corrections target about 8 minutes and avoid exceeding 15 minutes without reason.

P0/P1 is an owner-approved exception because Astra is being used for a bounded whole-MVP one-shot. Do not carry the exception into later corrections.

## Closeout

Record exact HEAD/candidate, version, validations/counts, browser/device evidence, external-service evidence, known gaps and final Green / Not Green disposition.

# p0 — FireLaunch Hackathon MVP

Status: EXECUTED / P7 NOT GREEN (see [closeout](closeout.md))
Phase: 0
Mode: Phase
Baseline version: `0.0.0`

## Goal

Build and qualify the FireLaunch hackathon MVP through a dependency-ordered Prompt Stack that establishes the product kernel, television kernel, creator workflow, agent, deployment workflow and final convergence before independent real-platform qualification.

## Prompts

| Prompt | Focus | Model | Browser |
| --- | --- | --- | --- |
| P1 | Product kernel: workspace, ChannelSpec, persistence, API | GPT-6 Sol High | no |
| P2 | Television kernel: TV semantics, Vega generator, manifest/toolchain discovery | GPT-6 Sol High | no |
| P3 | Creator Studio: onboarding, Design/Content, Preview, focus/playback | GPT-6 Sol High | no |
| P4 | Channel Agent: validated tools, mock, Bedrock | GPT-6 Sol High | no |
| P5 | Code, Build and Publish/readiness | GPT-6 Sol High | no |
| P6 | Golden-path convergence, fixture, regression and polish | GPT-6 Sol High | no |
| P7 | Browser + real Vega qualification closeout | GPT-6 Sol High | yes |

P1-P6 are runner-owned implementation checkpoints. P7 is the **only final closeout prompt** and the manual/browser gate.

## Version path

- baseline: `0.0.0`
- P1: `0.0.1`
- P2: `0.0.2`
- P3: `0.0.3`
- P4: `0.0.4`
- P5: `0.0.5`
- P6: `0.0.6`
- P7: `0.0.7`

## Dependency order

ChannelSpec/persistence
-> shared TV semantics/Vega generation
-> Studio/Preview
-> ChannelAgent
-> Code/Build/Publish
-> integrated demo candidate
-> real browser/Vega qualification

This ordering is intentional. Later prompts must consume prior checkpoints rather than recreate them.

## Required P0 outcome

- progressive creator onboarding/new channel
- versioned ChannelSpec and safe local persistence
- shared TV semantic model
- generated React Native for Vega project
- required Vega manifest main category
- interactive 16:9 TV Preview
- keyboard + virtual remote focus navigation
- content/detail/playback demo path
- Design and Content editing
- provider-neutral ChannelAgent
- deterministic mock + real Bedrock adapter
- generated-source Code surface
- regeneration/custom-edit protection
- Vega toolchain doctor and real build wrapper
- Publish readiness/submission bundle
- rights-safe Wild Earth fixture
- aggregate tests/check
- exact setup/run/demo documentation

Deferred:
auth, billing, multi-user, hosted media, analytics, IAP, ads, Fire OS, other TV platforms and Developer Console credential automation.

## Closeout

P7 reports **GREEN / QUALIFIED** or **NOT GREEN** using direct evidence.

Browser-only polish cannot qualify P0. A real generated app must build to a verified artifact and run on a Vega simulator or Fire TV for Green.

If P7 is Not Green, create a bounded `c0-*` correction Prompt Stack around observed blockers. Do not rerun P0 wholesale.

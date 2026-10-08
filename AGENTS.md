# FireLaunch Agent Instructions

## Read order

Before implementation:
1. BOOT.md
2. docs/VISION.md
3. docs/PRINCIPLES.md
4. docs/PRODUCT-MODEL.md
5. docs/ARCHITECTURE.md
6. docs/workflow.md
7. the active docs/tasks/<stack>/ README, prompt-assessment and implementation-plan
8. the current prompt

## Repository behavior

- Inspect current source before editing.
- Keep changes inside the active prompt scope; do not pull later P0 work forward merely because the interface is visible.
- Prefer TypeScript and explicit contracts.
- Fail closed on malformed ChannelSpec, unsafe paths, missing toolchains and false build claims.
- Never commit secrets, AWS credentials, Amazon credentials, private developer-console data or generated user media.
- Do not automate Amazon account login by scraping or credential capture.
- Never fabricate external validation.
- Preserve creator ownership: generated projects must be ordinary source trees usable outside FireLaunch.

## P0 sequencing

P0 is deliberately staged:

- P1 owns contracts/channel engine/persistence/API foundation.
- P2 owns shared TV semantics/Vega generation/toolchain discovery.
- P3 owns Studio/Preview/focus/playback.
- P4 owns ChannelAgent/tools/mock/Bedrock.
- P5 owns Code/Build/Publish.
- P6 owns cross-system convergence/polish.
- P7 owns final real browser/Vega qualification only.

Later prompts build on prior checkpoints. Do not use a prompt to redesign earlier Green boundaries unless direct evidence proves a blocker and the current prompt explicitly owns that repair.

Preserve ChannelSpec, preview/source parity, Vega-first output, provider-neutral agent boundary and truthful validation.

Do not add authentication, billing, team collaboration, cloud multi-tenancy, arbitrary app marketplaces, Fire OS parity, Developer Console credential handling or generic IDE features.

## TV UX invariants

- Treat preview as a 10-foot TV UI, not a responsive website.
- Every interactive TV element is reachable through directional focus navigation.
- Focus is obvious.
- Back behavior is deterministic.
- Virtual remote and keyboard drive the same command abstraction.

## Agent/runtime invariants

Preferred flow:
User request -> ChannelAgent -> structured tool request -> validate mutation -> apply ChannelSpec -> persist -> preview refresh.

Bedrock is the primary real hackathon provider. Mock mode is deterministic and test-only/demo-fallback.

## Generated project invariants

- One FireLaunch project generates one self-contained Vega project.
- Generation is deterministic from ChannelSpec plus checked-in template/runtime version.
- Custom code edits are not silently overwritten.
- com.amazon.category.main is required in the Vega manifest.
- A build artifact exists only when the actual build command succeeds and the file exists.

## Validation

Each implementation prompt runs the smallest sufficient focused tests plus affected build/typecheck and `git diff --check`.

P6 owns aggregate pre-closeout convergence validation.

P7 owns real browser and Vega simulator/device evidence plus the final aggregate closeout.

Do not substitute provider command output for FireLaunch-owned validation.

## Git

When executed by `scripts/codex-stack.mjs`, Codex runs with explicit config overrides for `sandbox_mode="workspace-write"`, `approval_policy="never"`, and workspace network access so implementation prompts can edit the repository and install declared dependencies. The sandbox/runner contract still protects Git ownership and out-of-workspace mutation.

- do not create commits;
- do not rewrite/move HEAD;
- read-only Git inspection is allowed;
- leave successful changes in the working tree;
- the runner owns the checkpoint commit.

If an explicitly accepted dirty tree exists, inspect and continue it rather than resetting it.

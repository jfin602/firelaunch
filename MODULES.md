# Implemented modules (0.0.6)

| Path | Responsibility | Boundary |
| --- | --- | --- |
| `packages/contracts` | Strict versioned ChannelSpec, project schema, safe URLs/assets, starter spec and migration seam | Canonical persisted state; malformed/unsupported input fails closed |
| `packages/channel-engine` | Pure validated mutations and selectors | No UI, provider or filesystem state |
| `packages/tv` | Shared TV projection, stable focus IDs, D-pad/Select/Back transitions | Browser Preview and generated runtime consume the same semantic data/transitions |
| `packages/generator` | Deterministic Vega source from checked-in template and TV projection; toolchain doctor | No silent overwrite, no build-success claim; local artwork paths remain unresolved |
| `packages/agent` | Validated bounded tools, deterministic mock, Bedrock Converse adapter | Mutations pass through the channel engine; no shell or arbitrary source tool |
| `apps/server` | Loopback JSON API, atomic revisioned persistence, guarded source edits, real-build wrapper, readiness/bundle | Local single-user state; artifact only after fresh VPKG verification; no Console submission |
| `apps/studio` | React onboarding, Design/Content editing, agent activity, TV Preview, Code/Build/Publish | Original demo media and SVGs are local Studio assets, not bundled Vega assets |
| `templates/vega-channel` | Creator-owned React Native for Vega template and manifest | Requires independent real SDK build and simulator/device qualification |
| `scripts/codex-stack.mjs`, `test/unit` | Prompt Stack execution/validation and runner regressions | Runner alone stages and commits checkpoints |

`apps/studio/test` contains JSDOM UI/API golden-path coverage. `apps/server/test` covers persistence, source guards, simulated build evidence, and bundle truthfulness. Platform evidence and real-browser qualification belong to P7.

# Amazon Developer Tool Feedback / Friction Log

Capture entries while building.

## Tool inventory

| Tool / API / SDK | Purpose | First impression | Final assessment |
| --- | --- | --- | --- |
| Amazon Devices Builder Tools for AI | Vega-specific agent context/tools | Pending | No context or MCP connection available for P7 qualification |
| Vega SDK / developer tools | Generate/build/run Vega app | Pending | SDK/CLI absent in P7 host; no build or device run |
| React Native for Vega | Generated channel runtime | Pending | Source generated, runtime unqualified without Vega build/device |
| Amazon Bedrock | FireLaunch runtime channel agent | Pending | Adapter exists; no configured live request in P7 |

### 2026-10-08 — local Vega prerequisites absent during P2

- Tool: Local Node/npm, ADBT context, Vega SDK and Android Debug Bridge.
- Task attempted: Discover local build and device prerequisites for generated Vega source.
- Steps: Inspected `PATH`, environment, available MCP resources/templates, ran `node --version`, `npm --version` and the FireLaunch doctor; checked published Amazon package versions through npm registry.
- Expected: Node 24/npm 12 baseline with Vega SDK, device tools and ADBT context discoverable.
- Actual: Node v24.21.0; npm 11.19.0 (below repository's npm 12 requirement, `npm install` initially returned EBADENGINE); no verified Vega SDK CLI configured, no `adb` on PATH; no `VEGA_SDK_PATH` or `ADBT_CONTEXT_PATH`; no ADBT MCP resources/templates accessible in this session. Registry exposed `@amazon-devices/react-native-kepler` 4.0.1, `@amazon-devices/kepler-cli-platform` 0.22.14 and `@amazon-devices/react-native-w3cmedia` 2.3.2, but package availability does not prove a local SDK/build.
- Severity: Important.
- Workaround: Used a temporary npm cache and disabled engine-strict only for local workspace dependency linking; did not invoke a Vega build or mark the generated app qualified.
- Actionable suggestion: Install the matching npm 12 and Vega SDK/ADBT toolchain in the qualification environment; verify the generated project using actual installed tooling before P7 claims.
- Evidence/link/log: `npm run doctor:vega` and local npm registry queries on October 8, 2026; no VPKG or device output.

## Friction entries

### 2026-10-08 — P7 real-platform qualification blocked by local prerequisites

- Tool: Vega SDK/CLI, ADBT, adb, Bedrock, and the FireLaunch toolchain doctor.
- Task attempted: Build and run the generated Wild Earth channel and exercise a real Bedrock-backed request.
- Steps: From clean HEAD `6e6d0b8febf4b04baf328d920356b22774dd20a7`, `npm ci` failed with `EBADENGINE`; `npx --yes npm@12.2.0 ci` and the root workspace build succeeded. Ran `npm run doctor:vega`, used the Studio Build action, and inspected provider configuration and generated source.
- Expected: A verified local Vega SDK/CLI, release artifact, simulator/device, ADBT context, and live Bedrock request when claiming those integrations.
- Actual: Host Node `v24.21.0`, PATH npm `11.19.0` (requires 12), no `ADBT_CONTEXT_PATH`, `VEGA_SDK_PATH`, `VEGA_CLI_PATH`, `adb`, or authorized device. Build was blocked before a Vega command; no VPKG or simulator footage exists. Bedrock model/region/credential indicators were absent; only deterministic `MOCK` ran. The initial broad cinematic-color request was rejected by mock, while `primary color to #224466` saved revision 9.
- Severity: Critical for hackathon Green.
- Workaround: npm 12.2.0 from the npm registry qualified the workspace install/check, but cannot substitute for Vega or Bedrock. Browser Preview used the local five-second clip only.
- Actionable suggestion: Provision and identify a matching Vega SDK/CLI and simulator or Fire TV, plus device-reachable media and bundled TV artwork; rerun a real release build and D-pad test. Configure Bedrock through the standard AWS credential chain if the optional Builder claim is retained. Record exact ADBT MCP identity/connection and feedback once available.
- Evidence/link/log: `docs/tasks/p0/closeout.md`; generated project and submission bundle under `/tmp/firelaunch-p7-6e6d0b8/projects/ch_b75caed5a3f74397b885b1beb68e1ed9/`.

### YYYY-MM-DD — short title

- Tool:
- Task attempted:
- Steps:
- Expected:
- Actual:
- Severity: Critical / Important / Nice-to-have
- Workaround:
- Actionable suggestion:
- Evidence/link/log:

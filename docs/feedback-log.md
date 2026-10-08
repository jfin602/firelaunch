# Amazon Developer Tool Feedback / Friction Log

Capture entries while building.

## Tool inventory

| Tool / API / SDK | Purpose | First impression | Final assessment |
| --- | --- | --- | --- |
| Amazon Devices Builder Tools for AI | Vega-specific agent context/tools | Pending | Pending |
| Vega SDK / developer tools | Generate/build/run Vega app | Pending | Pending |
| React Native for Vega | Generated channel runtime | Pending | Pending |
| Amazon Bedrock | FireLaunch runtime channel agent | Pending | Pending |

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

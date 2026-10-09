# P0 / P7 qualification closeout — NOT GREEN

Date: 2026-10-08. Candidate HEAD: `6e6d0b8febf4b04baf328d920356b22774dd20a7` (`main`, P6 checkpoint). Assigned closeout version: `0.0.7`; package and Studio version metadata were advanced from `0.0.6` without a source behavior repair. No commit was created by P7.

## Automated and clean-start evidence

- Working tree was clean at preflight. The README's literal `npm ci` failed `EBADENGINE`: Node `v24.21.0`, npm `11.19.0` versus required npm 12. `npx --yes npm@12.2.0 ci` succeeded from the npm registry. `npx --yes npm@12.2.0 run build` succeeded across seven workspaces and produced Studio assets, not a VPKG.
- Final `npx --yes npm@12.2.0 run check` passed: seven workspace typechecks, seven production workspace builds, and **142/142 tests** (32 kernel, 6 Studio, 104 runner). The root check log was captured at `/tmp/firelaunch-p7-check.log`. Final `git diff --check` passed.
- P1–P6 runner final responses were reviewed under `.codex-runs/p0/2026-10-08T14-46-28-134Z/`; none claimed real browser, Bedrock, VPKG, or device evidence.

## Browser and canonical state

- In the real Codex in-app browser at `http://127.0.0.1:4173/`, created `ch_b75caed5a3f74397b885b1beb68e1ed9` with the rights-safe Wild Earth sample and an initial natural-language request. The broad request, “Make the primary color #224466 for a cinematic Wild Earth channel,” was rejected by the deterministic mock. A supported follow-up, `primary color to #224466`, used `inspect_channel` and `set_brand` and saved revision 9. This proves bounded mock mutation, not general natural-language channel creation or Bedrock.
- Design renamed the channel to **Wild Earth: Wild Horizon** at revision 10. Content renamed the Nature rail to **Wild Places** at revision 11. The Preview immediately showed both edits. The persisted `project.json` at `/tmp/firelaunch-p7-6e6d0b8/projects/ch_b75caed5a3f74397b885b1beb68e1ed9/` held the same title, `#224466` brand color, hero, Wild Places/Oceans/Africa rails, and three catalog entries. Browser reload and API process restart restored revision 11.
- Keyboard Down visibly focused the hero; Enter opened Field Notes detail and Enter opened playback. Browser video inspection observed `currentTime: 3.0088`, `duration: 5`, `paused: false`, `readyState: 4`, and no media error. Virtual Back returned to detail and then the page; virtual Down visibly focused a rail card. This is local Studio Preview evidence only.

## Agent, Vega, and device evidence

- `FIRELAUNCH_AGENT_PROVIDER` was unset, so the Studio labeled the provider `MOCK`. No `BEDROCK_MODEL_ID`, AWS region, or credential/profile indicator was present. No real Bedrock request succeeded or is claimed.
- Code generated ten ordinary source files at `/tmp/firelaunch-p7-6e6d0b8/projects/ch_b75caed5a3f74397b885b1beb68e1ed9/generated/`, including `src/App.js`, `src/channel.json`, and `src/tv-runtime.js`. The inspected `manifest.toml` contains `categories = ["com.amazon.category.main"]`. The generated package pins `@amazon-devices/react-native-kepler` `4.0.1`, `@amazon-devices/kepler-cli-platform` `0.22.14`, and `@amazon-devices/react-native-w3cmedia` `2.3.2`; these are source dependencies, **not installed SDK or runtime identities**.
- A Code UI edit to generated `README.md` displayed `README.md • modified`. Regeneration returned HTTP 409 `CONFLICT` for custom/unknown files; the marker remained in the file. Custom source was not silently overwritten.
- `npm run doctor:vega` identified Node `v24.21.0`, npm `11.19.0` on PATH, and missing/unverified `ADBT_CONTEXT_PATH`, `VEGA_SDK_PATH`, `VEGA_CLI_PATH`, `adb`, and device/simulator visibility. No ADBT MCP context/connection or exact SDK identity could be verified. The Studio Build action reported `blocked` for npm 12, Vega SDK, and CLI prerequisites; no Vega build command ran.
- **Real artifact path: none. SHA-256: none.** No `.vpkg` was found under the isolated project data root. No Vega simulator or Fire TV was available to launch or navigate the generated app. The shared semantic source and browser Preview do not prove real television execution.

## Publishing and demo

- Publish correctly left TV experience, build artifact, store assets, support/privacy, device evidence, and human Amazon steps open. It showed no Developer Console action. The local bundle at `/tmp/firelaunch-p7-6e6d0b8/projects/ch_b75caed5a3f74397b885b1beb68e1ed9/submission-d229bc17-d5a7-43aa-91c4-9b1dee511678/` contains `readiness.json`, `store-copy.md`, `store-assets.md`, and `checklist.md`; inspection found `submitted: false`, no build artifact, three unresolved artwork references, and no screenshots. After the blocked Build attempt, the bundle says “No build has run,” accurately indicating no command execution but omitting the observed prerequisite details.
- The browser portions of `docs/demo-plan.md` can be shown within their allocated segments. The 2:15–2:40 real-platform segment cannot be rehearsed or recorded without fake footage. The complete under-three-minute judging story is therefore **not rehearsable** on this host. The loopback demo video URL and unresolved `assets/*.svg` references also prevent a faithful standalone device demo without replacement/packaging.
- No Amazon Appstore submission occurred.

## Unresolved gaps and next bounded stacks

1. `c0-vega-real-tv`: provision and record the matching Vega SDK/CLI, ADBT connection, and simulator/Fire TV; replace loopback media with device-reachable rights-cleared media; package TV-compatible artwork; build a real release artifact, record its path/hash, and navigate the generated app with a D-pad. Repair only source defects demonstrated by that run.
2. `c0-prompt-first`: qualify a live Bedrock-backed broad Wild Earth request if the AWS Builder claim is desired, or explicitly narrow the prompt claim to supported deterministic mock phrases. The rejected initial request shows general natural-language creation is not yet proven here.

## Disposition

**NOT GREEN. Prompt → Product → Real Television is not proven.** Browser Preview and source generation passed their direct checks, but real Bedrock (if claimed), Vega build artifact, and simulator/device evidence are absent. P7 did not use implementation repairs to turn missing platform proof into a Green closeout.

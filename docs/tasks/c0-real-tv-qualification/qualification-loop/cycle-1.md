# Cycle 1 — SDK project and release build

- **Starting HEAD/version:** `87fb34c4822b7e866e6759060bbbd4acbc658e7a` / `0.0.7`; clean tree at preflight.
- **Failed gates:** G3 generated project compatibility and G4 release VPKG.
- **Observe:** The generated fixture failed `vega project doctor` because `[os.version]` was missing. `vega project install --fix --os-min 1.2 --os-version 1.2` rejected the aliased `react-native` version as `0.0`. An SDK-generated reference app instead used React Native `0.83.0`, Kepler `~4.0.0`, an `app.json` component name, and OS 1.2 manifest metadata. The old `vega build -t x86_64 -b Release` returned zero with a 3.7 KB package lacking the JavaScript bundle: a false FireLaunch build claim.
- **Diagnose:** The generated package and manifest were incompatible with the installed SDK 0.24 profile; the server used the native-only command rather than the React Native Vega release builder.
- **Repair:** Updated `packages/generator/src/index.ts`, `templates/vega-channel/manifest.toml`, and `templates/vega-channel/index.js` to match the installed SDK contract. Updated `apps/server/src/workspace.ts` to run the generated project's local `react-native build-vega --build-type Release` after verifying its dependency installation and the Vega CLI path. Updated their focused tests. No existing creator edits were reset.
- **Focused validation:** Generator build and 3/3 tests passed. Server build and 5/5 workspace tests passed. `git diff --check` passed. A fresh generated project passed every critical `vega project doctor` check and VPT manifest validation. `react-native build-vega --target x86_64 --build-type Release` returned zero with bundled JS/Hermes in the VPKG. The first npm dependency install timed out; retry on the better connection succeeded. Raw logs include `/tmp/firelaunch-c0-cycle1-npm-install.log`, `/tmp/firelaunch-c0-cycle1-npm-install-retry.log`, and `/tmp/firelaunch-c0-cycle1-rn-build.log`.
- **Real SDK/device/provider:** CLI `1.4.4`, SDK `0.24.12112`; SDK build verified. No live Bedrock configuration was available.
- **Remaining failures:** Actual D-pad navigation, playback, artwork/media reachability, browser regressions, and live Bedrock were not yet qualified.
- **Disposition:** **PARTIAL.** Proceeded to direct device execution.


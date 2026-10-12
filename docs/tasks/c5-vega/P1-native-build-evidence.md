# c5-vega P1 — bound native build evidence

Date: 2026-10-12. Starting HEAD `afbd54d617d184902b64e27b86cc8ecbcab88669`; root `package.json` and both root lockfile version entries remain `0.6.0`. This is a build fixture, not a creator-approved release or device qualification.

The final fresh generated bound project is ignored at `.codex-runs/c5-vega/p1/bound-final/`, fingerprint `1479c2d8cf4d3c191b0d35b03bb6f4f1b2beb68fc550bed41c776f5e3619288a`. It uses `https://channels.example.org` as an inert example origin, `com.example.firelaunchbuild` as a fixture package ID and a brand-only offline bundled channel. `src/release-config.json` contains only deployment ID, channel ID, package ID and origin. No owned publication, live HTTPS response, installed device or rights approval was exercised.

## Dependency and bundle proof

- Installed Vega CLI `1.4.4`, active SDK `main@0.24.12112`; generated React Native `0.83.0`, Kepler `4.0.1+rn0.83.0`, Zod `4.6.5`, Metro `0.83.8`.
- The generated npm alias requests `@amazon-devices/react-native-async-storage__async-storage@2.1.9000000000`. The installed alias package reports `2.1.9000000000+1.23.1` and its `kepler-compatibility.json` maps version `2.1.9000000000` to `/com.amazon.kepler.async_storage__async_storage_2@IAsyncStorage__AsyncStorage_1`. Native autolinking included that module. The former `2.1.9000000000-rn-83` spec was absent from the compatibility map.
- The bound generated Babel config installs `@babel/plugin-transform-export-namespace-from@7.29.7` before Metro processes Zod. Metro completed the JS bundle and Hermes bundle; the former `export * as` parser error did not recur. Unbound generated projects keep the original preset-only Babel config and no AsyncStorage/Zod/plugin dependency.
- The generated `src/remote-release.js` verifier, SHA-256 implementation, schema and LKG loader were not weakened. Focused tests include unknown-field, bad-digest, wrong-deployment, sequence and storage-failure paths.

## SDK execution and artifact

The installed SDK is outside the writable workspace. Direct `vega project doctor` and the first native build reached an SDK attempt to create `workspace/App/bound` under `/home/jfin/vega/sdk/vega-sdk/main/0.24.12112` and failed with `EROFS`. A temporary `/tmp/firelaunch-c5-vega-sdk` shadow linked the installed SDK components and copied its small workspace metadata; a `/tmp/firelaunch-c5-bin/vega` wrapper ran the installed `dutyfree-vega` with that writable workspace. No installed SDK files were edited. On the final project, `vega project doctor` passed all critical checks and VPT manifest validation with zero errors; the release build also passed VPT validation.

Command: `PATH=/tmp/firelaunch-c5-bin:/tmp/firelaunch-c5-vega-sdk/tools/bin:$PATH KEPLER_SDK_PATH=/tmp/firelaunch-c5-vega-sdk node_modules/.bin/react-native build-vega --target x86_64 --build-type Release` from the generated project. Exit code `0`; build reported `build-vega completed`.

Artifact: `.codex-runs/c5-vega/p1/bound-final/build/private/kepler/firelaunch-wild-earth/undefined/vega/x86_64/Release/firelaunch-wild-earth_x86_64.vpkg` (541,474 bytes, SHA-256 `e67b696ef8808c841e1d2f4918cf953c85479d450f62155b73d1708124653662`). Its release JS bundle SHA-256 is `a457bdefad950d42e67dfd5831f62913f823be78d993a7ecb49d60129796927c`. The path is ignored build output in this worktree, not a submitted or installed artifact. The build log reports a default icon and build number 0; neither proves store readiness.

No browser, device, public resolver or on-device AsyncStorage behavior was observed in P1. P2 prepares controlled HTTPS/rights handoff; P3 independently checks a real owned release and one installed package on VirtualDevice.

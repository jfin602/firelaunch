# P7 real-TV qualification repair loop

Starting candidate: `87fb34c4822b7e866e6759060bbbd4acbc658e7a`, version `0.0.7`, clean worktree. The historical P7 closeout in [`../../p0/closeout.md`](../../p0/closeout.md) remains NOT GREEN. This folder records new, direct evidence without changing that result.

## Preflight (2026-10-09)

- Host: native Linux Mint 22.3 x86_64, based on Ubuntu 24.04; Node `v24.21.0`. PATH npm is `11.19.0`; `npx --yes npm@12.2.0` supplies the repository-required npm 12. Amazon documents native Ubuntu 24.04 x86_64 as supported; Linux Mint is not listed by name. [Vega install requirements](https://developer.amazon.com/docs/vega/0.24/install-vega-sdk).
- Installed through Amazon's published installer: Vega CLI `1.4.4`, active SDK `main@0.24.12112`, path `/home/jfin/vega/sdk/vega-sdk/main/0.24.12112`. The installer also installed Vega Virtual Device. The first download failed on the installer's 30-second curl timeout; retrying the same installer with only its temporary curl timeouts increased to 300 seconds succeeded. Raw logs: `/tmp/firelaunch-vega-install.log`, `/tmp/firelaunch-vega-install-resumed.log`.
- `vega virtual-device start --no-gui --no-gl-accel --timeoutSeconds 90` reported ready, but its display remained black, including for an SDK reference app. Starting the GUI with acceleration enabled resolved the display failure. `vega device list` identified `VirtualDevice : tv - x86_64 - OS - amazon-34bb27f8dce87e75`; `vega device info` reported simulated TV OS 1.2, x86_64, Developer Mode true. The final candidate was installed and visibly executed on that target in cycle 3.
- No ADBT connection or `ADBT_CONTEXT_PATH` was available. No `adb` executable was found on PATH or via `vega which adb`; Vega's own device commands can communicate with the virtual device.
- No `FIRELAUNCH_AGENT_PROVIDER`, `BEDROCK_MODEL_ID`, AWS credential/region environment indicator, AWS CLI, or AWS shared config/credentials file was present. No live Bedrock request is claimed. No credentials were read or recorded.
- The checked-in Wild Earth demo clip is described in source as an original five-second procedural study, but its `127.0.0.1:4173` URL is inaccessible from an independent TV. Three `assets/*.svg` artwork references are unresolved in generated output. Device-reachable media and packaged artwork remain qualification work.
- The original generated project pinned a React Native alias and omitted `[os.version]`; direct SDK validation and the SDK's RN 0.83 template determined the first repair. See the cycle reports and [qualification closeout](qualification-closeout.md) for the final disposition.

## Evidence policy

Tracked files in this folder contain commands, results, and dispositions. Raw platform logs and generated source stay under `/tmp/firelaunch-c0-qual/` and `/tmp/firelaunch-c0-*.log`; generated media and credentials are not committed. A passing browser preview, unit test, or SDK doctor result does not establish a release VPKG or television execution.

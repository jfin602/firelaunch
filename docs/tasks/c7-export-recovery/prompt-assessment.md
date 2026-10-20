# c7-export-recovery — Prompt assessment

Status: authored for execution on 2026-10-20, not run. This correction is scoped to P7 failures documented in ../p7/closeout.md. Fixed version: 0.7.3 in root package.json and the two top-level package-lock.json version fields. Do not increment to 0.7.4 in this correction.

## Evidence audit

**P7 P4 is NOT GREEN**, not a missing version bump. The failed 0.7.3 guarded deployment was schema compatible, copied exact tested server/Studio assets, and returned HTTPS HTML/JS/CSS 200 while browser rendered only empty `#root`. A local static render of the production bundle displayed the signed-out page; no captured JS console error exists. Session loss after service restart explains renewed sign-in, **not** blank root. Diagnosing rather than assuming CSP, MIME, stale cached chunks, React exception, session bootstrap, mismatched root, asset path or browser tooling is essential. The host was rolled back safely to 0.6.7 and public FREE release #1 hashes stayed unchanged.

**The missing worker is substantive, not a checkbox.** P7 P1 defined immutable build-input producer in `apps/server/src/release-build.ts`, owner snapshots in `hosted-workspace.ts`. P2 defined bounded `native-export.ts` four-file ZIP and fail-closed `/api/projects/:id/export-app` endpoints. P3 introduced licensed pinned Hls.js/MSE Vega runtime, bundled native tests and produced a fixture VPKG (not creator-bound). P7 closeout added exact trusted-vendor verification to prevent regressions; those changes are on GitHub main at `88257d4`. No separately isolated build host/worker job store, authenticated artifact transport or client ZIP download currently exists.

**VirtualDevice remains externally unqualified.** Start with a lightweight read-only 0.24.12112 SDK/CLI 1.4.4 graphical/held-session test to surface QEMU `running:false` early, but reserve actual install/playback for final manual closeout. Missing simulator access does not block focused implementation, only external qualification.

## Why four prompts, not three

1. **R1** browser runtime regression and early VVD feasibility are independent from the worker; need a verified diagnosis before another live deploy. Scope only startup, asset cache/session/entry path and visual smoke, not Studio redesign.
2. **R2** isolate user-editable native build execution; a separate, constrained job executor and verifiable receipt are a security boundary. This is bigger than a UI endpoint and must not be disguised as a subprocess on credentialed VPS.
3. **R3** authenticated queue/status/stored ZIP/download and Studio UI consume only qualified worker receipts. This is a separate coherent implementation slice.
4. **R4** independently qualifies live hosted UI, worker, ZIP and native device playback and is manual due to browser/host/operator/creator/device proof.

Keep 0.7.3 fixed. P1-P3 implementation commits runner-owned; P4 manual only. Use focused tests, one final `npm run check` after product convergence; no repeat of historical Q1 encode, Q2 exhaustive matrices or full older P7 runner. Target <=8 min / hard <=15 min each.

## Risks and decisions

- **Unauthorized worker provisioning:** Code may define a hardened worker adapter/runbook, but never install a host service, open firewall/DNS, mount secrets, grant sudo, spend cloud funds or deploy without distinct operator permission. If qualified executor is unavailable, preserve fail-closed status and provide exact activation requirement; do not claim a real worker/creator VPKG.
- **Build chain:** Source may contain arbitrary user-edited JS, transitive npm scripts and dependencies. Require fixed toolchain commands, immutable source/deployment fingerprints, ephemeral isolation, outbound allowlist/time/disk/CPU/RAM/process bounds, and no shared host/DB/AWS credentials. Verify a real external worker source-to-VPKG hash chain; deterministic fake receipt is not live build proof.
- **ZIP/data safety:** Source/worker receipt must bind owner/project/revision/deployment/package/release, correct x86_64 SDK, actual VPKG package inspection, checksums; no private S3, signed capabilities, foreign tenant data. Download requires current owner and artifact TTL/revision check. Avoid arbitrary package paths and buffering huge ZIPs in API memory.
- **Browser release:** Static 200 alone is insufficient; require DOM nonempty, sign-in UI or signed-in owner workspace, console exception capture and rollback trigger. Stop if root stays blank; do not repeatedly roll out untested guesses.
- **Public media:** Existing free release #1 read-only if still authorized and device-reachable; the exact release-scoped artwork URL returned 200 on host, not VVD. Do not silently widen CDN/creator publication or claim other rights.
- **Final native evidence:** `vega virtual-device start` printing ready with `qemu:-1` is not success. Stable serial, installed package, on-device HLS segment/request, picture and audible sound and restart are mandatory for correction GREEN. Physical Fire TV and Appstore excluded.

## Disposition

Three focused Sol High runner implementation prompts and one manual Sol High closeout. P7 remains NOT GREEN until direct R4 evidence. Preserve existing P7 P4 closeout, local 326 passes/15 skips and separate historical Q2 F7/P5/c5/Q3 dispositions.

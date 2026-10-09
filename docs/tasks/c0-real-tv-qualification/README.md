# c0-real-tv-qualification — FireLaunch real Vega qualification correction

Status: DOCS APPLIED / AWAITING PROMPT ASSESSMENT AND PLAN (not executed)
Type: Bounded P0 correction Prompt Stack
Baseline: `0.0.7` / P7 NOT GREEN (no version increment assigned by this documentation gate)
Model: GPT-6 Sol High by default; only escalate for a demonstrated cross-system need
Source evidence: [P7 closeout](../p0/closeout.md) and [feedback log](../../feedback-log.md)

## Purpose

Close the evidence gap between a working local Studio and **Prompt -> Product -> Real Television** without rebuilding the passing P0 foundation. P7 proved persisted Design/Content changes, browser keyboard/remote focus, detail/playback, restart recovery, Vega source with `com.amazon.category.main`, and custom-code preservation. P7 did **not** prove general natural-language channel creation, a successful live Bedrock call, an actual Vega release VPKG/hash or simulator/Fire TV execution.

This stack consolidates the P7 suggestions `c0-vega-real-tv` and `c0-prompt-first` under one owner. Preserve P7's NOT GREEN closeout as immutable historical evidence. There is no claim that any SDK, device or AWS account is currently available.

## Scope and prerequisite gates

- Identify and provision a **real**, versioned Vega SDK and CLI on a supported/verified build host; detect ADBT/adb and a launchable Vega Virtual Device (VVD) or an authorized compatible Fire TV. Missing tooling is a truthful BLOCKED result, not a request to invent command output.
- Inspect installed CLI commands, manifest constraints, React Native/Vega dependency compatibility and target architecture. For SDK 0.24 the documented OS 1.2 manifest includes `[os.version]` with `min` and `target` both `1.2`; apply only the configuration required by the actual installed toolchain. Verify the existing FireLaunch build wrapper command before relying on it.
- Replace `127.0.0.1` Studio media addresses with device-reachable, rights-cleared media; resolve/package artwork into TV-compatible paths before asserting visual or playback parity.
- Preserve ChannelSpec as canonical, existing Studio surfaces and shared TV semantics, creator-owned project source, custom edit protection, build/process safety, and the human Amazon Console boundary.
- Live Bedrock is required to claim arbitrary creator prose works through the real agent. If credentials/model/region are unavailable or the broad Wild Earth request fails, document that truthfully; do not substitute supported mock phrases or configured provider labels. Do not let this optional AWS Builder evidence displace the primary real-TV integration work.

## Proposed prompt ownership (implementation prompts not authored yet)

| Prompt | Owner and objective | Exit evidence |
| --- | --- | --- |
| P1 — Toolchain and target qualification | Establish the actual SDK/CLI, supported build host, test target, manifest/dependency plan, device-reachable fixture media/artwork. Avoid generic product rebuilding. | Versioned toolchain/target identities and exact blockers, with corrected fixture/preflight only where proven necessary. |
| P2 — Real package and provider | Generate source, run actual SDK validation and release build, fix only actual compile/runtime integration defects; separately attempt live Bedrock if broad NL claim retained. | Fresh release `.vpkg`, path/SHA-256, build invocation/logs and source revision; or precise NOT GREEN blocker. Live provider log when claimed. |
| P3 — Device qualification and closeout | Install the same package on real VVD/Fire TV, exercise launch, D-pad focus, detail, playback and Back, inspect Publish readiness, rehearse under-three-minute demo, run final aggregate check. | Verified device evidence, demo readiness, exact version/HEAD and GREEN or NOT GREEN closeout. Sole final manual/browser/device gate. |

If P1 cannot access a build host or target, stop and report the specific external prerequisite rather than launching broad source rewrites. P2 cannot claim VPKG success without actual command success and fresh artifact verification. P3 cannot claim device success without observing the installed app running.

## Qualification checklist

1. Record actual SDK, CLI, host, OS target, runtime/dependency compatibility, ADBT context if used, and VVD/Fire TV identity.
2. Build the generated source with verified toolchain commands; inspect required main category and SDK-specific OS manifest fields.
3. Record successful release build command, exit status, logs, exact nonempty VPKG path, SHA-256, ChannelSpec revision and source state. Verify the artifact is fresh and not a Studio web build.
4. Install **that same artifact** on an accepted simulator/TV target. Capture actual launch, focus navigation, content detail, playback, Back and return state; report defects with evidence.
5. Confirm media is reachable from the TV environment and artwork resolves in the package (not browser-only loopback URLs or missing `assets/*.svg`).
6. If making the broad natural-language / AWS Builder claim, show a successful real Bedrock request that produces validated ChannelSpec mutations and preview output. Keep any unproved claim explicitly out of the final narrative.
7. Verify Publish accurately distinguishes generated source, artifact and device proof from missing store assets, content rights, support/privacy and human Developer Console actions.
8. Rehearse/record the three-minute judging story using genuine target footage. No fabricated device images, VPKG, hash, Bedrock call or submission state.
9. Run focused tests/build/typecheck during bounded repairs, then one aggregate `npm run check`, task validator and `git diff --check` for final closeout. Record counts and candidate HEAD.

**Green threshold:** the real generated project builds and is observed functioning on an accepted TV target, with the original creator/prompt product path validated to the extent claimed. If the broad agent path remains mock-only, the general natural-language claim stays NOT PROVEN and the final disposition must explicitly separate it from TV proof; never silently broaden Green to cover unverified behavior.

## Constraints and workflow

- No code changes are authorized by this docs-apply gate. Proceed through `/prompt-ass` -> `/prompt-plan` -> `/prompt-write c0-real-tv-qualification` before running the stack.
- Exactly one final closeout prompt; runner owns implementation checkpoint commits. No duplicate P0 stack or broad retest after every correction prompt.
- Outside scope: authentication, billing, multi-user/cloud hosting, other TV platforms, an arbitrary IDE, automatic Developer Console submission or credential handling.
- Amazon SDK and device access are environment prerequisites, not issues solvable by passing unit tests. Log *observed* friction in `docs/feedback-log.md`.

## References

- Original [P7 closeout](../p0/closeout.md)
- [MVP roadmap](../../roadmap/mvp-roadmap.md)
- [Hackathon requirements](../../hackathon-requirements.md)
- [Engineering workflow](../../workflow.md)
- [Amazon Vega SDK 0.24 target OS guidance](https://developer.amazon.com/docs/vega/0.24/target-os-version)
- [Amazon Vega SDK 0.24 build host guidance](https://www.developer.amazon.com/docs/vega/0.24/continuous-integration)
- [Amazon Vega simulator/Fire TV run guidance](https://www.developer.amazon.com/docs/vega/0.24/run-apps)

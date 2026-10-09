# Amazon AppDev 2026 Hackathon Requirements

Challenge/rules snapshot reviewed: 2026-10-08. Vega SDK 0.24 compatibility guidance checked: 2026-10-09. Platform documentation does not replace verification against the installed SDK.

Official challenge:
https://amazonappdev2026.devpost.com/

Official rules:
https://amazonappdev2026.devpost.com/rules

## Deadline

October 23, 2026 at 12:00 PM PDT.

## Fire TV primary track

The project must launch a demo-ready app on Fire OS or Vega OS.

FireLaunch targets Vega OS first.

The demo video must show the project functioning on an actual Fire TV device or the Fire TV/Vega simulator. A browser-only FireLaunch preview is insufficient.

## Repository

The submission must provide a GitHub repository containing source, assets and instructions needed for the project to function.

The rules allow:
- public + open-source license; or
- private + access for the Amazon judging team.

This repository is currently public, so MIT LICENSE is included.

## Demo video

- public YouTube or Vimeo URL
- under three minutes for judging purposes
- show the project functioning on its intended platform
- avoid unauthorized third-party copyrighted/trademark material

## Product feedback

Submission requires feedback for each tool/API/SDK used:
- what was used and why
- what worked well
- what needs work
- onboarding experience
- whether we would build with it again

The rules also allow friction logs and state that participants submitting them can receive up to a 10% judging bonus.

Record observations continuously in docs/feedback-log.md.

## Amazon Devices Builder Tools for AI

Current docs:
https://developer.amazon.com/docs/adbt/home
https://developer.amazon.com/docs/adbt/get-started

ADBT provides an MCP server, agent skills and steering context. Current docs describe full Vega support and list Node.js 18+ plus Vega SDK 0.22+ for Vega workflows. They document Node 24 as a workaround for a Node 26 SQLite bindings issue.

Repository baseline is Node 24.

Current setup command:
npx -y @amazon-devices/amazon-devices-buildertools-mcp@latest init-context

## Vega/Appstore constraints

Current docs:
https://developer.amazon.com/docs/app-submission/submitting-apps-to-amazon-appstore.html
https://www.developer.amazon.com/docs/vega/0.22/app-submission
https://developer.amazon.com/docs/vega/0.24/target-os-version
https://www.developer.amazon.com/docs/vega/0.24/continuous-integration

A Vega submission uses a VPKG.

The Vega manifest must register:
com.amazon.category.main

Without it the app cannot launch from the Fire TV home launcher and fails submission.

For Vega SDK 0.24, Amazon requires an `[os.version]` manifest section: `target = "1.2"` and `min = "1.2"` for the documented Vega OS 1.2 target, with compatible dependencies. Earlier pinned template packages are not proof of SDK compatibility. Use `vega project doctor` and the build command of the *installed* SDK; validate the current FireLaunch wrapper's arguments against that toolchain.

Amazon's SDK 0.24 build-host guidance lists Ubuntu 20.04/22.04/24.04 x86_64 and macOS arm64/x86_64. The Linux Mint development host must not be presumed officially supported. The qualification environment must be explicitly identified and tested; a separately provisioned supported host or device may be necessary.

Capture the exact installed SDK/CLI identity, OS target, device/simulator identity, actual VPKG path/hash, and launcher/navigation/playback evidence. A browser preview, source output or mock does not replace that evidence.

Amazon also calls physical-device testing an essential pre-submission step. Hackathon qualification may use the simulator per challenge rules, but final production readiness should still flag physical-device testing until performed.

## Mini challenge opportunity

AWS Builder is optional.

FireLaunch P0 includes a real Amazon Bedrock runtime adapter so we can qualify if the final demo actually exercises/documents it.

Do not let the mini challenge jeopardize the primary Fire TV demo.

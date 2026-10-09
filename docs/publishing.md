# FireLaunch Publishing Model

## Goal

Publishing should feel like the continuation of building, not a separate consulting project.

FireLaunch P0 prepares a creator-owned Vega application for Amazon submission. It does not capture Amazon credentials or falsely claim that a Developer Console submission occurred.

## Current Amazon path

For Vega OS the current documented flow is through Amazon Developer Console:

1. Have an Amazon Developer account.
2. Build a release VPKG.
3. Ensure the manifest includes com.amazon.category.main.
4. Create a new app or upcoming version.
5. Upload the VPKG.
6. Select supported Amazon Fire TV / Vega devices.
7. Complete Appstore metadata, assets and support information.
8. Review and submit.
9. Amazon reviews/tests the submission.

Reference:
https://developer.amazon.com/docs/app-submission/submitting-apps-to-amazon-appstore.html
https://www.developer.amazon.com/docs/vega/0.22/app-submission

## P0 Publish surface

Publish computes readiness groups.

Build:
- generated project exists
- Vega manifest parses
- main category present
- release build actually succeeded against a verified installed Vega SDK/CLI and target-compatible manifest
- fresh, nonempty VPKG exists with exact artifact path, SHA-256, build log/exit status, source/spec revision and toolchain identity

Experience:
- ChannelSpec valid
- focus/navigation tests pass
- content/detail/playback fixture passes
- simulator/device evidence status (separately identified target, installed artifact and observed launch/D-pad/detail/playback/Back results; never inferred from Preview tests)

Store:
- app name
- short/long descriptions
- icon/artwork inventory
- screenshot inventory
- release notes

Compliance/setup:
- support contact placeholders
- privacy URL/status
- content/audience questions requiring creator answers
- third-party content rights acknowledgement

Human:
- Amazon Developer account
- Developer Console upload/target/details/review
- physical-device final test for production

## Submission bundle

Generate:
- readiness.json
- readiness.md
- store-copy.md/json
- screenshot references
- required-asset checklist
- build artifact reference/hash and provenance only if a real build succeeded
- separately recorded simulator/device proof only when directly observed
- exact missing SDK/device prerequisites for blocked states, plus remaining human steps

Never copy credentials into the bundle.

## Ownership

Each creator submits through their own Amazon Developer account and owns the app listing.

## Future automation

If Amazon exposes an official API that supports required Vega submission operations, add it behind a separate authenticated adapter and explicit final confirmation.

Do not implement browser automation that scrapes Developer Console as a substitute.

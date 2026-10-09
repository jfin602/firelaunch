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

## Launch-MVP publishing extension (planned P5–P8)

The preceding P0 local build/Console sequence remains historical. Production adds **distinct creator-owned app identities** and **remote published content** without changing ownership.

### Creator app ownership and independence

Each ChannelDeployment retains its own app/package identifier, release lineage, store copy/assets, verified artifact/hash, signed build metadata and manifest endpoint. The creator owns their Amazon Developer account, listing, source, content rights and final release decisions. FireLaunch must never silently combine creator channels inside one FireLaunch viewer app or request developer passwords/automate undocumented Console browser behavior.

### Publish data versus release a binary

| Change | Correct path |
| --- | --- |
| Approved TV-compatible titles, descriptions, collections, artwork/media URLs, remote layout options | New immutable PublishedManifest revision; installed Vega app fetches over HTTPS |
| Native code, installed permissions, dependency/runtime, package identity, incompatible schema or bundled native resources | New qualified VPKG, real TV test and any required Amazon Console submission/review |

A draft is not public. Publish snapshots rights-cleared, schema-valid state and updates a release pointer; the previous healthy manifest remains rollback-capable. The TV client validates the new schema and caches last-known-good content. A missing network connection must not blank the channel.

### Guided creator flow

1. Verify import rights, playable licensed media, quality, app identity, store/legal/support information.
2. Preview on TV semantics; explicitly review/approve manifest and publish remote content.
3. Generate a distinct Vega source project and creator-specific Appstore assets; preserve code overrides.
4. Produce truthful release VPKG/toolchain/hash evidence and physical TV navigation/playback results.
5. Guide creator through their own Developer Console; record actual submission/approval status separately.
6. Continue permitted sync/review, status, retries and rollback without resubmitting for compatible data updates.

Amazon product data access, media distribution and TV commerce are separate permissions: public ASIN/storefront identity is not a license; SP-API seller approval does not confer universal KDP/Audible rights; affiliate links/program content on television may be restricted. P1 and P7 must check current official policies for each use before treating a flow as publishable.

Relevant official references:
- https://developer.amazon.com/docs/app-submission/submitting-apps-to-amazon-appstore.html
- https://developer.amazon.com/sp-api/
- https://affiliate-program.amazon.com/

### Real launch gate

At least one creator-owned Appstore **approval**, verified physical Fire TV package/navigation/playback and installed-app remote catalog refresh; plus source export, tenant isolation, backup and support qualification. A submitted app or draft bundle alone does not satisfy launch Green.

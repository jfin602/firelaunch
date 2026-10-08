# FireLaunch Product Model

## Primary user

A creator, brand or small media organization that has video content and wants a branded TV destination without hiring a dedicated TV application team.

Developers are also users, but the default workflow must not require TV-platform expertise.

## Core nouns

### ChannelProject

The creator-owned FireLaunch workspace.

Contains:
- ChannelSpec
- content metadata
- project assets
- agent transcript/change history
- generated-project metadata
- build/readiness state

P0 uses local filesystem persistence. Cloud accounts/workspaces are deferred.

### ChannelSpec

Canonical structured definition for the normal channel experience.

Minimum shape:
- id, title, slug
- brand
- navigation
- pages
- content catalog
- playback defaults
- schemaVersion

Brand includes logo/art references, colors, typography intent and display options.

Navigation references pages by stable IDs.

Pages are composed from bounded TV modules such as hero, rail, grid and text/about.

Content items include stable ID, title, description, artwork, playable media URL and optional duration/category/series metadata.

P0 may add fields when required, but avoid a generic arbitrary JSON page builder.

### ChannelAgent

Provider-neutral orchestration boundary that turns creator language into validated structured operations.

P0 tools should cover:
- inspect current channel
- set brand
- add/update/remove page
- add/update/remove module
- add/update/remove content
- reorder navigation/module/content references
- apply a validated bounded patch
- request generation/readiness actions

Bedrock is the primary real provider integration. Mock mode produces deterministic tool calls for tests and offline demo fallback.

### TV Preview

Interactive 16:9 projection of ChannelSpec.

It must exercise the same semantic page/module/content rules as the generated channel and support directional focus, select/enter, back, virtual remote buttons, keyboard equivalents, visible focus, content detail and playback.

The preview is not allowed to be a static screenshot.

### GeneratedVegaProject

Self-contained source project produced from a checked-in template/runtime plus ChannelSpec.

It must be inspectable in the Code surface and usable independently from FireLaunch after export.

### BuildArtifact

Evidence-backed output of the Vega build path.

A record contains project/spec revision, command/toolchain identity, time, exit status, artifact path and artifact hash when practical.

No artifact record exists merely because generation succeeded.

### SubmissionBundle

FireLaunch-prepared Appstore materials:
- VPKG reference when actually built
- app/store copy
- app icon/artwork checklist
- screenshots
- support/privacy fields
- device target notes
- compliance/readiness checks
- unresolved human actions

P0 does not automate credentialed Developer Console submission.

## Golden path

1. New Channel.
2. Enter title and short intent, optionally add logo/content.
3. FireLaunch creates a valid starter ChannelSpec.
4. Agent produces/refines the first channel composition.
5. TV Preview becomes immediately navigable.
6. Creator asks for changes or uses Design/Content controls.
7. Creator can open Code and inspect/edit the generated project.
8. Generate/Validate updates source and readiness.
9. Build uses the locally installed Vega toolchain.
10. Publish presents a truthful readiness report and submission bundle.

## Studio information architecture

Use a focused creator shell with persistent project identity and these primary surfaces:
- Create / Agent
- Design
- Content
- Code
- Build
- Publish

The TV Preview remains visually central during creation/refinement.

Do not clone a general IDE.

## Demo fixture

Ship a rights-safe local/sample Wild Earth-style project with placeholder/generated imagery or repository-owned assets and a small set of playable demo media that is legally usable.

## Explicitly deferred

- login/accounts
- billing
- team collaboration
- hosted transcoding/CDN
- subscriptions/IAP
- advertising
- analytics
- multi-TV-platform export
- component marketplace
- automated Developer Console credentials/submission

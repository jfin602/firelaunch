# ADR 0004 — Independent creator-owned app identity

Status: Accepted
Date: 2026-10-09

## Decision

Each creator's FireLaunch channel is its own branded Fire TV application with its own ChannelDeployment, package identity, release artifacts and Amazon Developer Console listing. The creator owns the developer account, app/listing, content, assets, source and submission decisions. FireLaunch operates the creation and optional management service, not a multi-creator viewer app.

## Rationale

The customer's value is an independently owned TV destination extending an established creative brand. Consolidating everyone into a FireLaunch viewer app would reduce brand identity and portability.

## Consequences

- CreatorAccount owns projects, each project can be published as an independently identifiable channel app. No package ID reuse across creators.
- Exportable source and supported catalog exports must preserve creator portability.
- FireLaunch does not scrape Console logins or take custody of creator Developer Console passwords; build/submission is guided and explicitly creator-authorized.
- Native versioning and publisher-specific release evidence stay separate from remotely published content revisions.
- P7 qualifies independent creator submission; P8 launch requires at least one real creator-owned Appstore-approved example.
- Team workspaces and a shared FireLaunch viewer app are outside MVP.

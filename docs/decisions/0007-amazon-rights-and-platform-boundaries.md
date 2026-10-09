# ADR 0007 — Amazon integration permissions, media rights and TV commerce

Status: Accepted
Date: 2026-10-09

## Decision

Do not treat Amazon as a universal public creator catalog API. No unapproved import or redistribution of third-party program content, affiliate links or product data on television. An Amazon connection must have explicit provider authorization and the intended downstream TV use must be permitted. Rights to catalog metadata are not rights to underlying film, book, audiobook, song or media playback.

Viewer purchases, affiliate-driven TV commerce, viewer subscriptions/IAP and advertising remain out of launch MVP.

## Rationale

Seller Central SP-API, KDP/Author Central, Audible and affiliate programs have different access and use restrictions. Amazon app quality rules also require meaningful and non-repetitive TV experiences, not sparse storefront replicas.

## Consequences

- P1 maintains a provider-by-provider technical/legal permission matrix and starts any required registrations/approvals early.
- Creator-controlled feed/file ingestion is always the fallback; a public name, ASIN or storefront URL is only a discovery clue.
- Verified source ownership, authorized retrieval, TV display and playback license are separate checks.
- Creators must attach separately permitted media and substantive video/audio/writing-native TV functionality.
- P3/P6 ship Amazon integrations only after permitted scopes and downstream TV use are verified; denied access remains a truthful unavailable state.
- P7/P8 recheck policy at submission and require real creator-owned Appstore approval evidence.

Official starting references:
- https://developer.amazon.com/sp-api/
- https://developer.amazon.com/docs/app-submission/submitting-apps-to-amazon-appstore.html
- https://affiliate-program.amazon.com/

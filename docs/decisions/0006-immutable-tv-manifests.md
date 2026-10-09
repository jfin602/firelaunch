# ADR 0006 — Immutable published manifests and remote TV delivery

Status: Accepted
Date: 2026-10-09

## Decision

The installed Vega app uses a deployment-specific HTTPS resolver to load a versioned, TV-safe PublishedManifest. Publishing validates an approved ChannelSpec and catalog/media snapshot, saves an immutable manifest, and atomically advances a deployment release pointer. Draft edits are not live.

## Rationale

Creators need routine catalog changes without rebuilding/reposting apps. Immutable releases and cached last-known-good data allow reproducible rollouts, safe recovery and rollback.

## Consequences

- A creator-owned ChannelDeployment has an independent package identity and published manifest lineage.
- The client checks schema/runtime compatibility before activating a new manifest, preserves healthy cached revisions and handles disconnected TV operation gracefully.
- Publish excludes private tokens, unpublished content and unlicensed media.
- Compatible data/config updates deploy remotely; native code, permissions, package IDs or incompatible runtime updates require VPKG and any applicable Appstore review.
- Browser Preview parity does not substitute for physical Fire TV qualification; P5 proves live refresh and P8 proves robust launch behavior.

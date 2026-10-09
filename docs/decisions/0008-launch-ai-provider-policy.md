# ADR 0008 — Provider-neutral SaaS AI and phase-specific qualification

Status: Accepted
Date: 2026-10-09

## Decision

P1, P2 and P3 of the creator-owned SaaS roadmap may start without AWS access, Bedrock credentials, full historical P7 GREEN, physical Fire TV, or Appstore approval. Keep ChannelAgent provider-neutral and preserve deterministic mock tests. By P4 GREEN, qualify **at least one real non-mock provider**, not necessarily Bedrock, by using a representative imported creator catalog to produce bounded schema-valid mutations, persisted ChannelSpec and a usable TV Preview.

ADR 0003's Bedrock-first P0 demo decision remains historical and intact. The P0/P7 and 2026-10-09 c0 correction closeouts remain NOT GREEN; future SaaS live-provider success does not retroactively prove a Bedrock call.

## Rationale

The executed 3/5-cycle correction passed real Vega VPKG build and Vega VirtualDevice focus/detail/playback/Back on its tested candidate. Formal Mint host support, P0 Bedrock access, final Studio browser tests, Publish surface qualification, default Wild Earth loopback/artwork and aggregate checks remained blocked. None prevent securely designing creator accounts, contracts or ingestion.

## Phase-specific gates

| Phase | Required evidence |
| --- | --- |
| P1–P3 | Approved contracts, creator isolation/hosting, authorized creator feed/file import; no cloud AI or TV hardware dependency |
| P4 | Live supported provider, actual catalog grounding, validated ChannelAgent tools, persistent ChannelSpec changes, usable Studio Preview; mock-only is insufficient |
| P5 | Same real installed VPKG receives approved compatible remote revisions with safe refresh/fallback on a Vega target |
| P6 | Real permitted source changes reach that installed app without rebuild, honoring creator overrides and errors |
| P7 (SaaS) | Real Publish readiness and independent creator-owned Amazon Console submission/handoff |
| P8 | Supported production build host, physical Fire TV, meaningful licensed content, aggregate/browser/security/operations qualification and real creator-owned Appstore approval |

## Consequences

- Model/provider transport, credentials and selection stay behind adapters. ChannelSpec, validated mutation boundaries, user ownership and TV semantics do not change with provider choice.
- No private provider tokens or source credentials in public manifests, exported generated projects or logs.
- Paid network calls are separated from reproducible deterministic test suites and must be demonstrated directly for P4 GREEN.
- Full historical P7 GREEN is not a prerequisite for starting SaaS; all unresolved platform and publication gates stay explicitly tracked in [the correction closeout](../tasks/c0-real-tv-qualification/qualification-loop/qualification-closeout.md).

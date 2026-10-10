# Phase 3 Prompt Assessment

Date: 2026-10-10
Status: scope approved; prompt authoring underway
Activation root version: 0.3.0

## Source findings

P1 catalog contracts already define CatalogSource, CatalogItem, MediaAsset, Collection, inventory/provenance and rights. The hosted server has PostgreSQL-backed account/project ownership, protected private objects and session-aware API routes. Studio currently edits playable ChannelSpec content, distinct from catalog inventory. The P2/c2 closeouts remain NOT GREEN.

## Sequencing decision

Seven bounded implementation checkpoints (0.3.1 through 0.3.7), plus one independent manual browser closeout (0.3.8). The runner cannot run an implementation prompt marked browser-required. Thus the first real two-profile account-isolation test is a mandatory **manual preflight before running the stack**. P1, non-browser in runner metadata, must independently inspect evidence and refuse to pass without two real simultaneous Google sessions and owner isolation. No new catalog endpoint may be deployed until that gate passes.

P2 adds catalog SQL and owner-scoped APIs; P3 file import/preview; P4 one-shot HTTPS feeds; P5 private media and rights; P6 progressive Studio onboarding; P7 integrated regressions; P8 independent qualification.

## Risks and boundaries

Respect tenant ownership before any catalog lookup, safe bounds on CSV/JSON/HTTPS import, duplicate and creator override preservation, media display/playback rights, private storage and no public release of unapproved items. Feed acquisition must prevent unsafe internal network access and excessive resource consumption. No automatic source polling until Phase 6. No catalog-to-TV AI generation until Phase 4; no immutable live TV manifests until Phase 5; no unapproved Amazon source access. Preserve ChannelSpec and existing TV behavior.

Phase 3 may qualify its local catalog functionality while HTTPS staging authentication and private storage recovery remain explicit preproduction gates. P2/c2 historical dispositions stay NOT GREEN. Focused checks within prompts; one aggregate check in final closeout.

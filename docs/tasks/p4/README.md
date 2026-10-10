# p4 — Catalog-Driven Channel Generation

Status: PROMPT STACK AUTHORED / NOT EXECUTED
Phase: 4 (post-P0 launch-MVP roadmap, distinct from historical P0 P4)
Date: 2026-10-10
Activation root: `0.4.0` after bounded Phase 3 closeout at `0.3.8`
Target: `0.4.1` through `0.4.8`
Models: GPT-6 Sol High for contracts, ownership, projection and agent integration; Medium for narrow composition/Studio slices

## Goal

Turn the approved, creator-owned Phase 3 catalog into three substantively different, navigable television drafts: video, audio and writing. Preserve ChannelSpec as presentation truth and catalog as source/rights truth. Provide safe catalog-aware non-mock ChannelAgent editing with persisted validated mutations, protected creator edits, and usable browser Preview. Never claim public TV media delivery, hosted production readiness or Amazon authorization.

## Qualification inherited from Phase 3

Phase 3 P8 closed **CATALOG GREEN for the tested local workflow / HOSTED RELEASE NOT QUALIFIED**. See [evidence](../p3/closeout.md). Original P2 P7 and c2 remain NOT GREEN. Simultaneous two-profile identity, complete owner/foreign live API and session matrix, HTTPS Google callback/secure cookies, and independent HTTPS S3 restore are unqualified preproduction release gates (S1–S6 partial/open); do not quietly close or conflate them with P4 catalog-generation GREEN.

## Prompt Stack

| Prompt | Owner | Target | Browser required |
| --- | --- | --- | --- |
| P1 | Non-playable/audio ChannelSpec and shared TV semantics parity | 0.4.1 | no |
| P2 | Owner-scoped catalog projection, eligibility and stable bindings | 0.4.2 | no |
| P3 | Deterministic video/audio/writing draft compositions | 0.4.3 | no |
| P4 | Provider-neutral real AI adapter and catalog-grounded ChannelAgent | 0.4.4 | no |
| P5 | Progressive Studio Generate/Refine and creator-edit preservation | 0.4.5 | no |
| P6 | Hosted API integration, security and regression protection | 0.4.6 | no |
| P7 | Three-creator convergence, repair and qualification fixtures | 0.4.7 | no |
| P8 | Independent live-provider/browser qualification closeout | 0.4.8 | yes |

P1–P7 are implementation prompts with runner-owned commits and focused checks. P8 is manual: the runner stops and hands off to an independent browser-enabled session. Only P8 owns one final aggregate check and final Green / Not Green determination. Lack of a live AI key in implementation is not evidence of a defect; P8 cannot be GREEN without an actual successful non-mock provider request.

## Source-aware boundaries

- `packages/contracts/src/index.ts` currently requires `content.mediaUrl`, and `packages/tv/src/runtime.ts` currently always transitions from detail to playback. Add explicit non-playable and audio behavior while preserving P0 fixtures, focus and generated Vega semantic parity. Avoid inventing licensed book playback URLs.
- `packages/contracts/src/catalog.ts` provides CatalogItem (video, audio, book, listing), MediaAsset separate display/playback rights, Collections and provenance, but no implicit TV license merely from an imported record. Imported/reviewed inventory is a draft; independent eligibility checks are mandatory.
- `apps/server/src/catalog-repository.ts` and `apps/server/src/api.ts` already enforce authenticated owner-scoped catalog access and revision semantics. Add narrow owner-derived projection and generation operations, never trust owner IDs or catalog data supplied by the browser.
- `packages/agent/src/index.ts` currently has mock/Bedrock-only provider status and `inspect_channel`; `apps/studio/src/AgentPanel.tsx` is a prompt-first channel editor. Extend through provider adapters and bounded read-only catalog grounding; validated mutation tools must remain the only write path.
- `apps/studio/src/Catalog.tsx`, `apps/studio/src/Preview.tsx`, generator/Vega source and `ChannelSpec` must describe consistent draft behavior. Generated code and exports must not include private S3 identifiers, secrets or ephemeral signed-media capabilities.
- Existing native/Vega builds remain disabled in hosted mode without isolation proof. P5 owns immutable published manifests and device-deliverable asset URLs, not P4.

## Product and security acceptance

1. Three authorized, synthetic but credible curated catalogs (film, album/audio, author/books) generate distinct browsable TV drafts. Books without playable media offer detail and Back only; audio uses appropriate playback semantics; films can play cleared examples.
2. A client cannot induce unreviewed, foreign, private, revoked, or rights-unknown content to become publicly deliverable. Draft Preview uses authenticated capabilities only; absent rights produce honest placeholders/readiness warnings.
3. Repeated generation is deterministic/idempotent for unchanged inputs and respects stable IDs, manual brand/order/content edits and source field overrides. Conflicts fail visibly, not destructively.
4. A real non-mock provider is actually called with bounded, authorized catalog context; its structured tools are validated, persisted, and observable in Preview. Tests stay offline except explicitly opt-in qualification.
5. Interactive browser focus/Select/Back/appropriate playback and saved edits survive reload and server restart. No production launch claims.
6. P2/c2 and P3 inherited S1–S6 gates remain OPEN/PARTIAL until separately directly evidenced.

## Execution

From a clean, pulled root `0.4.0` checkout:

```bash
cd /home/jfin/dev/firelaunch
git pull --ff-only
npm run codex:stack:validate -- p4
npm run codex:stack -- p4
```

The runner owns P1–P7 commits; no implementation agent creates commits or rewrites HEAD. P8 requires manual browser-enabled execution. See [assessment](prompt-assessment.md) and [implementation plan](implementation-plan.md).

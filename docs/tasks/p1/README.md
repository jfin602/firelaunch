# p1 — Creator-owned catalog contracts and Amazon feasibility

Status: READY TO RUN / NOT EXECUTED
Phase: 1 (post-P0 SaaS roadmap)
Baseline: root 0.1.0; historical P0 version 0.0.7 remains preserved
Model: GPT-6 Sol High

## Goal

Deliver strict versioned contracts for independent creator-owned Fire TV applications, imported catalogs, licensed media, safe synchronization and published manifests. Document Amazon integration feasibility and a catalog-first onboarding journey. Establish a clear P2 handoff.

P1 does not implement authentication, persistence, OAuth, Amazon API calls, catalog import, media playback, sync workers or app publishing. P1 can begin without AWS, Bedrock, historical P7 GREEN or physical Fire TV. Historical P7 and c0 remain BLOCKED / NOT GREEN.

## Prompt Stack

| Prompt | Focus | Version | Browser |
| --- | --- | --- | --- |
| P1 | Creator ownership and independent app contracts | 0.1.1 | no |
| P2 | Catalog, media, provenance and rights contracts | 0.1.2 | no |
| P3 | Sync policy and published-manifest contracts | 0.1.3 | no |
| P4 | Source-backed Amazon feasibility and onboarding | 0.1.4 | no |
| P5 | Independent phase qualification closeout | 0.1.5 | no |

P1-P4 are implementation prompts. P5 is the only closeout prompt, and must be reviewed independently. Runner owns implementation commits.

## Runner baseline and activation

The phase runner requires clean committed root version 0.1.0 before P1. This phase's planning/activation commit changes root package.json and the root version fields in package-lock.json from 0.0.7 to 0.1.0. Internal workspace versions are left untouched. Subsequent P1-P4 prompts advance only root package and lock metadata to their assigned patch versions.

From the committed checkout:

```bash
npm run codex:stack:validate -- p1
npm run codex:stack -- p1
```

Runner stops before closeout by default. The non-browser closeout may be run separately with --closeout, with human review. Do not manually commit from runner-owned prompts.

## GREEN gate

P1 GREEN requires tested, backward-compatible contracts; creator-owned deployment identity distinct from catalog sources and ChannelSpec; rights/provenance and review-by-default sync rules; a TV-safe publication envelope; a dated matrix of Amazon technical support versus actual authorization/rights; a realistic video/audio/writing onboarding workflow with creator-controlled import fallback; and one aggregate check in closeout.

Amazon access or Appstore approval is NOT claimed, and missing external authorization alone does not fail contract-only P1. Failed contract tests or materially misleading policies mean NOT GREEN and a bounded correction.

See prompt-assessment.md and implementation-plan.md.

# c5-vega — Phase 5 Vega build and live delivery qualification

Status: P1/P2 COMPLETED / P3 INDEPENDENT CLOSEOUT NOT GREEN / LIVE GATES OWNER-DEFERRED TO P6 INTEGRATION
Phase being corrected: historical post-P0 Phase 5 Live Channel Delivery (0.5.x), closeout NOT GREEN
Current correction baseline: `0.6.0`, **UNCHANGED** in all prompts; correction does not consume Phase 6 versions
P5 closeout: [P5 / P8](../p5/closeout.md)
Plan: [implementation-plan.md](implementation-plan.md) · [assessment](prompt-assessment.md)
Decision authority: [ADR 0009](../../decisions/0009-live-channel-delivery.md); future media is [ADR 0010](../../decisions/0010-aws-media-delivery.md)

## Purpose and entry

The original P5 P1-P7 checkpoints are now present on GitHub main (merged through source integration after local Phase 5 runner work), with owner/publication API, immutable release storage/resolver, generated Vega remote client and Studio publishing UI. Its independent P8 closeout remains **NOT GREEN**: the creator-bound Vega build failed because the installed SDK rejected an AsyncStorage alias and Metro/Babel failed parsing Zod; no installed VPKG and no owner-approved HTTPS v1/v2/v3 sequence existed. The passed automated root check (228 passed, 1 pre-existing opt-in skip) is NOT on-device proof.

Scope is **only** reproducible native build repair, bounded rights-safe HTTPS qualification readiness, and an independent same-installed-VPKG device proof. Do not redo P5 implementation, rewrite the historical closeout, change ChannelSpec/PublishedManifest guarantees, or build new AWS media infrastructure. A licensed short HTTPS fixture or informational rights-cleared content suffices for the P5 manifest-update test; P6 is responsible for FFmpeg/S3/CloudFront and live HLS.

## Prompt Stack

| Prompt | Responsibility | Model | Browser | Root version |
| --- | --- | --- | --- | --- |
| P1 | Reconcile Vega SDK AsyncStorage and Metro/Zod bundling; build actual creator-bound VPKG | GPT-6 Sol High | no | 0.6.0 unchanged |
| P2 | Rehearse creator-owned release and controlled public-only HTTPS staging; produce manual proof runbook | GPT-6 Sol High | no | 0.6.0 unchanged |
| P3 | Independent REAL installed-VPKG v1/v2/rollback/offline qualification and correction closeout | GPT-6 Sol High | **yes, MANUAL** | 0.6.0 unchanged |

P1/P2 are the only automated implementation checkpoints and runner owns their commits. P3 is separate, manual and browser/device-required; it writes `docs/tasks/c5-vega/closeout.md` and one final aggregate check. No prompt increments root or internal workspace versions. Target <=8 minutes per implementation prompt; maximum 15 minutes with bounded retries. If SDK/HTTPS/browser access requires user intervention, stop with the exact blocker; never modify password-based SSH authentication or Ngest.

## Qualification boundary

To declare **c5-vega GREEN**: P1 proves a fresh installable creator-bound VPKG from the current, compatible SDK/CLI and reports path, file size/hash/toolchain. P2 demonstrates or explicitly prepares a real creator-owned rights-reviewed v1 release and safe HTTPS public-only resolver, with the private Studio/API/database outside that public vhost; if unavailable, P3 must report NOT GREEN. P3 directly installs **ONE VPKG ONCE** on the actual Vega VirtualDevice, observes v1 navigation/focus/detail/Back; approves visibly distinct v2 and observes that SAME package refreshing over HTTPS without reinstall; cold-restarts offline with verified LKG; rejects corrupt/incompatible/network-failed releases without blanking; publishes authorized rollback as **new, higher-sequence v3** with current rights rechecked; and records device URL/hash/log evidence, negative access tests and one final npm 12 aggregate.

Historical P5 closeout remains NOT GREEN regardless of a newer correction. c5-vega GREEN would separately qualify the repaired P5 delivery behavior on the **Vega VirtualDevice**, not physical Fire TV, Amazon Appstore, live Bedrock, hosted S1-S6 release security, Roku/Fire OS, or Phase 6 video delivery. User-controlled `firelaunch.jfin.dev` authenticates the Studio; that **does not automatically mean the required separate public-only TV endpoint is qualified**. Follow [P5 public HTTPS staging boundary](../p5/public-https-staging.md).

## Non-goals

No full AWS media pipeline, production multi-tenant rollout, automatic storefront scraping, IAP/DRM, licensing invention, unisolated native builds on the VPS, new app permissions, arbitrary remote executable code, or rewriting failed historical status. Physical Fire TV and Appstore qualification remain P9.

## Execution (only after docs integrated into owner's checkout)

```bash
cd ~/dev/firelaunch
git status --short
node --version
npm --version
npm run codex:stack:validate -- c5-vega
npm run codex:stack -- c5-vega
```

Do not run P3 via the normal implementation runner; stop for independent browser/VirtualDevice closeout. Before running P6 (0.6.1 onward), inspect the actual correction outcome; if NOT GREEN, explicitly retain/fix the missing native qualification before claiming an end-to-end video product.

## Post-P3 owner decision (2026-10-12)

The original [c5 independent closeout](closeout.md) remains **NOT GREEN**. The synthetic creator-bound fixture VPKG was built and hash-verified, but not installed with a real approved creator deployment. Owner explicitly defers the remaining creator-rights/isolated HTTPS/public release and same-installed-VPKG v1→v2/offline/fault/v3 rollback tests until Phase 6 integration. These proofs are deferred, NOT waived or passed. P6 P1–P7 may start at existing `0.6.0` now; no physical Fire TV or Appstore claim follows. Keep historic P5/c5 outcomes and security protections unchanged.

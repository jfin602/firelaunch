# p5 — Live Channel Delivery

Status: PLANNED / PROMPT STACK AUTHORED / NOT EXECUTED
Phase: 5 (launch-MVP, not historical P0 P5)
Date: 2026-10-11
Entry: committed `c4-fix` local GREEN at root `0.4.8`, commit `00e3df5784ec94dd845af21e07c9cb75ba8b6f31`; P4 historical NOT GREEN
Activation root: `0.5.0`; implementation P1–P7 `0.5.1`–`0.5.7`, P8 manual closeout `0.5.8`
Target: Vega VirtualDevice OS 1.2 / installed real VPKG. Physical Fire TV deferred to P8 launch qualification.
Models: Sol High for contracts, storage, auth, public delivery, native runtime and independent closeout; Medium for bounded Studio UI.

## Goal

Ship creator-approved ChannelSpec/catalog presentation changes to an already-installed, separately creator-owned Vega television application **without rebuilding or reinstalling the VPKG**. Persist immutable, rights-checked releases and an atomic live pointer; serve a strictly public-safe manifest through an approved HTTPS resolver; let the native client validate, refresh, cache last-known-good and recover safely. Preserve draft/live separation and explicit creator authorization. Native code/dependency/package/permission/schema-breaking changes still require a new qualified VPKG.

## Reality and entry gates

The c4-fix correction is LOCAL GREEN, with 7/7 typechecks/builds, 97 kernel + 18 Studio + 104 runner passes, one disclosed opt-in skip. Its local closeout is at [c4-fix/closeout.md](../c4-fix/closeout.md). **Original P4 remains NOT GREEN** until live non-mock catalog-grounded SAVED mutation + Preview and further P4 external product proof. Hosted S1–S6 HTTPS/identity/isolated-S3 release gates remain OPEN/PARTIAL; those do not silently become PASS in this stack. No AWS Bedrock account activation or production VPS is needed to begin P5 implementation.

Already present: strict `PublishedManifest` projection contract (`packages/contracts/src/publication.ts`), `ChannelDeployment` shape and owned storage, `ChannelSpec`/TV semantics, generated Vega template, local Studio and runner. P5 must implement the actual release storage/resolver/native remote consumption; no such live publication route or native remote loader was found in the P5 review. An **existing contract mismatch** forces playable media bindings even for P4 informational books; P1 must repair that without allowing rights bypass or fake playback.

## Prompt Stack

| Prompt | Responsibility | Version | Model | Browser |
| --- | --- | --- | --- | --- |
| P1 | Publication contract parity, no-play books, compatible safe manifest | 0.5.1 | GPT-6 Sol High | no |
| P2 | PostgreSQL approval snapshots, immutable releases, atomic live pointer | 0.5.2 | GPT-6 Sol High | no |
| P3 | Owner-only approve/publish/history/rollback API and negative auth | 0.5.3 | GPT-6 Sol High | no |
| P4 | Public HTTPS deployment resolver, immutable release delivery | 0.5.4 | GPT-6 Sol High | no |
| P5 | Generated Vega client remote loader, persisted LKG, refresh/fallback | 0.5.5 | GPT-6 Sol High | no |
| P6 | Minimal Studio draft/live publish controls and status/history | 0.5.6 | GPT-6 Sol Medium | no |
| P7 | Cross-layer regression/fixture integration and device runbook | 0.5.7 | GPT-6 Sol High | no |
| P8 | Independent same-installed-VPKG VirtualDevice/HTTPS qualification | 0.5.8 | GPT-6 Sol High | **yes, MANUAL** |

P1–P7 get focused tests and runner-owned commits. P8 alone owns one final npm 12 `npm run check`, real browser/on-device evidence, manual `closeout.md`, and root version advance to `0.5.8`. Do not fabricate installed target or HTTPS reachability; if either is absent, close P5 NOT GREEN with precise blockers, not a local fixture substituted for device proof.

## Locked decisions / safety

See [ADR 0009](../../decisions/0009-live-channel-delivery.md). ChannelSpec remains canonical for presentation, CatalogItem/MediaAsset for rights and provenance. Approval must bind owner, project, deployment, current catalog+channel revisions and checked asset rights. Release bytes are immutable, pointer CAS is transactional, rollback is a NEW monotonic release based on previously approved content rechecked against current rights. The public read API never accepts creator session/auth as a prerequisite and contains no private records, secrets, capabilities or executable content. Failed/partial fetch, unknown schema, mismatched deployment, unsafe media or corrupted hash must not blank the installed app. URL/manifest and cache processing must be bounded, fail-closed and native code unchanged by network data. Keep hosted native builds disabled until isolation is independently qualified.

For development qualification, use a **controlled, device-reachable HTTPS staging endpoint** exposing only public sanitized resolver routes; it can be a tightly scoped local reverse-proxy/tunnel on an approved hostname. Never expose the unsecured local-legacy API, owner write endpoints, database or S3 admin ports to the internet. No full production VPS/production OAuth is required just to test TV fetches. Media/artwork tests use creator-controlled rights-cleared, device-reachable HTTPS assets or a deliberately text-only authorized presentation; example domains/loopback are not playable proof.

## P5 GREEN = installed-device proof (VirtualDevice accepted)

Build a fresh real VPKG on the qualified SDK/CLI, record path/hash/toolchain and exact target. Install it **once** on Vega VirtualDevice and record its package identity. Publish at least two distinguishable compatible revisions for that SAME deployment and observe the installed app fetch/activate the second without reinstall/build. Verify D-pad focus, detail/Back, offline cold restart with persistent LKG, corrupt/incompatible manifest denial, timeout/connection failure fallback, and authorized rollback to a NEW release sequence observed on the same package. Capture manifest IDs/digests, HTTPS URL class (redacted if private), release pointer transactions, target logs/screenshots and one final aggregate/validator/diff check. Physical Fire TV is **not a P5 requirement**: target-specific hardware behavior remains unqualified until P8. A simulator result must never be presented as physical hardware or Appstore acceptance.

## Out of scope

P6 automatic catalog polling/diffs, P7 human Amazon Developer Console submission/billing, P8 physical Fire TV/actual Appstore approval, bulk media hosting/transcoding, other TV platforms, arbitrary executed remote code, production hosting S1–S6 closure, mandatory live AI/Bedrock, unauthorized Amazon content or unsafe cross-tenant native builds. A rollout of the production SaaS may be staged later; P5 must prove the isolated HTTPS public delivery path needed by the VirtualDevice.

## Execution / versioning

From a locally reconciled clean committed `0.5.0` activation checkout:

```bash
cd /home/jfin/dev/firelaunch
git status --short
npm run codex:stack:validate -- p5
npm run codex:stack -- p5
```

Node 24.15+ and npm 12.x. Validate that owner local closeout `00e3df5` is an ancestor before pulling; preserve any uncommitted owner work. Agents never commit/move HEAD; runner checkpoint commits. Final manual closeout does not self-commit or rewrite HEAD. Read [assessment](prompt-assessment.md) and [implementation plan](implementation-plan.md).

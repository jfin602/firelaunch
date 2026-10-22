# P9-004 — One-time media rights confirmation; remove repeated rights blockers

**Phase:** 9 — MVP Polish  
**Priority:** P1 / deadline-required UX (escalate to P0 if confirmed to block inclusion/export of otherwise eligible ready media)  
**Status:** Reported; implementation not started  
**Reported:** 2026-10-22 12:39 UTC  
**Surfaces:** Entire Creator Studio media workflow, especially **Library > Select Item / Manage Collections / 06 Generate Channel Draft**; uploaded-media cards; video details/wizard; channel readiness/inclusion and Preview/Export messaging  
**Evidence:** Owner-provided screenshot from the 2026-10-22 Phase 9 collection conversation. It shows Library cards displaying separate status strings such as **"Video rights: display cleared · playback cleared"**, readiness notices, a list of six selected media/collection entries under **"06 / Generate Channel Draft"**, and a red warning **"2 selected audio/video item(s) lack eligible playback media or rights. They will be excluded."** The screenshot remains in the conversation, not committed as a binary asset.

## Owner report / problem

> "confusing rights blockers. We dont need this heavy of rights confirming everywhere. not only on this page. it needs to just be one button during the media flow and you never think about it again"

The current UI repeatedly exposes the complexity of display rights, playback rights, delivery approval, channel readiness, selection, and live publishing. A nontechnical creator sees legal/technical status text almost everywhere, even after already declaring the required rights. Combined warnings obscure whether media is awaiting processing, truly missing a playable asset, or missing a rights confirmation, making ordinary draft/channel creation feel blocked.

This is a **cross-cutting problem**, not a single-screen text fix. Repeated creator confirmation and noisy rights state should disappear from everyday Library, video-card, channel draft, and preview flows after the initial attestation.

## Target user journey

1. Creator enters an **Add Media / upload** workflow for a new asset.
2. The creator sees **one short, understandable, affirmative rights confirmation control** before submission/finishing the media flow, covering the creator's permission to display and play/distribute that media in their FireLaunch channel as needed for the MVP. Example intent: **"I confirm I own or have permission to use and play this media in my channel."** (Final copy must match product's actual legal/rights scope; avoid false claims of granting rights.)
3. The creator confirms once; the app saves the confirmation alongside the owned media asset.
4. For that **unchanged, valid asset and use**, ordinary actions (edit metadata, organize Library, add/remove from channel, preview, generate draft, export) **reuse the stored confirmation** without requiring the creator to confirm again.
5. The UI presents simple statuses centered on the creator's job: **Uploading / Processing / Ready / Needs attention**, and **Private / In Channel**, rather than repeated legal jargon.

### Specific cleanup

- Audit **every screen** where rights confirmation, playback rights, display rights, delivery approval, or eligibility appears; reduce repetitive notices, redundant toggle/buttons, and repeated gates to the single attestation in the media-add/edit path.
- On Library cards, replace stacked implementation/legal status lines such as **"Video rights: display cleared · playback cleared"** with concise task-relevant state. Do not show an always-on reminder of a valid attestation.
- On **"06 / Generate Channel Draft"**, remove generic red warnings blaming "playback media or rights" when rights were already acknowledged. Distinguish genuinely **unprocessed/unplayable media** from **rights not yet confirmed**, and identify affected items with actionable guidance if a real blocker exists; do not repeatedly ask for attestation as a generic fix.
- Apply the same principle to Video workspace/Publish, collections, channel editor/preview and export readiness UI. Avoid reintroducing the old live-channel review or live deployment gates deferred by Phase 9 scope.
- New creator-facing error copy should be specific and exceptional; success states should remain visually quiet. Preserve any necessary concise policy/legal notices within the initial confirmation.

## Integrity and safety boundaries

**Simplify the UX, not the actual protections.** A single confirmation should be durable and reused; it does **not** automatically make an upload playable, prove license ownership, or override backend security/rights restrictions.

- Store an asset-scoped attestation with creator/account identity, timestamp, attestation version/scope and the relevant asset identity. Reuse current persisted rights model where possible; **do not require repetitive schema or consent records unless actually needed**.
- One confirmation may cover display and playback rights together when product/legal scope allows. Never silently expand an earlier narrow/display-only grant into additional rights or public distribution.
- If the media file is **replaced**, the permitted use materially changes, a rights grant **expires/is revoked**, or the earlier record lacks required scope, a targeted exception may ask for renewed attestation. These must be exceptional, not the normal path.
- Preserve server-side permission, ownership, media processing/READY checks, playback eligibility, revocation and export restrictions. Never bypass an actual ineligible state to satisfy the UX goal.
- Do not leak private files or alter the protected existing public release. No automatic production/Amazon live publishing or expansion of approved audience is authorized.
- Handle **preexisting Library assets** carefully: identify recorded valid creator attestation and reuse it; do not automatically mark unknown rights as cleared, and do not retroactively require users with valid coverage to re-attest.

## Acceptance criteria

1. New asset flow has **one clear rights confirmation** for ordinary video media (and for any other genuinely supported media types), with concise understandable copy and a persistent record.
2. After successful confirmation, the creator edits metadata, revisits Library, organizes collections, includes/removes the eligible asset from a channel, previews and exports **without a second ordinary rights confirmation**.
3. An existing asset with a valid stored attestation is recognized without being challenged again on every screen.
4. Rights-cleared cards no longer show repeated "display cleared / playback cleared" strings or irrelevant delivery-approval chatter.
5. The channel-draft generation screen no longer displays a generic multi-item **"playback media or rights"** blocker without identifying the real cause. Unprocessed assets and actual rights exceptions remain accurately excluded, with understandable next steps.
6. A truly unready/unplayable, unauthorized or revoked asset cannot be falsely published/played/exported; a targeted **Needs attention** state explains why without treating it as a broad legal reapproval.
7. Test refreshed session, ownership separation, existing uploads, a replaced asset, revoked/expired grant if supported, and an asset whose upload succeeded but media processing did not.
8. Ensure no regression of P9-002's one-click channel inclusion/Remove behavior or the protected hosted release.

## Dependencies and intended implementation batch

- Strongly related to **P9-002**, which defines private video pool and one-click channel inclusion. Implement together where efficient so a ready, properly attested asset can be included without repeated "rights" blocks.
- Interacts with Phase 8 P8C P1 media/artwork status clarity; inspect actual final P8C implementation before editing so work isn't duplicated.
- P9-003's **Add Media** entry point should inherit this one-time confirmation behavior.
- Clarify that **media readiness and rights confirmation are distinct**: one user action for attestation, automatic persisted reuse thereafter; media encoding/playback readiness remains a real technical prerequisite.
- Documentation only, **no code change, no deployment, no qualification** as of issue capture.

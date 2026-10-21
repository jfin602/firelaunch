# P8 — Creative Studio UX & Pipeline Confirmation

**Owner approval: 2026-10-20 23:55 America/Chicago (2026-10-21 UTC). Status: PLAN/PROMPTS AUTHORED; NOT IMPLEMENTED / NOT QUALIFIED.** Phase 8 is the next 0.8.x band; the checked-in root and root lockfile remain 0.7.3 until an explicitly approved, coherent Phase 8 entry transition. Owner delivery: Friday October 23, 2026 12:00 PM America/Chicago; internal handoff 11:30 AM; freeze target Thursday 5:00 PM CDT.

## Current C7 dependency (October 21)

The owner-approved five-checkpoint Phase 8 Creative Studio UX plan below is preserved unchanged. [C7 closeout](../c7-export-recovery/closeout.md) confirms working native creator export/ZIP and install/branding/artwork/Back/restart, but native HLS first-segment playback remains NOT GREEN. P8 should reuse R1–R3 evidence without repeated worker, ZIP or paid media qualification; R4 recovery remains the narrow native-video blocker.

## Goal and ordered scope
Make Studio feel like a coherent creator tool before final creative-pipeline confirmation. Preserve Desert Heat, ChannelSpec/TV semantics, the existing creator-owned video pipeline, rights and explicit publication, and Phase 7's real isolated export worker/ZIP/Vega device path. This is **not** a greenfield editor or pipeline rewrite.

Canonical left navigation (**five**): **Home**, **Library**, **Channel**, **Publish**, **Export**.
- Home: channel/project overview and real quick actions.
- Library: former Catalog (owned/imported video, artwork, sources, metadata, collections and rights).
- Channel: former Create/Agent, Design and Content unified behind **AI Assistant**, **Appearance**, **Pages & Shelves** subviews. Use the existing ChannelAgent and ChannelSpec; do not build a second agent.
- Publish: creator-reviewed immutable **live content** and release history, distinct from native package generation.
- Export: native Vega **Build & Download**, verified job/status and ZIP; **Advanced > Source** preserves the actual creator-owned code editor and changed-source protections. A submission handoff may remain here if needed, without implying Amazon submission.
- **TV Preview**: prominent, accessible toolbar action and discoverable editing companion, not another confusing primary destination.

**Desktop right inspector is contextual-only.** It opens for an actual selected page/shelf/media tile/appearance property or other relevant editing selection and closes on deselection/dismissal; no empty or permanently reserved 340–430px rail. Library, Publish, Export and Add Video use appropriately sized full workspaces or the existing accessible modal/sheet. Keep truthful async status and keyboard/mobile layouts. Never hide a required form behind a disabled/decorative button.

## Prompt Stack

| Checkpoint | File | Scope | Planned version |
| --- | --- | --- | --- |
| P1 | [Navigation cleanup](P1-navigation-cleanup.txt) | Five destinations, legacy route mapping, functional menu actions, dead/duplicate UI audit | 0.8.1 |
| P2 | [Contextual workspace](P2-contextual-workspace.txt) | Selection-based inspector and wide page layouts, TV Preview, responsive accessibility | 0.8.2 |
| P3 | [Creative pipeline consistency](P3-creative-pipeline-consistency.txt) | Save/reopen, video metadata, artwork, rights, private preview and shelves | 0.8.3 |
| P4 | [Publication/export consistency](P4-publication-export-consistency.txt) | Honest Publish vs Export, approved manifest/artwork/HLS vs real creator-bound package | 0.8.4 |
| P5 | [Independent creator UX closeout](P5-creator-ux-closeout.txt) | MANUAL real-browser walkthrough, focused final checks and truthful disposition | 0.8.5 proposed closeout |

Read [prompt assessment](prompt-assessment.md), [implementation plan](implementation-plan.md), [current state](../../CURRENT-STATE.md) and the latest [c7 export recovery](../c7-export-recovery/README.md). Implementation prompts P1–P4 target GPT-6 Sol Medium except risky integration P4 Sol High, each usually <=8 minutes with a 15-minute stop. P5 is a separately invoked manual/browser closeout (Sol High), not automatically started by the runner. No /activate step. Exactly one final closeout prompt; write closeout.md only after running P5.

## Phase handoff and safety
C7 R1–R3 native export progress is recorded GREEN/SCOPED GREEN at its last independent closeout (isolated worker, owner ZIP, exact VPKG install/branding/artwork/Back/restart); **R4 first-fragment HLS moving video/audio/pause/seek remains NOT GREEN** and technically highest priority. **Do not start implementation from docs alone while the local checkout/ongoing manual P7 source edits conflict.** Confirm exact local git status, root/lock 0.7.3, owner/host state and coherent version-only 0.8.0 transition before beginning P1; no docs-only version bump. P8 P1/P2 can follow a safe source handoff; P4 consumes Phase 7 results when available, reports the exact unqualified external dependency if absent, and never fakes device proof. Do not block safe UI work solely because old unrelated historical gates were NOT GREEN.

Reuse Phase 6 private video/thumbnail HLS evidence and approved FREE release #1 only if still valid. Do not rerun metered MediaConvert work or old broad Q2/Q3 matrices, provision infrastructure, publish creator content, relax owner/CSRF/rights checks, touch AWS/CDN/IAM, overwrite edited source, break backup/rollback, or claim a device/Appstore pass from Preview. No catalog auto polling/sync, optional subtitle feature, paid entitlement, or broad cosmetic redesign. Preserve c7 root 0.7.3/source and app schema 14 until separate entry authority, and never relabel historical P7/Q2/P5/c5 dispositions.
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

## Time-optimized validation contract (owner decision 2026-10-21)

**Principle: validate the changed boundary once; carry evidence forward.** Preserve correctness and fail closed, but do not pay for identical suites/builds at every checkpoint.

- **P1** owns navigation/routing tests. **P2** owns inspector/Preview focus/layout tests. **P3** owns catalog/media/persistence and changed-server API tests. **P4** owns Publish-vs-Export UI integration and *changed* auth/rights/status boundaries. **P5** owns exactly one integrated live creator walkthrough and the final aggregate regression.
- P1–P4 run at most one **Studio package typecheck** (`npm run typecheck -w @firelaunch/studio`) after relevant edits, plus only focused unit/component test files explicitly related to their changes. If a checkpoint changes server or other package code, typecheck that changed package, e.g. `npm run typecheck -w @firelaunch/server`, and run directly affected tests. Do not run root `npm run typecheck`, `npm run build`, `npm run check`, `npm run test`, `npm run test:kernel`, full `npm run test:studio`, or `npm run test:runner` during P1–P4 by default. Escalate narrowly when focused evidence reveals a real compatibility failure; record why and never silently omit a required regression.
- For focused tests use the **actual discovered filenames**, e.g. `node --import tsx --test apps/studio/test/<specific>.test.tsx` or `node --import tsx --test apps/server/test/<specific>.test.ts`; do not guess nonexistent test paths. Reuse pre-existing green tests of untouched C7 native worker, ZIP, rights and private media. New regression tests must cover changed behavior including required authorization/deny cases.
- **P5 is the only default aggregate build/test owner:** after all source corrections are stable, run `npm run test` **once**. That script executes `test:kernel` (which first invokes root `npm run build`), Studio tests and runner tests. Every workspace build already runs its own TypeScript compiler/check, including Studio's `tsc --noEmit`; separately running root `npm run check` would typecheck all packages AGAIN before the build. Do not add `npm run build`, `npm run typecheck`, `npm run check`, or duplicated suites after `npm run test`. Run the aggregate after source fixes settle, not before. If P5 fixes source after an aggregate pass, run affected focused checks and then a final aggregate run **only if** the fix invalidated that pass. Never report a stale check as proof of a changed tree. If a prior clean aggregate check already covers the **exact identical tree**, reuse it with provenance; otherwise run one.
- The Prompt Stack runner already performs `git diff --check`, version checks and commit validation after each P1–P4. Do not repeat those checks manually inside prompts; keep narrow entry-state readback and concise handoffs. Review full baseline docs once on P1; P2–P4 reread only affected files, the latest handoff and relevant changed source/contracts. Do **not** repeat browser sign-in, deploy, MediaConvert, native build/ZIP, VirtualDevice, CloudFront, or broad Q2/Q3 acceptance during P1–P4. P5 reuses C7 evidence and checks only the Studio UX changes plus any exact remaining acceptance.
- Browser coverage at P5: **one full creator journey at desktop** and **brief tablet/mobile layout/access checks**, not three full journeys. Prefer already-approved saved videos/releases and existing owner session. One focused correction per observed issue; maximum two repairs only if necessary, no repetitive speculative loops or repeated heavy suites. Safety defects are never skipped to save time. Budget <=8 minutes per implementation prompt; 15-minute cap is a stop-and-handoff threshold, **not** a reason to rush an unsafe change.

## Phase handoff and safety
C7 R1–R3 native export progress is recorded GREEN/SCOPED GREEN at its last independent closeout (isolated worker, owner ZIP, exact VPKG install/branding/artwork/Back/restart); **R4 first-fragment HLS moving video/audio/pause/seek remains NOT GREEN** and technically highest priority. **Do not start implementation from docs alone while the local checkout/ongoing manual P7 source edits conflict.** Confirm exact local git status, root/lock 0.7.3, owner/host state and coherent version-only 0.8.0 transition before beginning P1; no docs-only version bump. P8 P1/P2 can follow a safe source handoff; P4 consumes Phase 7 results when available, reports the exact unqualified external dependency if absent, and never fakes device proof. Do not block safe UI work solely because old unrelated historical gates were NOT GREEN.

Reuse Phase 6 private video/thumbnail HLS evidence and approved FREE release #1 only if still valid. Do not rerun metered MediaConvert work or old broad Q2/Q3 matrices, provision infrastructure, publish creator content, relax owner/CSRF/rights checks, touch AWS/CDN/IAM, overwrite edited source, break backup/rollback, or claim a device/Appstore pass from Preview. No catalog auto polling/sync, optional subtitle feature, paid entitlement, or broad cosmetic redesign. Preserve c7 root 0.7.3/source and app schema 14 until separate entry authority, and never relabel historical P7/Q2/P5/c5 dispositions.

## Phase 9 successor handoff (2026-10-21; docs only)

[Phase 9](../p9/README.md) extends P8's **same Publish and Export surfaces** for post-install compatible remote updates and genuine same-ID native upgrades. The old final MVP qualification moves to P9 P5. Preserve P8's five navigation destinations, context-only inspector, TV Preview, Advanced Source, P1–P5 prompts and 0.8.x versions. P9 needs safe P8 handoff and a separately approved 0.9.0 entry; C7 R4 HLS first-fragment playback remains a hard blocker.

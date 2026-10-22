# P8C — Final Creator UX and Phase 8 Closeout

**Owner-approved docs plan — 2026-10-21 America/Chicago (2026-10-22 UTC). PLANNING ONLY.** No executable prompt files, source changes, version bump, deployment, publication or Phase 8 closeout have occurred from this plan. `p8c` is the final **Phase 8 continuation C**, not a restart of `p8`/`p8b` or a new correction to the Channel architecture.

## Latest evidence and prerequisite handoff

- [P8 Wave 1 closeout](../p8/wave1-closeout.md): **GREEN / DEPLOYED** for its exact tested 0.8.4 creator/navigation/one-action Export path.
- [P8B Wave 2 original closeout](../p8b/wave2-closeout.md) and its [dated follow-on](../p8b/wave2-follow-on-2026-10-21.md): preserve each actual result. P8B Hero/Grid/Rows, six section types, rights-safe static modules, native compatibility guard and stateful Preview are implemented at 0.8.10; missing new-section Vega device parity must be proved, not inferred from unit tests or earlier C7 video playback.
- [c8-ui3 staging closeout](../c8-ui3/closeout.md): **DEPLOYED / UI NOT GREEN** on tested 0.8.10 release `20261021T230818Z-c382c81aeacd`. Its standard Channel frame, left editor, below-TV controls, bottom-right fullscreen remote, fallback fullscreen and reversible Clean View have observed scope-specific passes. Outstanding: featured artwork is narrower than the owner mockup, a small editor artwork image is broken, native Fullscreen API was denied in the browser, and a read-only Export visit reported `Build input changed`. Do not turn these into passed gates by rewording.
- GitHub `main` at docs review is `4e3dc601a8`, root `package.json` remains **0.8.10**. This is repository evidence, not proof of the current laptop worktree or present VPS release. Inspect both at execution. The last commit documented staging deploy access, but a new rollout still requires verification of the current authorized operator workflow, candidate hash, backup and rollback.

**Phase 8 stays OPEN** through P8C. Do not re-run completed `p8b` or `c8-ui`/`c8-ui2`/`c8-ui3` prompt stacks. Preserve their historical closeouts and exact source/host readbacks.

## Owner-approved scope and sequence

| Checkpoint | Planned root version | Main owner | Exit evidence |
| --- | --- | --- | --- |
| **P1 — Artwork & Media Clarity** | **0.8.11** | Saved thumbnail / private vs approved vs live state consistency across Library, editor, Preview; investigate broken editor image and featured artwork scaling | True owner/rights state, save/reopen and preview fidelity; focused component/server regression |
| **P2 — First-Time Creator Experience** | **0.8.12** | New-channel Home starter, duplicate Hero/rows, template naming/empty states and owned-content selection | One coherent starter, deterministic templates, safe existing-project preservation |
| **P3 — Editor Usability Polish** | **0.8.13** | Narrow-screen page discovery, control/touch targets, action hierarchy, save/error and keyboard flows on the existing editor | Focused layout/interaction tests, no new editor architecture |
| **P4 — Integrated Phase 8 Closeout** | **0.8.13 unchanged (manual)** | Final protected staging and owner-browser acceptance; targeted Vega static-section parity; final Phase 8 GREEN/NOT GREEN and handoff | `docs/tasks/p8/closeout.md` supported by real evidence |

**This table is a planning contract, NOT four executable prompt files.** Run `/prompt-ass`, `/prompt-plan`, then `/prompt-write p8c` as separately approved next steps. Confirm runner's pre-1.0 continuation C/version-offset rules before authoring executable grammar. P1–P3 should be sequential, auto-activate when run (no `/activate`), and aim for <=8-minute focused implementations with a 15-minute stop/handoff. P4 is one independent manual/browser/device closeout, never an automatic runner implementation commit or silent `0.8.14` bump.

## Implementation boundaries

**P1**: Diagnose actual artwork asset ownership, rights, rendition/delivery URL, image loading and UI labels before editing. Distinguish uploaded-private, rights-reviewed, technically READY, approved-published and unavailable states accurately. Fix the known thumbnail placeholder, and check the large TV featured-art sizing against the approved reference without altering creator imagery or stretching/cropping content improperly. Preserve existing CatalogItem/ChannelSpec/MediaAsset, signed URL boundaries, video preview/player, revocation and public release immutability. Do not trigger MediaConvert, make private assets public or create a new poster pipeline.

**P2**: Audit the first-run ChannelSpec/Home/template/sample seeding path; prevent duplicate featured Hero and rows when adding example/owner content. Maintain existing-channel layout byte-for-byte unless the user explicitly changes it, with stable page/module IDs and atomic mutations. Keep Hero/Grid/Rows and all six existing section types. Clarify Create page → Choose template → Select owned content → Save → View Preview; no fake media, raw IDs or low-level form redesign.

**P3**: Improve creator comprehension and accessibility using the existing current normal Channel layout: global left navigation, secondary left editor rail, borderless 16:9 right Preview and lower-right normal remote. In fullscreen, preserve **bottom-right** overlay remote, top-right Exit/Hide, left editor drawer, Clean View and recoveries. Prioritize page count/scroll discovery, responsive reachability, consistent muted secondary controls and clear pending/saved/error feedback. Only repair the proven mockup-difference follow-on if still present after P1; do not open another speculative fullscreen/TV geometry redesign.

**P4**: See [implementation plan](implementation-plan.md) for exact staged acceptance, single final aggregate, native delta, historical evidence reuse, safety/rollback and formal closeout requirements. P4 owns the **final** staging/device/Phase 8 disposition; existing c8-ui3 P4 already produced staging and visual evidence, which is reused when still applicable, but it was **NOT GREEN** and cannot itself close Phase 8.

## Explicit Phase 8 acceptance and handoff

P4 writes `docs/tasks/p8/closeout.md` **only after real execution**, with final evidence-backed **GREEN / NOT GREEN**, separately reporting UI, deployed staging and Vega static-section parity (including blocked/rolled-back states). Missing critical rights/security, first-run editor, unusable Preview, unverified required Vega projection or failed active staging are not silently marked GREEN. Native Fullscreen API denial must be distinguished from a working expanded-preview fallback; any scoped owner acceptance of remaining limitations must be explicit, not invented.

The phase exit records exact source/version, tests, archive SHA, deploy/backup/rollback/schema, browser/device facts, preservation of approved FREE release #1, old historical limitations and the accepted Phase 9 entry decision. Phase 9 is **planned only**, and `0.9.0` begins only after a separately approved handoff. Its installed-app updates and final launch demonstration are not pulled into P8C.

**Deadline:** Friday **2026-10-23 12:00 America/Chicago**; internal handoff target 11:30, code-freeze target Thursday 17:00. Prefer fixing verified blockers over opening new product scope.

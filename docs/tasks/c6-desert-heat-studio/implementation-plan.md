# c6-desert-heat-studio — Implementation plan

Date: 2026-10-17 UTC
Status: Planned only; no source changes or qualification by authoring this document.
Owner-approved design: [visual baseline](../../design/studio-visual-baseline.md) and [ADR 0012](../../decisions/0012-studio-visual-identity.md).
Root correction version: `0.6.7` unchanged; check HEAD/working tree and Node24/npm12 before runner execution.

## Architecture / implementation map

### Shared presentation seam (P1)

Source: `apps/studio/src/style.css`, optionally a focused `studio-theme.css` or equivalent imported from Studio (no new large design-system dependency), `apps/studio/public/` for an original, lawful canyon-style asset/fallback.

Create scoped, semantic `--fl-*` tokens, typography, backgrounds, responsive spacing and consistent neutral/primary states; avoid reusing `--tv-*` or global color overrides inside `.tv-screen`. Extract/edit targeted selectors and preserve existing UI. Build a separate optimized, owned canyon visual seam (e.g. original local illustration) + dark overlay + fallback, with no interface pixels or static mockup screenshot baked in. Exact authorized final cinematic asset may remain pending and must be recorded, not silently claimed.

Boundary: no functional React/app APIs, no catalog changes. Test global form/button/tab focus, checked states and Preview isolation.

### Shell composition (P2)

Source: `apps/studio/src/App.tsx`, presentation CSS and focused App/auth/workflow tests.

Create genuine viewport-edge `.app-shell` (no black outer matte, no decorative inset/frame), clear responsive persistent desktop nav/topbar, expandable context/inspector arrangement, and focused central workspace. Reuse existing project switch, session/logout, surface switch, status, Preview and Inspector rendering. Prefer semantic elements and predictable focus/scroll. Preserve no-project onboarding and selected project on reload.

No new fake routes. Establish a minimal real Home/Overview *navigation seam* if needed for P3, but no fabricated media widgets. Keep current selection and necessary Catalog access functional during the incremental intermediate state.

### Project Home and media snapshot (P3)

Source: bounded new Studio `Home.tsx` or `Overview.tsx`, `App.tsx`, `api.ts` read-only call sites and focused tests.

Provide a usable Home/Overview surface that derives **real authenticated project list, current project and its own catalog inventory** via existing APIs; add no unaudited server endpoint. Use zero/one/multiple projects gracefully; landing for signed-in returning project may be Home, while first-time onboarding remains intact. Include actual project title/context, New Channel/Add Video/Go to Catalog/Preview where real and actionable, with clear draft/rights/processing labels; avoid unsupported progress and other sample screenshot destinations. Keep sidebar to actual Studio destinations.

Media cards display creator-authorized `artworkUrl` unchanged, never brand-tinted; image fallback stable and genre-distinct demo art only in explicitly synthetic fixtures, never seeded hosted accounts. Guard request cancellation/project-keying and session-expiry clearing so a fast account/project switch cannot show another project's assets. On incomplete/blocked/unavailable record, show truthful actionable status and open current project's Catalog, not playback or public links. Tests exercise stale response, foreign/empty, image failure, navigation.

### Catalog + video upload materials (P4)

Source: `apps/studio/src/Catalog.tsx`, `VideoUpload.tsx`, `style.css` and corresponding tests.

Unify visual system: video library cards with stable 16:9/other type cropping and independent artwork colors; form labels/helpers/errors, collapsible advanced source tools, Add Video call-to-action, dropzone, upload progress, thumbnail review, processing state, and retry. Preserve 250 MB/30 min and current file/metadata/rights validation behavior; no new publishing, public media access or implicit approval. Keep original source/creator override priority; failed external art falls back safely.

No API/contract/schema edits unless narrowly necessary and explicitly justified; do not restructure upload logic while restyling it.

### Other editor surfaces, responsive and regression convergence (P5)

Source: Studio Create/Agent, Design, Content, Code/Build/Publish/Delivery, `Preview.tsx` only if layout-level changes are essential, shared CSS and Studio tests.

Bring all existing real surfaces into consistent charcoal materials and actions, reduce cross-screen visual drift, complete accessible mobile/tablet rail/scroll/focus behavior and ensure no page horizontal overflow. Guarantee underlying `spec.brand` TV Preview styling remains true with distinct arbitrary creator colors; TV focus and Back/Play remain operational. Audit keyboard event precedence in form fields vs Preview, dialogs/drawers, status/error messaging and reduced motion. Regression suite covers existing controls, authorization-facing status, no fake feature links and safe no-image states. NO new dashboard/page system; reuse App's established surface switch and React components.

### Manual independent qualification (P6)

Inspect committed P1–P5 checkpoint history, exact root version `0.6.7`, source, evidence; use actual browser if available (do **not** claim browser/device evidence from jsdom/unit tests). Capture 1672x941 approx reference view and representative 1440/1024/390 widths, assert true browser-edge chrome and no clipped uploader/inspector. Compare to exact source screenshot **only if hash-verified bytes supplied** and verify separate licensed/owned canyon image rights. Test login/project flow, existing and empty catalogs, upload/rights/processing and Preview/editor/publication status, keyboard + touch, image fallback, contrast and performance. Run one final aggregate `npm run check`, build and stack grammar validation, `git diff --check`, report exact pass/skip. Create `closeout.md` with bounded LOCAL UI GREEN or NOT GREEN and blockers; any hosted/device gaps remain separate.

## Checkpoint table

| Prompt | Model | Browser | Inputs | Product evidence | Version |
| --- | --- | --- | --- | --- | --- |
| P1 theme and asset seam | GPT-6 Sol Medium | no | existing CSS, design spec | tokens, canyon fallback, no TV contamination | 0.6.7 |
| P2 full-bleed shell | GPT-6 Sol High | no | P1 | nav/topbar/inspector, responsive semantics | 0.6.7 |
| P3 truthful home/media | GPT-6 Sol High | no | P2 | project/catalog card states + race isolation | 0.6.7 |
| P4 catalog/upload polish | GPT-6 Sol Medium | no | P3 | real library/upload statuses and images | 0.6.7 |
| P5 editor convergence | GPT-6 Sol High | no | P4 | responsive, focus, preserved Preview/editor routes | 0.6.7 |
| P6 independent closeout | GPT-6 Sol High | yes, MANUAL | committed P1–P5 | full aggregate + real browser comparison/gates | 0.6.7 |

P1–P5 should use focused test+affected Studio typecheck/build and diff checks and commit only through the runner. P5 may use the full Studio test suite but reserve single global `npm run check` for P6. Prefer <=8 minutes work per implementation prompt; if the scope expands unexpectedly, stop and hand off a concrete blocker instead of rushing or broadening. No version bump; no cloud spend or VPS deployment.

## Detailed handoffs / acceptance boundaries

- P1 -> P2: approved palette tokens, scoped class names, canyon asset (or explicit provisional fallback + outstanding image fidelity gate), theme contrast risks.
- P2 -> P3: stable shell regions, responsive rail strategy, existing project/surface selection contract and any new Overview seam.
- P3 -> P4: single source for authenticated project + catalog snapshots, artwork fallback/card component API, stale-result protection and click-through.
- P4 -> P5: verified upload/rights/lifecycle unchanged, unified media classes and remaining form state issues.
- P5 -> P6: list of source patches, exact focused validations, default route/manual browser steps, unresolved asset/contrast/device gaps.
- P6: independent disposition, evidence paths, never redeclare old historical or AWS device qualification.

## Local execution preflight and version safeguards

```bash
cd /home/jfin/dev/firelaunch
git status --short
git fetch origin
git log -1 --oneline
node --version
npm --version
node -p "require('./package.json').version"
npm run codex:stack:validate -- c6-desert-heat-studio
npm run codex:stack -- c6-desert-heat-studio
```

If source differs from the inspected baseline or current root version is not 0.6.7, reconcile current work with owner and update this fixed-version correction; **do not downgrade, reset, force-pull, rewrite commits, or relax runner verification**. The prior GitHub docs commit does not automatically exist in a dirty local checkout. Runner handles prompt commits; the final browser P6 must be run manually and not committed by the prompt.

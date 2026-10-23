# c9-multimedia-editor — prompt assessment

**Assessment approved for authoring:** 2026-10-22 America/Chicago (2026-10-23 UTC). **P9-011, P0**. Documentation only. [Owner issue](../p9-polish/issues/P9-011-mixed-media-sections.md) | [P8D multimedia design](../../design/multi-media-creator-experience.md) | [P9 manual execution policy](../p9/README.md).

## Decision: one focused MANUAL Sol High prompt, including own staging/browser closeout

**Implement and qualify in one deliberately bounded manual Codex-browser invocation** `P1-mixed-media-section-picker.txt`. It is **one issue**, not an additional Phase 9 mainline numbered step and not runner-compatible. Use up to two evidence-driven repair cycles only. Do not make it a new end-to-end publishing or media-transcoding stack. If it is too large to qualify safely in the bounded run, record NOT GREEN plus exact blocked gate and propose a narrow recovery; do not fake acceptance.

The owner explicitly wants: Audio and Book catalog entries available in the same Channel Editor `Choose content` list as videos; selected content appears appropriately in Hero, Content Row, Content Grid and multiple authored rows; every tile has More info and type-specific Watch/Listen/Book detail behaviors.

## Source-grounded findings

- `apps/studio/src/App.tsx` `ModuleEditor` gets `items={spec.content}` only; real `CatalogSnapshot` from `readCatalog` is fetched in `Content` but is not integrated into the checkbox list. The screenshot's video-only choices are therefore plausible without requiring a brand-new selector UI.
- `apps/server/src/catalog-projection.ts` already knows `video|audio|book` → `video|audio|information` with media rights/delivery eligibility, and `apps/server/src/catalog-composition.ts` can build audio/book-compatible rails/grids. **The project content binding/selection path must be audited** rather than blindly concatenating inventory records into `ChannelSpec`.
- `packages/contracts/src/index.ts`: `ContentItem` supports video, audio, information plus book-attached `audiobook`; `hero|rail|grid` already use canonical content IDs, hero max one.
- `packages/tv/src/runtime.ts` and `apps/studio/src/Preview.tsx` already provide mixed-content focus/detail/Back and shared audio/video transports; the native generator shares the contract. Existing TV behavior should be reused and only repaired if observed to fail the issue acceptance.
- The P8D Media/Book private flows are not evidence of native delivery approval. Owner-private URL resolution is allowed only within authorized preview; public export requires actual rights-cleared immutable device-reachable media, never a private owner URL.

## Why not 2–4 correction prompts?

Splitting the same broken user journey into multiple unchecked phases would increase staging churn against tomorrow's MVP deadline. The likely fix is one shared catalog-to-section binding pipeline and a small type-aware selector UI, with targeted existing TV/detail validation. The manual agent can scope changes narrowly, test locally, guarded-deploy, then qualify browser/native as possible. **Do not add a second TV engine, book reader, paid media, automatic publication or a separate native player**.

## Risks / quality gates

1. Merely showing Audio/Books as checkboxes without valid `spec.content` membership yields orphan IDs and missing TV tiles. Ensure a deterministic save/selection binding.
2. Treating all content as video creates false Watch actions, broken MP3 playback and playable book-only cards. Type-correct actions mandatory.
3. Over-eager catalog composition could replace creator-authored pages or auto-include every private upload. Explicit per-section selection only.
4. Rights/source revocation, foreign ownership, missing READY/delivery and unsupported installed clients remain fail-closed.
5. A browser-only private MP3 success cannot qualify an exported native MP3. Record partial/NOT GREEN honestly if native cannot use an approved immutable URL.
6. Changing the global starter template to only video content would be a regression; no broad onboarding redesign.

## Required output

One independently authored `P1` manual prompt, per-issue evidence `docs/tasks/c9-multimedia-editor/P1-evidence.md`, scoped code commit, exact-source protected staging deploy, authenticated real Codex-browser acceptance afterward, and targeted native parity. Product root version **unchanged unless actual Phase 9 checkpoint contract requires an explicit separately reconciled bump**; a correction should not consume or reorder the reserved P9 mainline P1–P10 0.9.x slots.

No product test, stage deployment or qualification is claimed by this assessment.

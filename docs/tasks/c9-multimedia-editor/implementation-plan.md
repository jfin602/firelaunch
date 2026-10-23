# c9-multimedia-editor — focused implementation plan

**Issue:** [P9-011](../p9-polish/issues/P9-011-mixed-media-sections.md), P0.
**Prompt:** [P1 manual implementation + qualification](P1-mixed-media-section-picker.txt).
**Execution owner:** one manual Codex task with connected real browser, GPT-6 Sol High.
**Status:** authored, NOT EXECUTED.

## 1. Execution-time preflight and source inspection

Read `AGENTS.md`, `docs/tasks/p9/README.md`, P9-002/004/008/010 specs, P8D design/closeout and current P9 issue evidence. Confirm the actual local HEAD/status/origin, root and BOTH root-lock version fields, current deployed staging source/active version/schema (last evidenced 15), public FREE #1 unchanged and no in-flight concurrent implementation. The docs' clean entry baseline `0.9.0` is dated; do not reset, stash, force or blindly bump.

Inspect existing:
- `apps/studio/src/App.tsx`: `Content`, `ModuleEditor`, loaded catalog `inventory`, `items={spec.content}`, existing section mutations.
- `apps/studio/src/Preview.tsx`: `catalogContentId`, owner-only private audio/artwork resolution, player/detail UI, `eligibleStaticImageContent`.
- `apps/server/src/catalog-projection.ts`, `catalog-composition.ts`, selection/restore API; canonical CatalogItem-to-ContentItem mapping and authenticated rights.
- `packages/contracts/src/index.ts`, `packages/channel-engine/src/index.ts`, `packages/tv/src/runtime.ts`, native generator used by fresh export.
- Tests for Catalog projection, Channel Editor, Studio Preview, native TV runtime and generator; avoid duplicating existing logic.

## 2. Implement only the missing editor-to-draft media pathway

- Build/reuse **one stable owner-scoped catalog candidate inventory** for the Channel Editor's selected section: Video / Audio / Book, with type metadata, display art and specific eligibility/reason. List owned supported entries even when not selectable due to readiness/rights/delivery, using clearly disabled row and reason; never expose foreign records.
- When creator adds an eligible item, ensure its validated `ContentItem` exists in the current ChannelSpec using the existing stable catalog-content ID, then insert the ID into the selected module. Validate atomicity/idempotence and keep explicit selection: no auto-add to all pages. If saving needs distinct existing authenticated mutations, handle partial failure without dangling IDs or false success.
- When creator removes an item from a module, retain its private Library item and any other module references. Do not accidentally unlink the item from all sections. Hero max one; row/grid stable order and max counts; separate Channels unaffected.
- Channel draft may use a private preview-only resolver for eligible owner-authenticated audio/book artwork, but never write a transient/private URL into exportable `ChannelSpec`/public manifest. A missing public playback URL may remain preview-only/blocked for export until real delivery is ready.

## 3. Reuse existing type-aware renderer/actions

- Video displays landscape art; Detail/More info + Watch launches existing video player.
- MP3 Audio displays square cover; Detail/More info + Listen uses the shared P8D audio player.
- Book displays portrait cover; More info opens Book Showcase (author/synopsis), **no Watch or Play when book-only**; when one eligible attached audiobook exists, show Listen to Audiobook and route to shared audio player; no duplicate audiobook tile.
- Cards/focus/Back/Select work in existing Hero, Content Row, Content Grid and multiple extra rows; focusing selected hero row updates artwork/text without autoplay. Image scaling uses contain for informational art and cover only for decorative background.
- Avoid redesign of the Channel Editor layout (P9-005), Library information architecture (P9-010), global rights modal (P9-004), or live Publishing (P10).

## 4. Local verification

Focused tests with four owned fixtures: video; standalone audio MP3; book-only; book with attached MP3. Include in Hero, Row and Grid; select/unselect and reload; old video-only channels retained; two owners; unauthorized/uncleared/no READY/incompatible device; no orphan IDs/duplicate book; Back and playback transition; unchanged existing artifact schema wherever possible. Run changed-package typecheck/build and `git diff --check`. No gratuitous full suite; P9 P11 owns one final aggregate.

## 5. Protected staging then live Codex browser

Commit tested source (and only update root/both lock versions when legitimately required by current correction semantics). Build archive from exact commit. Verify `scripts/staging/README.md` standing-grant scope, archive SHA-256 and incoming checksum, encrypted backup, schema 15-compatible guarded deploy, healthy API+worker, rollback, retained JS/CSS and FREE #1 pointer/digest unchanged. **Deploy before browser acceptance.**

With owner-signed-in Codex browser on `https://firelaunch.jfin.dev/`, fresh uncached active hash and representative 16:9/fullscreen + mobile view, visually verify selector contains supported types and disabled reasons, select/show/focus details and media actions, save/reload and second-channel isolation. Record screenshots privately. Where actual newly exported Vega behavior is implicated, independently install/render/test generated app in VirtualDevice; if no device/provable audio delivery, report native gate **NOT GREEN**, not fabricated success.

Up to two narrow repair/deploy/browser loops (every changed commit new hash), then record `docs/tasks/c9-multimedia-editor/P1-evidence.md` with scoped GREEN/NOT GREEN/BLOCKED, exact source/deploy/version/metrics, browser/native evidence, public release preservation, outstanding risks and P9 handoff.

## 6. Post-correction routing

Do NOT renumber existing P9 P1–P11 files. P9-011 is an independent P0 correction that should run before P9's P11 closeout; if P9 P2/P3/P8 recently modified eligibility/section UI, reconcile before changes. Cross-reference from P9-010 (Library) and P9-002 (inclusion). P11 must explicitly report P9-011 status.

No product code has been changed by writing this plan.

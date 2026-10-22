# C8 Hero Multimedia — Focus-Driven Hero + One TV Row

**Owner-approved /docs-apply + /prompt-ass + /prompt-plan + /prompt-write, 2026-10-22.** Fully authored correction stack, **NOT EXECUTED OR QUALIFIED**. Owner's native screenshot depicts a simple page shell with title/sections at top and oversized flat Hero/card list. New target: **ONE adaptive hero display + ONE focusable row visible underneath, in the first TV viewport; bottom selection updates hero above without playing anything**. Preserve creator-owned artwork, mixed-video/audio/books and existing Focus/Select/Back. [Design](../../design/c8-hero-multimedia.md) · [assessment](prompt-assessment.md) · [implementation plan](implementation-plan.md).

## Four correction prompts — ROOT VERSION 0.8.17 UNCHANGED

| Prompt | Owner | Purpose | Browser required |
| --- | --- | --- | --- |
| [P1 — Shared focus/spotlight model](P1-shared-hero-focus.txt) | Runner | One canonical focused-item-to-hero derivation; preserve first authored rail and detail/Back | **no** |
| [P2 — Studio Preview hero](P2-studio-adaptive-hero.txt) | Runner | Responsive background/foreground cover, legible metadata and one visible row in real app Preview | **no** |
| [P3 — Vega native hero](P3-vega-native-hero.txt) | Runner | Same native 16:9 composition, safe art modes, D-pad behavior; no vertical scroll to first row | **no** |
| [P4 — Staging + mock artwork visual closeout](P4-browser-native-closeout.txt) | **Manual Codex with browser** | Deploy exact committed source to staging FIRST, signed-in browser, native Vega screenshots + **user-supplied mock art** acceptance | **yes** |

**How to run:** First verify local git HEAD/worktree/origin and root package plus BOTH root-lock version fields remain `0.8.17`; reconcile parallel Phase 8 edits without resets/stashes/force. `npm run codex:stack:validate -- c8-hero-multimedia`, then `npm run codex:stack -- c8-hero-multimedia`. Runner owns P1–P3 code checks and commits; **agents must NOT self-commit/version-bump/push/deploy** during those runner prompts. It will STOP intentionally before browser-required P4; that is a handoff, not an error. Run P4 MANUALLY with Codex browser **and attach the owner mock artwork/reference** at invocation. **No `/activate` and do not run `--closeout` to bypass the browser gate.**

## Implementation boundaries

One canonical `ChannelSpec` and `packages/tv` runtime; existing Hero, first row, page IDs, current selected item, next module ordering, all six section types and ongoing authored content remain valid. The Hero is *presentation*, not new mutable saved media or an independently focused card. Use actual owner-licensed images with foreground contained and safe faded/dimmed background, no AI image generation or new image CDN. Select opens details; Back returns to row selection; focus changes top display only. Preserve published-release capability checks, current video HLS and P8D MP3/audiobook/book showcase and incompatible-client fail-closed behavior. Creator branding remains separate from FireLaunch Studio shell.

## P4 and real qualification

P4 runs with **connected Codex browser** and **explicit owner mock-artwork attachment**. Check exact active protected release on `https://firelaunch.jfin.dev/` after protected archive/backup/schema **15** compatibility and rollback, new+retained JS/CSS visible-root smoke and unchanged approved FREE release #1. Only then test owner signed-in Studio Preview and real native Vega package at 1280x720/1920x1080 for video landscape, square music cover and portrait book. Real device screenshot/display proof is required; the previous Vega screenshot commands sometimes created empty files. If no visual capture or mock attached, honest NOT GREEN with precise missing evidence; never accept native from Studio screenshot. P4 can perform **up to two focused code/browser repair-and-protected-redeploy loops** if needed. Independent `docs/tasks/c8-hero-multimedia/closeout.md` is written after execution at unchanged 0.8.17, not during authoring. It does **not** automatically rewrite `docs/tasks/p8/closeout.md`, activate P9/0.9.0, publish content or waive separate mixed-media approval.

**GitHub authoring baseline:** `main` latest observed `2892d3c77c47`, root+lock `0.8.17`, [Phase 8 final recovery result](../p8/closeout.md) **NOT GREEN**, stage `20261022T165021Z-7510f7405d6c`, schema **15**, 376 passed / 16 skipped / 0 failed. Historical facts, NOT a fresh host or local machine verification.

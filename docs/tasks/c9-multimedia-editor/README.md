# c9-multimedia-editor — Mixed-media content selection in the Channel Editor

**Owner-approved:** 2026-10-22 America/Chicago (2026-10-23 UTC): `/docs-apply + /prompt-ass + /prompt-plan + /prompt-write c9-multimedia-editor`.
**Status:** P9-011 P0 documented, assessed and a **single manual prompt authored; NOT EXECUTED**. No code/version/deployment/native-device qualification by writing these files.
**Version rule:** use the **actual current** Phase 9 source and root version, last reviewed `0.9.0`. This is a correction at **unchanged current version where allowed**, not P9 mainline P1's reserved `0.9.1` and not a Phase 10 publish/update feature.

[Owner issue P9-011](../p9-polish/issues/P9-011-mixed-media-sections.md) · [Prompt assessment](prompt-assessment.md) · [Implementation plan](implementation-plan.md) · [Manual P1](P1-mixed-media-section-picker.txt)

## Prompt disposition and launch instructions

| Prompt | Execution | Purpose | Qualification |
| --- | --- | --- | --- |
| [P1 — Mixed-media section picker](P1-mixed-media-section-picker.txt) | **MANUAL Codex, GPT-6 Sol High, connected browser required** | Surface eligible Video / MP3 Audio / Books in existing Choose content; persist selected draft section IDs; correct mixed Hero/Row/Grid detail and type-specific Watch/Listen/More info | Source tests + agent-owned commit + guarded exact-source staging deploy FIRST + fresh authenticated Codex browser + real native parity when relevant |

**Do not run** `npm run codex:stack -- c9-multimedia-editor`, stack validator, `/activate`, or force a version bump. There is **no runner-grammar prompt sequence** here. Run the file **directly and individually** in a Codex task with connected browser. One bounded issue, with up to two observed correction/deploy/browser loops if needed.

## Why this is separate from P9 P8 Library

The user-provided Android Studio screenshot shows only Video titles in Channel > Edit Section > Choose content even though `p8d` introduced Audio MP3 and Book Showcase to Library. Existing `ModuleEditor` is fed `spec.content`, while owned catalog items may not yet be projected into that spec. This task fixes the **explicit catalog item → owned draft content → section tile** path. [P9 P8](../p9/P8-multimedia-library.txt) remains a distinct issue about Library category navigation and reusable Assets; do not merge its scope into this correction.

## Required media semantics

- Video: thumbnail/film detail, **Watch** using existing VideoPlayer, **More info**.
- Audio: square art, details/artist, **Listen** using existing shared AudioPlayer, **More info**.
- Book: portrait cover, author/synopsis **More info**; **NO TV READER/Play** for book-only. Book with eligible attached audiobook: **Listen to Audiobook** through same AudioPlayer; one Book tile, no duplicate audio item.
- Hero, Content Row, Content Grid, extra rows use the existing shared content IDs and TV runtime, with focus-to-hero change without autoplay, Select/Back preserving focus. Non-16:9 informational foreground artwork fits proportionally.
- Owned/private catalog content is **not automatically** channel-included just because uploaded. Editor check is an explicit draft selection only. Respect source rights, private/public media delivery and no P10 remote installed-app refresh.

## Mandatory gates

Read `AGENTS.md` and current P9 source first. Verify local HEAD/dirty tree, source/version/locks and no parallel conflicts. Focused tests, unchanged protected FREE public release #1 and strict owner/CSRF/readiness, exact SHA-verified committed staging package, encrypted backup/schema last known 15/worker/rollback before deployment. **Authenticate in real Codex browser only AFTER exact staging readback**; verify desktop and mobile selector, saved row/grid/hero, media-specific details and actual native export where possible. Never mistake private Studio audio for approved public device media.

Write `docs/tasks/c9-multimedia-editor/P1-evidence.md` and a truthful closeout; GREEN, NOT GREEN or BLOCKED with independent browser/native evidence and exact tested commit/release. Update P9 P11 handoff if necessary. P9 P1–P11 filenames/assigned versions remain unchanged.

**No product source, DB schema, staging, live publication or version update authorized by prompt authoring.**

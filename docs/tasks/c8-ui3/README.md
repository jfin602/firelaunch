# C8-UI3 — Final Channel Composition & True Fullscreen

## Subsequent dated closeout and handoff to P8C

The [executed P4 staging closeout](closeout.md) on 2026-10-21 23:12 UTC supersedes this document's original pre-implementation status: **STAGING DEPLOYED / UI NOT GREEN** at tested root/lock `0.8.10`. The owner-corrected fullscreen remote is **bottom RIGHT** (not the earlier P3 bottom-left proposal); fallback fullscreen, left drawer and Clean View work in the scoped browser run. Exact approved-mockup art scaling/editor thumbnail and native Fullscreen API success remain unqualified. The earlier c8-ui2 closeout remains historical, and P8B's native static-section parity is still NOT GREEN.

**New owner decision:** [P8C](../p8c/README.md) takes subsequent artwork/media clarity, fresh-creator and editor-polish changes and the **single final Phase 8 integrated staged/native/owner closeout**. Preserve this correction's completed prompts and P4 evidence rather than restarting them or changing their historical disposition. The P8C /docs-apply adds documentation only; there are no P8C implementation prompts, deployment or Phase 8 GREEN claim yet.

---


**Owner-approved 2026-10-21. Correction plan and prompt stack updated; IMPLEMENTATION NOT QUALIFIED.** Root and both root lock fields: **0.8.10 unchanged** at latest GitHub readback. Phase 8 remains OPEN. This is a continuation after c8-ui2 P1–P3, not a reset or rerun of those completed corrections.

[Final visual and fullscreen design contract](../../design/channel-preview-final-composition.md) · [Prompt assessment](prompt-assessment.md) · [Implementation plan](implementation-plan.md)

## Canonical standard Channel mode

The user's last approved Channel mockup is the visual reference for the normal editor and must be attached to Codex P2 and P4 (the image is not stored inside this repository). It establishes:

- Flush global sidebar + secondary LEFT editor seam, aligned topbar and no odd gutters; neutral New Page charcoal-gray tool/section/card palette with restrained orange actions.
- Continuous very-dark Channel-wide background hiding the scenic canyon there (other Studio destinations keep their backgrounds).
- RIGHT interactive TV occupying the largest safe borderless 16:9 upper region, undistorted and without a decorative bezel/shadow.
- **Below the normal TV**: Draft TV Preview, 16:9 Interactive, View full screen and the Virtual remote in lower-right free space, not over the picture.
- Preserve existing P8B Hero/Grid/Rows, static sections, selected-only editing, rights/CSRF, same mounted TV/VideoPlayer and c8-ui2 left drawer.

## Fullscreen must be a genuine app-only experience

Normal mode's under-TV controls DO NOT remain as permanent fullscreen layout. Use maximum available screen for actual TV (edge-to-edge when the display itself is 16:9, otherwise undistorted dark letterbox), with overlay controls rather than reserved space:

- **Fullscreen controls shown:** Virtual remote at BOTTOM LEFT; **Exit fullscreen** and **Hide controls** at TOP RIGHT; existing LEFT editor pop-out drawer available when deliberately revealed.
- **Fullscreen editor open:** SAME page/section editor slides from LEFT edge, preserves pending edits, focus and playback. No new editor or Preview mount.
- **Fullscreen Clean View:** Hide controls leaves ONLY the creator TV app visible—no remote, Exit button, editor/handle, metadata or Studio chrome. Recover with **H** (outside text fields), a small top-right corner hover/touch recovery zone, **Alt+E** (also opens editor), or **Escape** (always exits fullscreen). Do not reveal overlays from casual pointer movement elsewhere or intercept TV controls with invisible UI layers. Fallback when native Fullscreen API is denied must be truthful and equally recoverable.

The closeout must check all three modes in a real Codex browser against staging, not only simulated DOM tests. The approved normal-mode image is still the visual comparison; fullscreen behavior is the additional written contract.

## Sequential correction stack

| Step | Model | Browser | Responsibility |
| --- | --- | --- | --- |
| [P1 — Seamless gray Channel shell](P1-seamless-gray-channel-shell.txt) | GPT-6 Sol Medium | no | Connect panels/topbar, gray tool palette, solid Channel backdrop |
| [P2 — Borderless maximized Preview](P2-borderless-maximized-preview.txt) | GPT-6 Sol High | no | Normal-mode largest 16:9 TV, status/Full Screen below, remote below-right |
| [P3 — True fullscreen and Clean View](P3-true-fullscreen-clean-view.txt) | GPT-6 Sol High | no | Maximal viewport TV; bottom-left remote/top-right controls; reversible all-overlays-hidden mode; preserve left drawer |
| [P4 — Staging visual + fullscreen closeout](P4-staging-visual-closeout.txt) | GPT-6 Sol High | **yes** | One aggregate, protected exact-hash deployment FIRST, then authenticated Codex browser checks of normal and fullscreen modes |

P1–P3 are runner-owned implementation checkpoints, each requiring **unchanged project version 0.8.10**. **P4 is the exactly one final closeout-type prompt**, manual/browser-required; runner stops before P4. No `/activate`, no package/lock bump. P1/P2 authoring files were left unchanged by this extension to protect any local completed sequential work. If local P1/P2 already ran, preserve their commits and begin from the real prefix instead of rerunning or rewriting them.

## Supersession and execution

Committed c8-ui2 P1–P3 remains preserved; its older **unrun** P4 is superseded by c8-ui3 P4 for final visual/staging acceptance. Historical c8-ui UI GREEN/staging and P8B Wave 2 NOT GREEN remain evidence-bound. Do not silently close the P8B native static-layout device gap or Phase 8.

On actual local checkout inspect `git status --short`, HEAD and all 3 root/lock version fields; reconcile dirty/pending changes without resetting or force-pulling. Then:

```bash
npm run codex:stack:validate -- c8-ui3
npm run codex:stack -- c8-ui3
```

Runner executes next incomplete P1/P2/P3 checkpoint in order and stops at manual P4. P1–P3 target <=8 minutes each, hard cap 15; only changed Studio tests/typecheck, no full builds. P4 deploys the LATEST tested source to protected staging FIRST, requiring exact archive hash, current operator grant, encrypted backup, schema14 compatibility and rollback. Then use a real owner-authenticated Codex browser at `https://firelaunch.jfin.dev/` for visual+fullscreen/Clean View acceptance; no localhost substitute or fabricated browser evidence. If blocked, report NOT DEPLOYED/NOT GREEN precisely.

**Owner deadline:** October 23, 2026 noon America/Chicago; Phase 8 stays OPEN. No new creator publication, AWS/MediaConvert, native worker or installed-app change is authorized by this correction.

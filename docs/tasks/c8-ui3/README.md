# C8-UI3 — Seamless Channel Shell & Borderless Maximal TV

**Owner approved 2026-10-21. /docs-apply + /prompt-ass + /prompt-plan + /prompt-write COMPLETE; IMPLEMENTATION NOT STARTED.** This is the final approved screenshot-driven visual refinement after c8-ui2 P1–P3, targeting **unchanged version 0.8.10**. Phase 8 stays OPEN. [Visual design contract](../../design/channel-preview-final-composition.md) · [Assessment](prompt-assessment.md) · [Implementation plan](implementation-plan.md).

## Owner's definitive mockup

The **last approved image in the conversation** is the visual reference, intended for the user to attach to Codex. **It is not in this GitHub repository.** Attach the image to **P2 implementation** and especially **P3 manual staged visual acceptance**. If the image is missing, work from the written spec but never claim a direct visual match to an unseen artifact.

The final Channel composition is:

1. Left permanent Studio global navigation + immediately touching secondary LEFT editor rail. No awkward padding/seam; topbar aligns with the adjoining surfaces.
2. Channel tools, page rows, sections, tabs and forms use the neutral charcoal-gray **New Page popup** palette, selected/primary actions retain restrained warm orange.
3. A continuous dark near-black backdrop like the Preview stage covers the entire Channel area and suppresses the canyon image there. Other Studio pages may retain scenic treatment.
4. **Real 16:9 TV Preview maximized** in upper-right available region, without decorative bezel/border/shadow. Fit to actual remaining width AND height without TV crop/stretch. The TV is the dominant element.
5. **Under the TV**, a compact Draft TV Preview + 16:9 Interactive indicator + View full screen row; **below/right**, the Virtual remote in remaining space, not over the image.
6. Existing c8-ui2 Fullscreen LEFT pop-out drawer, same TV/player/editor state, focus and touch/keyboard access remain unchanged. No bottom dock, duplicate renderer or editor.

## Correction prompts

| Step | Model | Browser | Responsibility |
| --- | --- | --- | --- |
| [P1 — Seamless gray Channel shell](P1-seamless-gray-channel-shell.txt) | GPT-6 Sol Medium | no | Global/editor sidebar seam, header alignment, Channel-only solid dark background and New Page gray tool palette |
| [P2 — Borderless maximized Preview](P2-borderless-maximized-preview.txt) | GPT-6 Sol High | no | Largest fitted 16:9 real TV, remove frame, move status and Full Screen BELOW; remote below/right |
| [P3 — Staging visual closeout](P3-staging-visual-closeout.txt) | GPT-6 Sol High | **yes** | One aggregate, exact-hash protected deployment **FIRST**, then final signed-in staged screenshot comparison in Codex browser |

**P1–P2** are runner-owned implementation commits; **P3** is the only final unambiguous browser-required manual closeout. Runner stops before P3. No `/activate`. All prompts require `- Required unchanged project version: `0.8.10`.` and no root/lock bump. Target <=8 minutes per implementation, 15 minute stop. Focused Studio tests/typecheck P1/P2, one aggregate P3; no broad native/MediaConvert/worker work.

## Why c8-ui3 and not c8-ui2 P4?

GitHub `main` at authoring `8c49aae` already contains **c8-ui2 P1–P3** and their committed work, but `docs/tasks/c8-ui2/closeout.md` is not present. **Do not edit or rerun P1–P3.** The unrun c8-ui2 P4 remains a historical authored prompt and is **superseded for the final visual/staging acceptance by c8-ui3 P3**. It must not be invoked as a second redundant staging closeout. This supersession is a workflow decision, not a claim that c8-ui2 P4 executed or achieved GREEN. Preserve [c8-ui's prior UI GREEN / staged report](../c8-ui/closeout.md) and [P8B Wave 2's still-open static-layout native device gate](../p8b/wave2-follow-on-2026-10-21.md).

## Safe execution

1. Check actual local `git status --short`, HEAD, staged/draft P4 changes and package/root-lock versions (expected `0.8.10`). Do not force sync/reset/stash/lose uncommitted work. The GitHub docs baseline is not a substitute for an inspected local checkout.
2. On clean compatible source run `npm run codex:stack:validate -- c8-ui3` then `npm run codex:stack -- c8-ui3`; P1–P2 commit sequentially and P3 is manual/browser-required.
3. P3 requires a real owner Codex browser, image attachment, protected exact-source archive, verified backup/rollback/schema14, current hashed Studio assets and a valid operator grant for **this** candidate. Deploy first, then test at `https://firelaunch.jfin.dev/` in Codex browser; if blocked report NOT DEPLOYED / NOT GREEN rather than fabricate. Repairs require new reviewed archive + redeploy and retest.
4. Do not activate Phase 9, alter public FREE release #1, private media rights, native Vega runtime or cloud infrastructure. The c8-ui3 closeout is **UI/staging only**, not final Phase 8 closure.

**Deadline context:** owner October 23, 2026 noon America/Chicago; prioritize useful tested results without bypassing safety/evidence.

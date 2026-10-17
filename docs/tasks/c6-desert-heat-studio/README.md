# c6-desert-heat-studio — Creator Studio dark-cinematic visual correction

**Status:** PROMPT STACK AUTHORED / NOT RUN / NOT QUALIFIED.
**Authored:** 2026-10-17 UTC.
**Scope:** Creator Studio UI only. Correction to P6-era Studio baseline; no media-provider correction, no native device qualification.
**Version:** Root and root lockfile and internal workspaces **unchanged `0.6.7`** for all prompts.
**Authority:** [visual specification](../../design/studio-visual-baseline.md), [ADR 0012](../../decisions/0012-studio-visual-identity.md), [reference checksum](../../design/references/README.md), [assessment](prompt-assessment.md), [plan](implementation-plan.md).

## Mission

Make FireLaunch Studio look and behave like the approved **Dark Desert Heat** reference: **true browser-edge full bleed**, dimmed sandstone canyon behind legible real content, restrained warm orange/red action hierarchy, consistent charcoal panels/type/borders/shadows, mobile-usable navigation and right rail, and actual film/media thumbnails retaining independent creator colors. The approved screenshot is a visual target with imaginary names/metrics, not permission to build fake pages or overwrite creator rights or TV channel branding.

## Staged prompt stack

| Prompt | Task | Model | Browser | Root version |
| --- | --- | --- | --- | --- |
| [P1](P1-theme-asset-seam.txt) | Tokens/materials, standalone canyon/fallback seam | GPT-6 Sol Medium | no | 0.6.7 unchanged |
| [P2](P2-full-bleed-shell.txt) | Sidebar/topbar/main/inspector full-bleed responsive shell | GPT-6 Sol High | no | 0.6.7 unchanged |
| [P3](P3-project-home-media.txt) | Truthful project overview, authorized media cards | GPT-6 Sol High | no | 0.6.7 unchanged |
| [P4](P4-catalog-upload-polish.txt) | Catalog, Add Video, artwork/form/progress/rights styling | GPT-6 Sol Medium | no | 0.6.7 unchanged |
| [P5](P5-editor-accessibility-convergence.txt) | Existing editor surfaces, responsive/a11y regression convergence | GPT-6 Sol High | no | 0.6.7 unchanged |
| [P6](P6-independent-visual-closeout.txt) | Independent real-browser UI/functional/contrast closeout | GPT-6 Sol High | **yes; MANUAL** | 0.6.7 unchanged |

P1–P5 are runner checkpoints; **the runner owns each commit**. P6 is **exactly one final manual closeout**. All prompts read the shared plan instead of duplicating the entire design. Keep checkpoints <=8-minute target / <=15-minute maximum when feasible; stop for a genuine dependency/asset blocker instead of claiming full parity. Focused checks in implementations, one final aggregate in P6.

## Preconditions and asset availability

- Verify current actual checkout, dirty worktree, root `0.6.7`, Node24.15+ and npm12. Never force reset or clobber accepted local/staging changes.
- Approved composite screenshot: 1672x941, SHA-256 documented in the design reference; **not in GitHub**. Before pixel comparison use the exact owner source (e.g., owner-supplied handoff ZIP) and verify checksum; do not substitute generated new image. The screenshot must NOT be deployed as page background.
- Need a separate **original or licensed slot-canyon background**. Implementation may introduce an owned provisional illustration/fallback, but P6 must qualify its design fidelity honestly and record if a better approved canyon is unavailable.
- Existing real routes include Catalog, Create, Design, Content, Code, Build, Publish and central 16:9 interactive Preview. Do not introduce fake Templates/Analytics/Community, mock statistics, fictitious catalog items, direct public private-media URLs or cross-project data.
- Do not modify server auth, S3/MediaConvert, object state, playback rights, native Vega, cloud billing, deployment, Package or ChannelSpec to achieve a Studio-only look.

## Gates and evidence

Functional readiness requires responsive navigation/inspector, persistent project state, real content/card data with stale-fetch isolation and legal artwork, usable Add Video and rights controls, preserved Preview focus/navigation, accessible keyboard/mobile layout, and accurate upload/rights/publish/error states.

**Visual GREEN** additionally requires independently inspected desktop/tablet/phone UI against the exact approved reference, truly edge-to-edge layout, suitably dimmed separate canyon artwork and acceptable contrast/performance. If the approved screenshot or lawful background asset is missing, record visual comparison as an evidence gap and close **NOT GREEN** if mandatory visual acceptance cannot be met; never fabricate its screenshots or claims.

Original P0/P4/P5/c5, S1–S6, P6 AWS/MediaConvert, VirtualDevice, physical Fire TV and Appstore qualification remain separate. No production deployment is authorized by this stack.

## Execution

```bash
cd /home/jfin/dev/firelaunch
git status --short
node --version
npm --version
npm run codex:stack:validate -- c6-desert-heat-studio
npm run codex:stack -- c6-desert-heat-studio
```

The runner stops before P6. Run manual [P6](P6-independent-visual-closeout.txt) with the real browser and approved reference available, and write `closeout.md` without changing HEAD. If the local repo is behind GitHub, integrate carefully and protect dirty work. **No implementation or qualification has occurred by writing these prompts.**

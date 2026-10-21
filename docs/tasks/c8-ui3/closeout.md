# C8-UI3 P4 — Channel visual and fullscreen staging closeout

**Observed 2026-10-21 23:08–23:12 UTC. STAGING DEPLOYED / UI NOT GREEN.** The exact tested 0.8.10 source is committed and pushed to GitHub `main`, packaged, and active on protected staging. The observed Channel shell and fallback fullscreen controls work, including a fully visible normal remote at 1280×720. The approved mockup's featured artwork is still substantially wider than the actual preview artwork, and Chrome denied the native Fullscreen API. These gates are not represented as passed.

## Source and qualification

- P1 `a89b1e17faa3dedd109f0b99efb098539790048e`, P2 `1d734170a57542883ff8954b44f2720e2ebd6578`, and P3 `68659baf31e6865b32e99b015a6cc05c5432364c` are preserved. The P4 source repair is `7983f3fb8d635d963f4c8e34359625dcd87e8816`, pushed to `origin/main` at the owner's direction. Root `package.json` and both top-level lock version fields remain `0.8.10`. No source files were edited on the staging host.
- P4 source moves the fullscreen Virtual remote to the owner's required bottom right; adjusts normal Channel column proportions and the under-TV remote card; compacts the normal card at short viewport heights so Back remains visible; and raises the release builder's bounded retained hashed-asset cap from 8 to 16 for cached entrypoints. Directly affected Studio assertions were updated. The original P3 bottom-left direction is superseded by the owner's P4 correction.
- The settled source passed `npm test`: kernel 173 pass / 15 skip / 0 fail; Studio 82 pass / 0 fail; runner 104 pass / 0 fail (359 pass, 15 skip, 0 fail). Studio typecheck, `npm run codex:stack:validate -- c8-ui3`, and `git diff --check` passed. The protected release builder passed new and cached production-bundle visible-root smoke, including signed-out, fixture signed-in, and fresh-tab states; these fixtures were not used for owner browser acceptance.
- Two observed narrow repair loops were used: r2 corrected the normal editor/TV proportions after r1 staging comparison; r3 corrected r2's short-viewport remote clipping. Each revision was rebuilt, hash checked and deployed under its own exact operator grant. r1/r2 are superseded candidates, not the closeout release.

## Protected staging release

- Exact final archive: `/tmp/firelaunch-c8-ui3-p4/firelaunch-c8-ui3-0.8.10-r3.tar.gz`; SHA-256 `c382c81aeacdb45989a98deafa2dfe28df5fd04ef44faaad9ed9279e24fba894`. The independently verified incoming copy was `/home/deploy/firelaunch-incoming/firelaunch-c8-ui3-0.8.10-r3.tar.gz`. Its assembled Studio distribution includes 15 hashed JS/CSS assets, retaining active cached entrypoints.
- The owner-installed sudoers grant matched that exact archive path and SHA, with protected rollback. `/opt/firelaunch-staging-ops/deploy-release.sh` activated `/srv/firelaunch/releases/20261021T230818Z-c382c81aeacd`; `/srv/firelaunch/previous` is the r2 release `20261021T230220Z-9d536656b731`. Schema remained 14 → 14. The protected encrypted predeploy backup is `/var/backups/firelaunch-staging/20261021T230818Z-c382c81aeacd-pre-deploy-schema-14.flrec`, SHA-256 `6a4b5e2c7e4109270ebe94518820dce546adde6b3237fefa25a3a3fe642c8797`, with 11 backed-up objects reported. `firelaunch-staging.service` and `firelaunch-build-worker.service` were active after deployment.
- Live and local index bytes matched at SHA-256 `2994dff4972425d1061362eb5ba721412946e46ee044f8b107633b9a246de628`. The signed-in Chrome tab loaded `index-3Bm1mBXa.js` (SHA-256 `8c71723f8ca4942489c01b3c181d30074760bc6b631ff24d65b0ee48940e5ff4`) and `index-Bo6ne8KF.css` (SHA-256 `8f5e47fb2ca34c38712a35f94021b78e4b4a4a9fe3ae1d03d84b133c83b0b01f`). Browser error/warning logs were empty.
- Approved public FREE release #1's current pointer remained byte-identical at SHA-256 `d1c398ec9a8028fcb3cefbc5d7fedaf47d6b39a7f9adbd3e1fea68d27469a059`. No creator publication, media processing, schema change, native build, or rights change was performed. Rollback was available and was not invoked because no severe staging regression was observed.

## Real owner browser and approved mockup

The fresh Codex-controlled Chrome tab at `https://firelaunch.jfin.dev/` first showed the signed-out gate, then completed the normal Google account chooser for the owner's existing account. It opened `snabble tv` revision 13 as a private draft on the new assets. The reference was the owner's attached `/home/jfin/mock.png` at 1671×941. Local private browser screenshots, excluded from the public Git repository because they show the signed-in owner workspace, are:

- `/home/jfin/.codex/attachments/c8-ui3-p4/channel-1671x941.jpg`
- `/home/jfin/.codex/attachments/c8-ui3-p4/channel-1440x900.jpg`
- `/home/jfin/.codex/attachments/c8-ui3-p4/channel-1280x720.jpg`
- `/home/jfin/.codex/attachments/c8-ui3-p4/fullscreen-controls-1280x720.jpg`
- `/home/jfin/.codex/attachments/c8-ui3-p4/fullscreen-drawer-1280x720.jpg`
- `/home/jfin/.codex/attachments/c8-ui3-p4/fullscreen-clean-1280x720.jpg`

At 1671×941, the main sidebar ended at x=264, the editor rail at x=704, and the black borderless TV began at x=710; the 16:9 frame measured 955×537.2. Its utility row sat below the frame and the normal remote card occupied x=1467–1661, y=720–925. At 1440×900, the frame measured 800.75×450.4 and the remote card occupied x=1236–1430, y=679–884. At 1280×720, the frame measured 690.4×388.3; the card occupied x=1076–1270, y=527–704, with Back ending at y=695. Each document matched its viewport width and height without overall overflow. The Channel showed charcoal editor cards, orange selected controls, aligned topbar/seams, no canyon fragment, and the Draft TV Preview / 16:9 Interactive / View full screen controls below the TV. Pages & Layout, Appearance, a text section inspector, and the New page dialog opened; unsaved text showed Save and Cancel and was cancelled without persistence.

**Mockup difference:** in the owner's image the featured art spans roughly x=755–1614 (about 859 px) inside the TV; in the live 1671×941 screenshot the corresponding image spans roughly x=751–1232 (about 481 px), with a large black region to the right. The live editor's small artwork preview also appears as a broken-image placeholder. The shell proportions are close to the approved image, but the TV content composition is not a direct visual match. This is not concealed by the successful shell geometry checks and was not changed in P4's two limited repair loops.

The tablet 768×1024 and phone 390×844 spot checks had no horizontal document overflow. They used vertical document flow; at 390 px wide the TV begins below the first viewport, which remains a usability limitation rather than a passed phone-layout claim.

## Fullscreen, editor continuity and other surfaces

Chrome denied the native Fullscreen API, showing the app's explicit expanded-preview fallback. `document.fullscreenElement` stayed false. At 1671×941 the single TV frame measured 1671×939.94; at 1280×720 it measured exactly 1280×720. There was one `.tv-frame` and one `#tv-preview`, no bezel or permanent Studio toolbar. At 1280×720, controls occupied the top-right x=1019–1268, y=12–62, and the Virtual remote occupied the bottom-right x=920–1268, y=473–708 with safe inset and no overlap.

- Controls shown: Exit full screen and Hide controls were top right; the remote was bottom right. Opening the video detail and pressing remote Back returned to the page while staying in fullscreen.
- Editor open: Alt+E revealed the same left-edge 440 px drawer. A section editor accepted an unsaved text change. That value remained through Clean View, H, corner recovery, Alt+E and Escape back to normal mode. It was then cancelled; the page stayed revision 13 and private.
- Clean View: the remote, top controls, drawer/handle, fallback notice and Studio chrome were hidden; the TV remained hit-testable. H restored controls, the upper-right corner restored controls, Alt+E restored the left editor, and Escape exited fullscreen. Pointer and touch recovery were not separately hardware qualified; the existing focused Studio tests cover those event paths. Native Fullscreen API success remains unqualified.
- A read-only Publish visit showed private draft revision 13, live release #1, and blocked draft approval for missing eligible bindings. The approved public pointer did not change. A read-only Export visit displayed `Error: Build input changed`; no build or download was attempted. This observed Export status remains separate from the visual correction.

## Disposition

**STAGING DEPLOYED. UI NOT GREEN for exact mockup fidelity and native fullscreen qualification.** The normal shell, short-viewport remote visibility, fallback fullscreen, bottom-right overlay, left drawer, Clean View and keyboard recovery passed the observed staging checks. The featured art scale and editor thumbnail discrepancy remain open, and the browser did not permit a native Fullscreen API result. No severe regression required rollback.

This manual c8-ui3 P4 supersedes the not-yet-run c8-ui2 P4 visual/staging qualification; c8-ui2 prompt files and prior evidence remain intact. P8B native static-section device proof remains NOT GREEN. Phase 8 remains OPEN and Phase 9 was not activated.

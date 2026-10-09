# Cycle 2 — Virtual TV display and remote commands

- **Starting HEAD/version:** `87fb34c4822b7e866e6759060bbbd4acbc658e7a` / `0.0.7`; cycle 1 working-tree repair present.
- **Failed gate:** G5 real television navigation.
- **Observe:** A nonaccelerated Vega Virtual Device window was black even with an SDK reference app. The accelerated GUI rendered FireLaunch. `inputd-cli button_press KEY_DOWN` moved focus, but `KEY_ENTER` did not open detail in the original template. A temporary on-screen event trace showed `enter` events and separate press/release actions. One `KEY_BACK` initially traversed playback and detail together.
- **Diagnose:** The template recognized `select` but not Vega's `enter`; it dispatched both key actions, and native `Pressable` focus competed with the shared TV state. Back was handled both by `TVEventHandler` and `BackHandler`.
- **Repair:** In `templates/vega-channel/src/App.js`, mapped `enter` to select, handled only key-down actions, made Pressables nonfocusable so the shared TV runtime owns remote focus, and kept Back solely in `BackHandler`.
- **Focused validation:** Rebuilt and installed a temporary instrumented VPKG. On the accelerated `VirtualDevice` (TV OS 1.2, x86_64), Down highlighted the content card; Enter opened detail; Enter opened playback; one Back returned to detail and a second Back returned to the focused Home card. Captures: `/tmp/firelaunch-c0-qual/vvd-cycle2-fixed-detail.png`, `/tmp/firelaunch-c0-qual/vvd-back-single-handler.png`, `/tmp/firelaunch-c0-qual/vvd-back-home.png`. This instrumented package was diagnostic, not the final artifact.
- **Real SDK/device/provider:** Direct `vega device install-app`, `launch-app`, and device `inputd-cli` observations; no browser substitute. No live Bedrock request.
- **Remaining failures:** The fixture's placeholder media did not play. The original Wild Earth sample used loopback media and unresolved local SVG artwork.
- **Disposition:** **PARTIAL.** Proceeded to media and final candidate qualification.


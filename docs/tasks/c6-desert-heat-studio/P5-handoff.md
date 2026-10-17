# P5 editor convergence handoff to manual P6

Pre-task HEAD: `9a39f707dec0e81c7afa2172758f41ebb096300e`. Root and lockfile versions remain `0.6.7`. P5 changes are uncommitted for the Prompt Stack runner.

## Changes and bounded evidence

- Unified remaining editor and delivery fields, file list, agent transcript, publication fieldsets and TV remote with Desert Heat materials and spacing. Added 44 px Studio/remote control targets and phone navigation that shows all real surfaces without a sideways menu. Tablet keeps the inspector below Preview; desktop retains its rail.
- Preview keyboard commands now require a target inside its frame. Form typing, window-level keys and media controls do not move TV focus. Native Enter on TV buttons is left to their click action. Creator `--tv-*` values and directional focused styling remain independent of Studio tokens; the frame remains 16:9.
- Added selected-state semantics for Content choices and Code files, labels for inline editors, scrollable transcript/build-output keyboard access, and a live save-status announcement. Guarded Home's optional `scrollIntoView` call in environments without that method.
- Focused Preview/shell/workflow/delivery/auth: **12 passed, 0 failed, 0 skipped**. Studio-wide `npm run test:studio`: **39 passed, 0 failed, 0 skipped**. That run emitted one jsdom `scrollIntoView` exception despite exit 0; after the guard, focused Home tests passed **6/6** without it. Studio typecheck and production build passed. `git diff --check` passed. The root `npm run check` is reserved for P6.

## Manual P6 acceptance

1. Inspect the runner's P5 commit and unchanged root/lockfile version. Obtain the exact approved `trailers.png` and verify SHA-256 `cc664b2e717ca69368d7807644332f213a7ab115fb9b7ea06d04cfb8ba1ef590` before visual comparison. The repo currently has only the separate provisional `studio-canyon.svg`; its visual fidelity and provenance still need independent review.
2. In a real browser, capture labeled ~1440, ~1024 and ~390 CSS-pixel views. Verify viewport-edge shell, readable canyon and fallback, no page horizontal overflow, visible nav, inspector, selected form, dropzone, Preview/remote and publication controls. Measure contrast on bright and dark zones and check keyboard focus, touch targets, reduced motion and scrolling.
3. Exercise actual authenticated empty/existing/multiple-project, catalog artwork failure, authorized upload/rights, Design/Content edit, arbitrary blue/green creator TV brand and D-pad focus/detail/Back, Code/Build/Publish blocked and success states as available. Do not infer rights or release success from fixture data. Record any external states not directly exercised as unverified.
4. Run exactly one final root `npm run check`, required build if not included, stack validation and `git diff --check`. Write P6's independent closeout with browser evidence and an explicit GREEN or NOT GREEN disposition. Historical AWS/MediaConvert, native Vega, hosted security and Appstore gates remain separate.

No real browser screenshot, pixel comparison, measured contrast or device evidence was produced in P5. The remaining visual issue is the provisional illustrated canyon and absence of the exact reference PNG in the repository.

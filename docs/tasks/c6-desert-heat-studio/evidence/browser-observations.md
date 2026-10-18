# P6 real-browser observations

Candidate: `2667bb83b263c778942349164f4477ab6edee161` at root `0.6.7`. Browser: Codex in-app Chromium surface, local Vite `http://127.0.0.1:4173/` proxied to a `local-legacy` API on `127.0.0.1:4174`. The API used only `/tmp/firelaunch-c6-studio-p6-data`, created for this qualification. No hosted account, customer data, AWS service, native package, or deployment was used.

## Captures and viewport data

The browser tool displayed viewport screenshots during this run for desktop onboarding/Home, tablet Home, phone Home/Catalog/Preview, and the project-switch failure. Its screenshot API returned image bytes but exposed no approved file-save operation. A browser data-URL export attempt was rejected by the browser's URL policy; no workaround was attempted. **No screenshot binary was persisted in this evidence directory.** The observations below preserve the labels and measured browser geometry, but the requested file-based screenshot gate is unmet.

| Browser capture | CSS viewport | `documentElement.scrollWidth` | Observed layout |
| --- | ---: | ---: | --- |
| Desktop onboarding | 1440 × 900 | 1440 | `.app-shell` at (0,0), 1440 × 900; sidebar, topbar and onboarding reach viewport edges. |
| Desktop Home | 1440 × 900 | 1440 | Sidebar/topbar and real one-project Home shown. Home hero is a flat dark panel with browser-default white action buttons; no canyon visible. |
| Tablet Home | 1024 × 768 | 1024 | Shell at (0,0), 1024 × 768; 212 px left rail, 812 px main, 754.7 px Home hero. No horizontal page overflow. |
| Phone Home | 390 × 844 | 375 (15 px vertical scrollbar) | Sidebar becomes a top rail; all eight real destinations are visible. Home hero is 351 px wide. The four Home action buttons are 27–28 px high; navigation buttons are 44 px high. |
| Phone Catalog/Preview | 390 × 844 | 375 | TV Preview, virtual remote, and inspector remain in document flow; inspector begins below Preview. Local Catalog correctly says it needs a hosted account, so Add Video is unavailable in this mode. |
| Project-switch failure | 1440 × 900 | 1440 | Selecting the first of two disposable local projects changes the entire page to “Sign in to FireLaunch.” A reload restores the existing local project. |

At desktop and phone sizes the Studio shell itself reaches the document edges without an outer mockup matte. The dark empty workspace background is part of the app. The approved visual reference could not be compared: `trailers.png` / `desert-heat-approved.png` with SHA-256 `cc664b2e717ca69368d7807644332f213a7ab115fb9b7ea06d04cfb8ba1ef590` was absent from the repository and the local file search. **Visual parity is NOT VERIFIED.**

## Functional and accessibility observations

- Created two blank disposable local projects without demo collection data. Home showed the actual project count and names. Selecting the other project through the switcher caused the sign-in failure noted above. In `App.tsx`, the local `getSession()` result is null; the switch guard compares `active?.accountId` (`undefined`) with `accountRef.current` (`null`) and dispatches session expiry.
- The Home action buttons use computed `rgb(239,239,239)` backgrounds, black text, and browser-default 27–28 px heights on phone. Their visual treatment and touch targets do not meet the approved action hierarchy or the baseline's practical 44 px target. The Home hero reports `background-image: none`; the canyon CSS is applied to `.workspace-main` and `.fl-canyon-backdrop`, while Home is rendered outside them.
- The phone Catalog layout exposed its Preview, remote and in-flow inspector. In the local mode used here, the authenticated Catalog/Add Video/MP4 form and rights controls cannot be opened. Private upload, incomplete-rights denial, status/retry, creator artwork and stale hosted-catalog response isolation were therefore **NOT TESTED in a real browser**. Automated Studio tests cover some of those code paths, but are not browser evidence.
- In a disposable project, changing typography to serif saved and immediately changed the TV Preview while Studio remained unchanged. The TV accent remained the creator's green `#49BDA5` while Studio's orange token was `#FF7A1A`. A browser-driven color-input attempt did not trigger React state, so an actual saved blue-brand variant was **NOT VERIFIED**.
- Adding an `Explore` page in Content persisted it and added a Preview navigation button. The remote Right command moved visible TV focus from Home to Explore; Select and Back were available. Typing `Browse` and pressing ArrowLeft in the page-name field kept TV focus on Explore. No actual playback was exercised.
- Build showed `blocked — No build has run` and a disabled build action before source generation. Publish listed separate missing native/build/device/human steps. No build, bundle, release or publication action was triggered. The local Build doctor reported npm 11.19.0 because the running API inherited the shell default; this does not negate the top-level npm 12 aggregate invocation, but shows toolchain configuration is inconsistent.
- Limited computed-color contrast checks, using CSS colors against opaque/blended solid surfaces: sidebar text 16.62:1, Home muted text 8.43:1, Home eyebrow 13.72:1. Home eyebrow actually renders green `rgb(199,232,128)`, inconsistent with the approved warm palette. These are **not** full WCAG results: bright canyon pixels, hover/disabled/error states, remote focus, all text sizes, and a real screen reader were not measured.
- The standalone `studio-canyon.svg` is 2,143 bytes, drawn from in-repository SVG paths and self-described as an original FireLaunch illustration. CSS supplies multiple dark gradients and `prefers-reduced-data` removes the image. No parallax or full-page blur was found. The SVG is provisional, and no independent legal ownership record, image-disabled browser run, network timing, or cumulative layout-shift measurement was obtained.

## Boundaries

This was a real local browser smoke test, not hosted two-account qualification. No synthetic MP4 was uploaded because local Catalog does not expose that flow and no permitted isolated hosted upload environment was established. No external processing, offline/revoked hosted state, touch hardware, screen reader, AWS/MediaConvert, Vega playback, physical Fire TV, or Appstore behavior was tested.

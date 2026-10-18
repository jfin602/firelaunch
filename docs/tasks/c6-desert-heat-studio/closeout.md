# c6-desert-heat-studio P6 — independent manual closeout

> This disposition records the original committed candidate at the HEAD below. After this closeout was written, the owner supplied `/home/jfin/trailers.png` and `/home/jfin/Pictures/this.png` and requested a new visual implementation. That later uncommitted work is outside this initial P6 disposition. The supplied `trailers.png` hashes to `caf6362cba873cd106a04bc823247e183e73b450a0001c4d401a883107d45015`, which differs from the prior documented approved hash. The later request authorizes using that supplied image as a visual reference; this report does not relabel the original P6 gate GREEN.

**Disposition: NOT GREEN / LOCAL STUDIO VISUAL GREEN NOT QUALIFIED.**

The candidate has an independently reproduced project-switch failure in the local Studio, browser-default undersized Home controls, no canyon on Home, and no hash-verified approved reference for comparison. Exact screenshot files and hosted Catalog/upload/browser proof are also absent. These are bounded visual and workflow gaps; the aggregate automated check passed, but it does not establish the manual visual acceptance gate.

## Candidate and provenance

- Exact HEAD: `2667bb83b263c778942349164f4477ab6edee161`; clean source tree before P6. Root `package.json` and root lockfile both remain `0.6.7`; internal workspace package versions retain their historical values and were not edited. No application/source change was needed to launch this candidate.
- Runner checkpoint commits, in order: P1 `7c94eda965b8305a9d4d28927ffc9d011c89c441`, P2 `d54cd1978962369d797a4f5447be0157b23d00c1`, P3 `a81b24e8ad19d11c877308b49a125d084b338971`, P4 `9a39f707dec0e81c7afa2172758f41ebb096300e`, P5 `2667bb83b263c778942349164f4477ab6edee161`. P5 handoff reports no earlier browser or reference-image comparison.
- Approved `trailers.png`: documented 1672 × 941 and SHA-256 `cc664b2e717ca69368d7807644332f213a7ab115fb9b7ea06d04cfb8ba1ef590`. Its bytes were not available in the repository/local search. **Reference comparison NOT VERIFIED**; the composite was not used as a deployable background.
- Separate `apps/studio/public/studio-canyon.svg`: SHA-256 `6dde96c62ebcae598dcfff87d4bc5fe3ed52e224dfd430285cacc89c197a8a72`, 2,143 bytes. P1 introduced it as an original SVG illustration without third-party pixels; no separate rights document was provided. It is deliberately provisional and does not independently prove cinematic parity.

## Automated gates

One top-level `corepack npm run check` was executed under Node `v24.21.0` and Corepack npm `12.2.0`; full output is [final-check.log](evidence/final-check.log). Its `test:kernel` step ran the root build, so no separate `npm run build` was required. All seven workspace typechecks and all seven builds passed: contracts, channel-engine, tv, generator, agent, server and studio.

| Suite | Passed | Failed | Skipped | Total |
| --- | ---: | ---: | ---: | ---: |
| Kernel | 127 | 0 | 15 | 142 |
| Studio | 39 | 0 | 0 | 39 |
| Runner | 104 | 0 | 0 | 104 |
| **Combined** | **270** | **0** | **15** | **285** |

The shell's default npm was `11.19.0`. A separate `corepack npm exec -- npm --version` check showed nested `npm` resolves to 11.19.0, so the aggregate's nested workspace scripts were **not consistently npm 12**. This toolchain qualification is incomplete; the check was not repeated because P6 required exactly one final aggregate run. The running local API's Build doctor independently reported npm 11.19.0.

`corepack npm run codex:stack:validate -- c6-desert-heat-studio` reported valid grammar, unchanged 0.6.7 and manual browser-required P6. `git diff --check` passed. There was no commit, HEAD movement, version change, deployment or cloud invocation.

## Independent browser disposition

See [browser observations](evidence/browser-observations.md). Real browser captures were displayed for 1440 × 900, 1024 × 768 and 390 × 844 views; measured document widths were 1440, 1024 and 375 respectively, the latter accounting for a 15 px scrollbar, with no horizontal overflow. The shell reaches the edges and responsive navigation/Preview/remote/inspector remain visible or in flow. The browser tool did not expose an approved screenshot file-save operation; no screenshot binary is present under `evidence/`. The lack of persisted labeled screenshots is an explicit manual-gate failure.

1. **Project switch breaks local Studio.** Two disposable projects were created in an isolated `/tmp` data directory. Choosing the other one through `Switch project` rendered “Sign in to FireLaunch.” The null local session is compared as `undefined !== null` at `apps/studio/src/App.tsx:149`, dispatching session expiry. Reload restores the existing project. Hosted switch behavior was not exercised in this browser run; related automated tests passed but do not erase the local failure.
2. **Home is visually incomplete.** Its hero has no canyon background and the main Home buttons render with native white backgrounds and 27–28 px phone heights. The baseline calls for a canyon-backed dashboard, warm primary hierarchy, and practical 44 px targets. The Home eyebrow is still green. The separate canyon is visible behind the editor Preview and has a solid/reduced-data CSS fallback, but that does not qualify the Home composition.
3. **Functional bounds.** Blank local onboarding, actual two-project list, Content page save, Preview refresh, remote Right focus, form typing isolation, creator serif typography save, and truthful blocked Build/Publish status were directly observed. Local Catalog states that a hosted account is needed. Authorized hosted inventory/artwork, Add Video/MP4 rights/upload/retry, owner isolation, stale hosted responses, external processing, revoked/offline states and live Publish were **NOT TESTED in this browser**. Automated tests cover CSRF, rights denial, private upload and stale-response paths only as code evidence.
4. **Accessibility/performance bounds.** Limited solid-surface color calculations found sidebar text 16.62:1, Home muted 8.43:1 and Home eyebrow 13.72:1; bright canyon pixels, all control states and screen-reader behavior were not measured. Phone nav buttons measured 44 px, Home action buttons 27–28 px. The 2.1 KB static SVG and CSS show no parallax or expensive blur; image-disabled browser fallback, loading time and layout shift were not measured. No global WCAG or performance pass is claimed.

## Bounded next action and independent gates

Open a narrow Studio correction for the local-mode switch guard, Home canyon/CTA styling and 44 px touch targets. Then supply the exact hash-matching reference PNG and run another independent browser review with persisted screenshots and an isolated authenticated hosted account/upload environment. Verify npm 12 across nested workspace scripts in that follow-up. Do not broaden this manual P6 into an unreviewed rewrite.

Hosted S1–S6 security/staging, AWS/MediaConvert and CloudFront processing/delivery, real creator playback and manifest updates on an installed Vega app, original P0/P4/P5/c5 dispositions, physical Fire TV and Appstore approval remain separate and unqualified by this visual correction. Historical closeouts are unchanged.

## P6 worktree effect

Only this closeout and `evidence/` text/log files were added to the worktree. No source, package, lockfile or workspace version file was edited. P6 made no commit.

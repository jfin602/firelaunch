# FireLaunch Principles

1. Ship to the television, not just the browser.
A browser preview is valuable but never substitutes for Vega build/runtime evidence.

2. ChannelSpec before freeform generation.
The common path uses a small explicit model that can be validated, previewed, diffed and regenerated.

3. One semantic state, multiple projections.
Studio forms, agent actions, preview and generated source must not drift into competing channel definitions.

4. Code remains real.
The user can inspect, export and edit an ordinary generated project. FireLaunch must not become a proprietary dead end.

5. TV interaction is a first-class requirement.
Directional focus, back behavior, readable scale and predictable playback are product requirements, not polish.

6. Agentic does not mean unbounded.
The agent gets narrow tools for channel mutation and generated-project editing. Authority expands only when the product explicitly exposes it.

7. Truthful tooling.
Missing SDKs, credentials, simulators or builds are blocked states. Never turn them into green checkmarks.

8. Build and publish belong in the product.
The workflow continues through generation, validation, build artifact creation and submission readiness.

9. Creator ownership is non-negotiable.
The creator owns source, content, Amazon account, listing and artifacts.

10. Hackathon scope is a feature.
One polished golden path is more valuable than broad unfinished platform infrastructure.

11. Deterministic tests must not require paid/cloud calls.
Mock agent behavior is reproducible. Bedrock integration is verified separately when credentials are available.

12. Preserve the escape hatch.
Structured regeneration must not silently destroy deliberate code customization.

## Post-P0 launch-MVP principles (accepted 2026-10-09)

13. Individual creator app ownership.
Every creator's channel has an independent application identity, developer account/listing, artifacts and exportable source. FireLaunch is not a shared creator viewer app.

14. Catalog-first, never connector-dependent.
The normal journey starts from an authorized content catalog; blank/prompt-first creation remains available. A creator-controlled import must work when Amazon API access is unavailable.

15. Discovery is not authorization.
Seller names, author pages, storefront URLs and ASINs are discovery clues, not permission to import or redistribute. Distinguish discovered and verified states; no automatic ongoing external-source synchronization is planned.

16. Rights and real TV value are required.
A listing does not grant playback rights. Audio, video and writing creators need substantive television-native playback, navigation and presentation.

17. Creator edits survive creator-initiated repeat imports.
Field-level provenance and ownership prevent blind overwrites. New imported items require review; no background polling or automatic missing-item deletion is planned.

18. Approved manifests are immutable.
Draft is not live. The Vega app validates published revisions, caches last known-good state, and supports rollback without blanking the channel on refresh failure.

19. Ordinary content updates do not trigger binary rebuilds.
Compatible catalog and TV-safe layout changes can publish remotely; native permissions, executable changes and incompatible schemas require a new app release.

20. Production trust is not deferred.
MVP includes authentication, per-creator authorization, secure tokens/assets, backups, account deletion/export, operational monitoring, rights controls and reliable sync.

21. Evidence beats optimistic status.
No Amazon connector, real-TV execution, remote sync, Appstore approval or VPKG is qualified by a mock, browser Preview or generated source alone.


## AWS media foundation principles (post-P5)

22. Store and stream separately from the control plane.
FireLaunch owns catalog identity, publishing approval and rights; private originals and verified HLS media live in S3, delivery goes through CloudFront, and muffinos never serves bulk video or runs untrusted encoders.

23. Transcode only as needed and qualify playback.
Probe first, reuse compatible encoded streams only when keyframes/timestamps are safe, otherwise create a bounded adaptive HLS ladder. Device support is proven on the device, not inferred from an MP4 extension.

24. Processing is not permission.
Upload, technical readiness, media rights, public approval and viewer entitlement are separate states. CloudFront OAC is not a paywall. Keep provider and worker adapters replaceable, budgets bounded and revocation honest about caches.
## Studio visual design principles — owner approved 2026-10-17 UTC

25. **Studio styling is not creator TV channel styling.** Dark Desert Heat is for the authoring UI, not a mandatory creator-owned `ChannelSpec.brand`, Vega app, or uploaded artwork.
26. **Cinematic atmosphere serves the workflow.** Full-bleed viewport, deliberately dimmed canyon, legible dark panels and controlled orange-red high-action emphasis cannot compromise responsive forms, accessibility or TV Preview.
27. **Content has its own colors and rights.** Genre art is varied and shown faithfully, not globally tinted orange. Only licensed/creator-owned images may be used for non-fictional catalog data.
28. **A mockup never proves delivery.** Sample account details, fake features, film titles and progress do not establish product features, permissions, processing, publishing, device or external qualification.

See [Studio visual baseline](design/studio-visual-baseline.md) and [ADR 0012](decisions/0012-studio-visual-identity.md).

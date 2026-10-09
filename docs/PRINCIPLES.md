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
Seller names, author pages, storefront URLs and ASINs are discovery clues, not permission to import, redistribute or sync. Distinguish discovered, verified and actively syncing states.

16. Rights and real TV value are required.
A listing does not grant playback rights. Audio, video and writing creators need substantive television-native playback, navigation and presentation.

17. Creator edits survive synchronization.
Field-level provenance and ownership prevent blind overwrites. New items default to review and missing ones receive a grace/review state.

18. Approved manifests are immutable.
Draft is not live. The Vega app validates published revisions, caches last known-good state, and supports rollback without blanking the channel on refresh failure.

19. Ordinary content updates do not trigger binary rebuilds.
Compatible catalog and TV-safe layout changes can publish remotely; native permissions, executable changes and incompatible schemas require a new app release.

20. Production trust is not deferred.
MVP includes authentication, per-creator authorization, secure tokens/assets, backups, account deletion/export, operational monitoring, rights controls and reliable sync.

21. Evidence beats optimistic status.
No Amazon connector, real-TV execution, remote sync, Appstore approval or VPKG is qualified by a mock, browser Preview or generated source alone.

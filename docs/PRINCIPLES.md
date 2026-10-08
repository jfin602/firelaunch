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

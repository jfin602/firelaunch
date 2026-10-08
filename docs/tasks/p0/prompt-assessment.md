# p0 — Prompt assessment

Status: Approved bootstrap assessment.

## Why one-shot is reasonable

FireLaunch P0 is greenfield and intentionally opinionated.

The MVP can be built around one stable core:
ChannelSpec -> preview -> generated Vega runtime.

Most surrounding work is conventional TypeScript/React application engineering.

The owner chose Astra to implement the whole approved slice in one long-horizon turn. Product decisions are therefore locked before execution so Astra spends autonomy on implementation rather than inventing scope.

## Primary implementation risks

1. Fake parity
A browser preview and generated app could drift. Counter with shared semantic contracts and generator tests.

2. TV focus/navigation
A polished mouse UI can still fail TV interaction. Counter with command-level focus tests and real simulator closeout.

3. Vega toolchain uncertainty
The implementation environment may lack Vega SDK/dev tools. Counter with toolchain doctor, ADBT/docs grounding and truthful blocked states. P2 cannot Green without real runtime evidence.

4. Agent overreach
Freeform model output could corrupt state/source. Counter with validated tools and bounded generated-project editing.

5. Regeneration destroys custom code
Counter with explicit dirty detection/override policy.

6. Cloud dependency
Bedrock credentials may not be available during tests. Counter with provider boundary and deterministic mock mode.

7. Scope expansion
Auth, cloud, billing and cross-platform work could consume the hackathon. Explicitly defer them.

8. Fake publishing
A readiness UI could imply submission. Counter with separate automated/human statuses and no Developer Console credential capture.

## Validation strategy

P1 self-validates deterministic implementation and all local build checks available.

P2 independently proves:
- browser golden path;
- persisted/reloaded project;
- real Bedrock behavior if configured/claimed;
- generated source;
- actual Vega build artifact;
- actual simulator/device run;
- demo path;
- publishing truthfulness.

## Prompt count

One implementation prompt is intentional.

Do not split P1 merely because it touches multiple packages. The architecture/product model are the decomposition.

If P1 leaves defects, P2 reports Not Green and the next work is a correction Prompt Stack.

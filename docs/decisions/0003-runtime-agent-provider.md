# ADR 0003 — Provider-neutral agent, Bedrock-first demo

Status: Accepted
Date: 2026-10-08

## Decision

ChannelAgent is provider-neutral.

P0 includes:
- a real Amazon Bedrock adapter selected through configuration;
- a deterministic mock adapter for tests and offline fallback.

BEDROCK_MODEL_ID is configuration, not a hardcoded product invariant.

## Why

Provider independence keeps channel logic testable and replaceable. Bedrock creates an Amazon-native runtime integration and optional AWS Builder mini-challenge path without making tests depend on cloud credentials.

## Consequences

- agent tools own validated mutations;
- AWS credentials stay in the normal AWS credential chain/environment;
- mock mode is clearly labeled;
- mini-challenge claims require actual Bedrock evidence.

## Post-P0 clarification (2026-10-09)

The original Bedrock-first decision belongs to the historical P0 hackathon demonstration. The c0 repair-loop closeout remains BLOCKED / NOT GREEN with no live Bedrock proof; do not rewrite it. The launch SaaS is deliberately **AWS-independent** for P1–P3 and provider-neutral for P4 and later. Any supported non-mock provider may qualify P4 with an actual catalog-grounded, validated, persisted ChannelSpec result and usable TV Preview; mocks alone never meet this gate.

See [ADR 0008](0008-launch-ai-provider-policy.md) for the accepted post-P0 policy. This addendum does not revoke the original P0 Bedrock adapter or its evidence requirements.

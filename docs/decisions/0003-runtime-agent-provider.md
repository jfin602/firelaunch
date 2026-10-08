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

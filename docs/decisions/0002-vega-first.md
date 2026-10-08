# ADR 0002 — Vega OS first

Status: Accepted
Date: 2026-10-08

## Decision

The hackathon target is React Native for Vega on Amazon Fire TV.

Fire OS and other television platforms are deferred.

## Why

The challenge accepts Vega, Amazon provides dedicated Vega tooling and Amazon Devices Builder Tools for AI, and a single target makes real simulator/device qualification achievable within the deadline.

## Consequences

- generated output is a Vega project;
- build/readiness follows current Amazon Vega documentation;
- the manifest main category is mandatory;
- platform abstractions must not obscure the P0 Vega path.

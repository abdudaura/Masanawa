# ADR-0012 — Phase 2 TypeScript and Service Foundation Toolchain

Status: accepted
Date: 2026-10-01
Phase: 2

## Context

Phase 2 starts from an intentionally empty production-code root. The earlier technology baseline named TypeScript 6.x but no Phase 2 source had yet been implemented against that major. By foundation start, current stable upstream tooling had moved forward.

A single schema/runtime stack must be selected before services and public contracts diverge.

## Decision

Foundation baseline:

- Node.js 24 LTS runtime line.
- pnpm 12.8.2.
- TypeScript 7.0.2, strict ESM/NodeNext.
- Vitest 5.0.3.
- TypeBox 1.3.34 for runtime-validatable JSON Schema 2020-12 contracts.
- Fastify 5.12.5 for HTTP service boundaries.
- @fastify/type-provider-typebox 6.1.0 for Fastify schema/type integration.
- node-postgres (pg) 8.23.0 as the initial thin PostgreSQL adapter.

Versions are exact foundation pins and advance through normal maintenance verification.

## Why TypeBox

Masanawa APIs need:
- runtime validation of untrusted input;
- static TypeScript inference;
- JSON Schema/OpenAPI-friendly contracts;
- one schema definition usable by Fastify without maintaining handwritten OpenAPI types separately.

TypeBox 1.x is ESM and is designed for the TypeScript 6–7 generation.

## Why direct pg first

The most important early persistence behavior is explicit:
- transactions;
- optimistic concurrency;
- migrations;
- inbox/outbox;
- idempotency;
- attempt/fencing;
- reconciliation.

An ORM is not required to express those invariants and would be premature before domain repositories exist. Domain repositories may later use a typed query layer after a measured ADR, but the canonical schema/transaction semantics remain independent.

## Compatibility impact

There is no TypeScript 6 production implementation to migrate. Moving the foundation baseline to TypeScript 7 therefore changes no existing runtime behavior and avoids starting Phase 2 on an obsolete compiler major.

The Phase 1 contracts remain unchanged.

## Consequences

- all new TypeScript packages use the root strict NodeNext baseline;
- service APIs use TypeBox schemas from their first public/internal routes;
- OpenAPI is generated from canonical runtime schemas later rather than maintained separately;
- database access begins through a narrow adapter rather than domain packages importing pg directly.

## Rejected alternatives

- keep TypeScript 6 solely because the pre-code document named it: no compatibility benefit and immediately stale;
- mix Zod and TypeBox between services: creates duplicate schema semantics;
- adopt an ORM before canonical repositories exist: hides the transaction/outbox work Phase 2 must prove first.

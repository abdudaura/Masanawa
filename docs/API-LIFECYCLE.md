# Public API, Versioning and Deprecation Conventions

Status: canonical production-structure contract.

This document defines the repository-wide API lifecycle established by production Task 057.
It applies to canonical TypeScript package APIs, service/network contracts, events, persisted
job/message schemas and adapter-facing contracts. It does not turn private workspaces into
independently published products and it does not create compatibility layers without a real
consumer requirement.

## 1. Public TypeScript package surface

Every implemented canonical package under `packages/*` has exactly one supported package
entrypoint: `@masanawa/<package>`.

The root entrypoint is owned by `src/index.ts`. Cross-workspace consumers must import from
that package root. Imports of `@masanawa/<package>/src/*`, `internal/*`, repository
implementations, migrations, generated build paths or any other deep subpath are unsupported.

Package `exports` therefore expose only `.` with:
- TypeScript source for the `types` and development/default conditions;
- built JavaScript for the `production` condition.

A new public subpath is an architectural API decision, not a convenience for bypassing the
owner's root surface. Add one only with documented ownership and architecture-test changes.

## 2. Workspace package version is not contract version

The repository is a private coordinated monorepo. The current `0.0.0` workspace package
version is deliberately not used as a promise of independently deployable semantic versions.

Compatibility is versioned at the contract that crosses a durable or independently deployed
boundary. Examples include:
- HTTP/RPC request and response schemas;
- event/outbox envelopes and event payloads;
- workflow/job/checkpoint payloads;
- Provider/device protocol messages;
- persisted import/export formats.

Database schema version/migration order is storage evolution, not a public API version.

## 3. Contract versioning

A durable or network contract must carry or resolve an explicit version before more than one
incompatible representation can exist.

Compatible additive evolution may remain within a version when old consumers can safely
ignore the addition and existing required semantics do not change.

A breaking change requires a new explicit contract version. Breaking changes include:
- removing or renaming a field/symbol required by consumers;
- changing a field's meaning, type, units or requiredness incompatibly;
- changing error/result semantics so an existing consumer can misinterpret the outcome;
- changing idempotency, authority, privacy or reconciliation semantics;
- reusing an existing event/job/schema version for an incompatible payload.

Do not create a V2 merely because implementation internals changed.

## 4. Deprecation

Deprecation is a migration state, not deletion.

A deprecated public TypeScript symbol must use JSDoc `@deprecated` and include all three
labels in the same comment:
- `Since:` the contract/release milestone where deprecation began;
- `Use:` the supported replacement or explicit statement that there is none;
- `Remove:` the objective removal gate (a contract version, production task or dated
  migration gate).

Example:

```ts
/**
 * @deprecated Since: api-v2. Use: createCharacterV2. Remove: after api-v1 consumer audit.
 */
```

Do not add a forwarding alias, dual-write path, compatibility endpoint or legacy translation
layer solely to satisfy this convention. Such mechanisms require an identified consumer,
bounded migration window, tests and an explicit deletion gate.

## 5. Removal gate

A deprecated contract may be removed only when:
1. repository consumers have migrated;
2. known independently deployed consumers are inside the declared migration window or have
   migrated;
3. persisted/in-flight payload compatibility has been addressed;
4. contract/acceptance tests prove the supported path;
5. the declared removal gate is satisfied.

Security fixes may require accelerated removal. Record the exception and migration impact
rather than silently changing old semantics.

## 6. Service/API conventions

Public and internal service APIs use explicit schema versions. A breaking service contract
uses a new endpoint/protocol/schema version or a deliberately bounded compatibility adapter.

Typed errors retain stable machine-readable codes and ambiguity/reconciliation identifiers
across compatible revisions. Clients must not parse human-readable error text as contract
state.

Internal service authentication, tenant context and end-user authority remain required across
versions; a new API version never weakens the security boundary.

## 7. Events, jobs and durable messages

Durable messages are immutable historical evidence. Producers never rewrite the meaning of an
already emitted version.

Consumers must reject unsupported versions deterministically or route them through an explicit,
tested migration adapter. Unknown versions must not be guessed from payload shape.

A compatibility adapter translates at the boundary; it does not become a second domain source
of truth.

## 8. Enforcement

`test/architecture/public-api-lifecycle.test.ts` enforces the structural rules that can be
proved repository-wide today:
- canonical packages expose one root entrypoint;
- root exports keep the production/source condition contract;
- canonical packages remain private coordinated workspaces;
- cross-workspace TypeScript imports cannot deep-import another Masanawa workspace;
- any production `@deprecated` marker carries `Since:`, `Use:` and `Remove:` metadata.

Cross-cutting compatibility evidence belongs in `tests/contracts` as versioned network,
event, job and schema contracts are implemented.

## 9. Change rule

A change to public API/version/deprecation policy must update this document and its structural
enforcement in the same reviewed change. Exceptions require an ADR when they alter canonical
ownership or create a long-lived compatibility boundary.

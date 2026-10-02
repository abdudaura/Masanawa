# Test Topology and CI Gates

Status: canonical production-structure contract.

This document defines the test ownership and CI conventions established by production
Task 056. Structural enforcement lives in
`test/architecture/test-topology.test.ts`.

## 1. Test ownership

### Colocated tests

Package/service/adapter/infra owner-local tests remain beside source when the behavior
belongs to one owner. Examples:
- domain invariants and pure unit tests;
- a storage adapter's PostgreSQL integration for its repository implementation;
- service bootstrap/lifecycle unit tests.

Colocation keeps the implementation owner obvious and avoids a second test-only copy of
domain boundaries.

### Cross-cutting suites

Cross-owner and release evidence lives under:

- `tests/contracts` — public/service/schema compatibility;
- `tests/integration` — multi-owner composition and infrastructure integration;
- `tests/e2e` — coarse-service/product golden journeys;
- `tests/parity` — source-blind donor-behavior preservation;
- `tests/security` — tenant isolation, authority/revocation, abuse and secret boundaries;
- `tests/recovery` — crash/restart, stale work, idempotency, replay and reconciliation;
- `tests/load` — throughput, backpressure, queue/realtime latency and capacity;
- `tests/chaos` — deterministic injected failure/ambiguity scenarios.

The shared deterministic fault harness remains in `test/support`; recovery/chaos suites
consume it as test infrastructure rather than creating another runtime mechanism.

## 2. No coverage duplication

Do not copy a package-local test into a cross-cutting suite merely to populate a folder.

Move or add a test to `tests/*` only when its evidence is genuinely cross-cutting or
release-oriented. Task 056 therefore reclassifies the existing fault-harness assertions:
fault-plan behavior lives in Chaos and restart-generation behavior lives in Recovery,
with the original duplicate test file removed.

## 3. Blocking CI gate

Every pull request and every push to `main` must pass, in this order:

1. frozen dependency install;
2. strict repository-wide TypeScript typecheck;
3. `test:ci`, which runs all ordinary `*.test.ts` files including package-local,
   architecture and `tests/*` suites;
4. recursive production build of every implemented workspace.

The Foundation CI workflow exposes typecheck, test and build as separate named steps so
failure class is visible without changing the local `pnpm check` contract.

## 4. Targeted suite commands

The root package exposes:
- `test:architecture`;
- `test:contracts`;
- `test:integration`;
- `test:e2e`;
- `test:parity`;
- `test:security`;
- `test:recovery`;
- `test:load`;
- `test:chaos`.

Targeted commands are for focused local/CI diagnosis. Contracts/integration/e2e/parity
may remain empty until their owning production task supplies real evidence and therefore
use `--passWithNoTests`. Security/recovery/load/chaos are non-empty blocking suites and
must not use that escape hatch.

Task 056 seeds those required suites with cross-cutting evidence rather than copies of
package tests: credential-secret serialization redaction, crash-after-side-effect receipt
replay, a 2,000-provider deterministic registry load smoke, and deterministic injected
fault-plan behavior.

## 5. Load and chaos discipline

PR-blocking load/chaos tests must be deterministic, bounded and suitable for shared CI.
Unseeded randomness, unbounded soak tests and dependence on uncontrolled external
providers are not acceptable merge evidence.

Long-running capacity/soak or real-device/provider campaigns may be added later behind
explicit production-validation workflows, but they do not replace the bounded merge
gate. Task 146 owns full performance/capacity proof.

## 6. Security/recovery discipline

Security and recovery tests must assert observable boundaries rather than private
implementation accidents. Prefer:
- tenant/authority isolation;
- stale/revoked authority rejection;
- secret/log redaction;
- crash points around durable writes/acks;
- restart/replay without duplicate side effects;
- ambiguous provider/device outcome reconciliation.

These suites may consume public test helpers but must not bypass canonical domain ports
or create test-only sources of truth.

## 7. Change rule

A new cross-cutting suite or a change to the blocking CI sequence requires updating this
document, root scripts/workflow and the architecture topology test in the same reviewed
change.

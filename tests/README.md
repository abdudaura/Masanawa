# Cross-cutting test suites

Package-local unit tests remain beside source. Package/adapter-owned integration tests
may remain colocated when they exercise one owner plus its concrete technology.

The `tests/*` tree is for cross-cutting release evidence:

- `contracts`: public/service/schema compatibility;
- `integration`: multi-owner composition and infrastructure integration;
- `e2e`: coarse-service/product golden journeys;
- `parity`: source-blind preservation of selected donor behavior;
- `security`: tenant isolation, authority, abuse and secret-boundary tests;
- `recovery`: crash/restart/reconciliation/idempotency evidence;
- `load`: bounded throughput, backpressure, latency and capacity tests;
- `chaos`: deterministic injected failure and ambiguity tests.

See `docs/TEST-TOPOLOGY.md` for CI/gating rules.

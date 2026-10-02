# Phase 5 — Tools and Providers

Status: ACTIVE  
Started: 2026-10-02  
Active branch: `phase5-tools-providers-foundation`

Phase 4 Memory is closed by PR #36, merge
`e960b3f5dfe4d7b7470ddea604187420451498ce`.
Acceptance implementation head `d48b17ff9c4bcb91d51d88bf78da7a1e6c9f597a`
passed Foundation CI run 313 and final closure documentation head
`d67c9332431a7a8ce428e426f93ea61f34b7d798` passed run 316.

## Canonical ownership

- `packages/tools` owns atomic capability/Tool contracts, registry semantics and the
  deterministic execution envelope.
- `packages/providers` owns Provider identity, capability publication, model/service
  availability and readiness/health contracts.
- `packages/security` remains the authority/approval owner.
- `packages/events` remains the Operation/idempotency/reconciliation/audit owner.
- Raw secrets belong behind credential references and provider adapters; public Tool or
  Provider definitions never contain secret values.
- Skills, Agents, Plugins and domain workflows consume these canonical contracts later;
  they do not create alternate registries.

## Donor boundary

Primary structural donor for tools: OpenJarvis. Secondary behavior donors: OpenClaw,
elizaOS and ChatWithStars.

Adopt behavior, not donor runtime ownership:
- explicit atomic Tool contracts and capability discovery;
- deterministic provider/tool selection;
- separation of sandbox/tool policy from model intent;
- current-authority revalidation before delayed mutation;
- typed idempotency/retry/reconciliation declarations;
- readiness/health and explicit failure states.

Reject:
- donor agent identity as Tool authority;
- silent provider fallback when a caller explicitly selected a provider;
- raw provider credentials embedded in tool/model configuration objects;
- plugin/package loading as implicit Tool registration;
- conversational history as side-effect truth.

## First canonical slice — implementation gate passed

Goal: versioned Tool/Provider contracts plus deterministic in-process registries and
fail-closed provider selection.

Implemented:
- branded normalized `CapabilityKey` lives in shared contracts so Provider and Tool
  packages share one capability identity without a dependency cycle;
- real `@masanawa/providers` package with immutable versioned Provider definitions,
  explicit credential-slot metadata and readiness observations stored separately from
  definition identity;
- provider registration is exact-replay idempotent while ProviderId or key/version
  rebinding to different definitions fails closed;
- default provider selection considers only exact-capability providers whose current
  readiness state is `ready`, with deterministic priority/key/version/ID ordering;
- explicit ProviderId or exact key/version selection never falls back to another
  provider when missing, unsupported, degraded, unavailable or disabled;
- stale readiness observations cannot overwrite newer readiness state;
- real `@masanawa/tools` package with canonical capability definitions and immutable
  ToolId/ToolVersionId contracts;
- Tool lookup is version-pinned; there is intentionally no implicit latest-version
  resolution;
- Tool registration is exact-replay idempotent and rejects ToolId/key/version conflicts
  or unregistered capability references;
- Tool definitions carry canonical JSON input/output schemas, required authority
  capabilities, risk/side-effect/sensitivity, timeout/rate/cost metadata,
  idempotency/reconciliation declarations and optional Provider capability requirement;
- consequential/restricted Tool definitions are rejected unless they use
  operation-bound idempotency and non-none reconciliation semantics;
- Provider-backed Tool resolution delegates to the canonical fail-closed Provider
  registry, preserving explicit no-fallback behavior;
- Tool invocation envelope carries the canonical external `AuthorityContext`, validates
  canonical data, freezes model input and bounds idempotency/explicit-provider metadata
  without inventing a Tool-owned authority model;
- packages are wired into the production build and frozen pnpm workspace lockfile.

Validation evidence:
- implementation head `1f2e9d69b9adc312c06e8b3b5e12978a6c3e7074` passed
  Foundation CI run 318;
- the complete `check` job passed frozen install, strict TypeScript, unit and
  architecture tests, existing PostgreSQL 18 + pgvector integration suites and
  production builds;
- PR #37 has no review threads or comments;
- final documentation head must pass the same gate before merge.

Rules:
- Tool and Provider IDs use canonical UUIDv7-backed Masanawa IDs;
- keys and versions are normalized, bounded and immutable definition identity;
- capabilities are explicit normalized strings and cannot be empty;
- Provider readiness is explicit and separate from registration;
- an explicit ProviderId or provider key/version selection either returns that exact
  eligible provider or fails; it never substitutes another provider;
- default capability selection is deterministic and only considers registered, enabled,
  ready providers advertising the exact capability;
- Tool definitions declare input/output schemas as data, risk and side-effect class,
  timeout/rate/cost metadata, idempotency support and reconciliation mode;
- registry registration is exact-replay idempotent but conflicting identity reuse fails;
- authority remains an external `AuthorityContext`; this slice does not create a second
  authorization system;
- no external SDK/provider adapter is admitted until these contracts and tests pass.

## Phase 5 acceptance direction

Before Phase 5 closes, repository evidence must eventually prove:
- explicit provider selection never silently falls back;
- unhealthy/unready providers are not selected for execution;
- conflicting Tool/Provider version registration fails instead of overwriting;
- consequential Tool execution revalidates present authority before dispatch;
- exact idempotent retry cannot duplicate a side effect;
- ambiguous post-dispatch outcomes reconcile instead of blind retry;
- credentials are referenced, scoped and never exposed in public execution/result data;
- timeout/rate/cost/readiness failures are typed;
- Tool and Provider telemetry carries correlation/operation identity without secret data;
- adapters cannot bypass canonical Tool/Provider registries or security policy.

After this slice:
1. bind credentials by canonical `CredentialRefId` only, never raw secret values;
2. add consequential Tool prepare/execute around existing Operation + current-authority
   primitives;
3. classify provider dispatch outcomes so ambiguous post-dispatch state transitions to
   reconciliation rather than blind retry;
4. prove exact idempotent replay, stale-authority rejection and explicit-provider
   no-fallback through PostgreSQL-backed execution fixtures.


## Second canonical slice — execution/reconciliation in progress

Active branch: `phase5-tool-execution-reconciliation`  
Active PR: #38

Implemented:
- canonical provider credential-slot binding by opaque `CredentialRefId` only;
- no raw secret material enters Provider definitions, Tool invocations or execution
  results;
- consequential Tool executor over existing Security AuthorityContext and Events
  Operation semantics;
- current-policy/revocation revalidation immediately before dispatch;
- deterministic authority-scope and request fingerprints for operation-bound
  idempotency;
- exact replay suppression once an operation has advanced beyond safe pre-dispatch
  states;
- ambiguous adapter exceptions/outcomes transition to `unknown` and reconciliation
  with blind retry disabled;
- provider-independent Tools reject provider credential bindings;
- PostgreSQL ToolOperationStore adapter over `events.operations` and reconciliation;
- tenant-scoped operation reads/transitions;
- unit coverage for exact replay, stale policy, dispatch ambiguity and credential-slot
  enforcement.

Validation:
- implementation head `c6c86f6b0521d408cdf2fcd8938df481353e8d48` passed Foundation CI run 330;
- the complete gate passed frozen install, strict TypeScript, unit/architecture tests,
  PostgreSQL 18 + pgvector integration suites and production builds;
- PostgreSQL acceptance coverage proves exact replay does not redispatch, revoked and
  stale-policy authority stop dispatch, cross-tenant operation reads fail closed, and
  ambiguous dispatch creates a durable reconciliation case with `safe_retry = false`.

Final documentation head must pass the same gate before PR #38 merge.


## Third canonical slice — durable receipts and replay in progress

Active branch: `phase5-tool-receipts-replay`.

PR #38 merged the consequential execution/reconciliation slice as
`21141266ab15e2111b8f78c6df365100a60a017a` after implementation run 330 and
final documentation run 331 passed.

This slice adds:
- canonical `ExternalReceiptEvidence` and `ExternalReceiptRecord` under Events
  ownership;
- bounded sanitized receipt metadata only; no raw provider payload field;
- Tool adapter receipt requirements for known dispatched outcomes;
- receipt persistence before local operation settlement;
- receipt-persistence failure -> `unknown` -> reconciliation, never optimistic success;
- exact replay returns durable receipt evidence without re-dispatch;
- PostgreSQL ToolOperationStore receipt admission/listing through canonical
  `events.external_receipts`;
- unit and PostgreSQL acceptance coverage for durable receipt replay and persistence
  failure handling.

Acceptance is pending the full Foundation CI gate on this branch.

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

## First canonical slice — active

Goal: versioned Tool/Provider contracts plus deterministic in-process registries and
fail-closed provider selection.

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

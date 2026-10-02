# Service Contracts

Status: Phase 1 canonical draft.

Masanawa begins as a modular monorepo with coarse deployable services, not one microservice per domain package.

Domain ownership remains in packages regardless of process placement.

## 1. Gateway/API service

Responsibilities:
- public web/API ingress;
- channel webhook/socket ingress;
- authentication;
- channel subject normalization;
- tenant/User/Relationship/Character route resolution;
- durable inbound admission/dedupe;
- request/AuthorityContext construction;
- CharacterSession command API;
- outbound channel handoff;
- public/internal API schemas;
- device-node connection control plane;
- API rate/request limits.

Must not own:
- canonical memory;
- world simulation;
- durable workflow engine state outside workflow package;
- provider-specific business truth.

Calls:
- identity/security synchronously for admission;
- agents/workflows for work admission;
- outbox/channel adapters for delivery.

## 2. Worker service

Responsibilities:
- durable WorkflowRun/Task execution;
- scheduled occurrences;
- background AgentRuns;
- tool execution coordination;
- provider side-effect dispatch;
- outbox/inbox consumers;
- reconciliation;
- memory consolidation/dreaming jobs;
- world simulation jobs;
- social/commerce/studio workflow workers as packages mature.

Must fence attempts and recheck current authority at consequential boundaries.

Worker loss must not lose admitted durable work.

## 3. Presence service

Responsibilities:
- LiveKit/media transport integration;
- PresenceSession lifecycle;
- realtime model/STT/TTS bridge;
- endpointing/barge-in/playout;
- avatar output bridge;
- channel-independent live turn events;
- CharacterSession bridge.

Must not own:
- Character identity;
- Relationship;
- durable Memory;
- Task/Workflow truth;
- payment/social truth.

A PresenceSession can die/reconnect without losing CharacterSession/Task continuity.

## 4. Ops API/service

Responsibilities:
- operator authentication/authorization;
- health/readiness;
- approvals/HITL views and actions;
- reconciliation/needs-attention;
- device pairing/admin;
- plugin/skill/provider readiness;
- diagnostics export;
- audit querying;
- financial/security adjustments through domain APIs;
- release/runtime control.

Ops never bypasses domain transaction rules by writing tables directly.

## 5. Web/Ops applications

`apps/web` and `apps/ops` are clients/BFF surfaces.

They:
- render projections;
- call typed Gateway/Ops APIs;
- hold no provider secret/runtime authority in React client code;
- do not query canonical database repositories directly.

## 6. Specialized Python/GPU workers

Optional processes for:
- local inference;
- embeddings/reranking;
- vision/media processing;
- avatar rendering/inference;
- evaluation/optimization.

Contract:
- versioned job/request schema;
- authenticated service identity;
- tenant/task/artifact references;
- bounded input/output;
- no canonical domain truth;
- idempotent/reconcilable result submission;
- secrets scoped to the exact job.

If worker disappears, canonical job remains recoverable.

## 7. Adapter placement

Provider/channel/device/storage/media/inference adapters can run in Gateway, Worker,
Presence, or a justified specialized worker according to operational needs.

Registration is explicit at the service/owner composition boundary. An adapter never
discovers or directly orchestrates another adapter; coordination goes through canonical
ports, Provider/Tool selection or durable Workflows.

Their process location never changes domain ownership. The machine-enforced topology
and registration rules are in `ADAPTER-TOPOLOGY.md`. Shared Node process hosting is
`infra/runtime/node`, not an adapter.

## 8. Sync vs async calls

Use synchronous request/response when:
- decision is fast/bounded;
- caller needs immediate validation/read;
- no long external effect;
- one domain owns transaction.

Use workflow/outbox async when:
- external side effect can be slow/ambiguous;
- work survives request;
- multiple domains coordinate;
- retries/reconciliation required;
- human approval required.

## 9. Internal authentication

Every service request has:
- workload identity;
- audience;
- capability scope;
- tenant/request context where relevant;
- correlation/request IDs.

Loopback/VPC/private network is not sufficient authentication.

Service auth does not replace end-user AuthorityContext when acting on behalf of a user.

## 10. API error contract

All service APIs return typed errors with:
- stable error code;
- category: validation/auth/conflict/not-found/unavailable/rate-limit/ambiguous/internal;
- retryability;
- safe message;
- correlationId;
- optional field/resource details;
- optional reconciliation OperationId.

Never force clients to parse error strings for workflow truth.

## 11. API versioning

Operational probes `/healthz` and `/readyz` are intentionally unversioned. All
product/public/internal HTTP contract routes use a supported major prefix such as
`/v1/...`, with supported majors declared in `API-LIFECYCLE.json`.

Breaking contract changes require:
- a new supported HTTP major or explicit compatibility layer;
- a migration/deprecation window;
- Contracts-suite evidence.

Event and durable payload `schemaVersion` values are independent of HTTP and package
versions. Tool/Provider versions are immutable domain registry identities. Package
versions use SemVer syntax. These version domains must not be conflated.

Database schema is not an API.

See `API-LIFECYCLE.md` for repository-wide compatibility/deprecation rules. Repository-wide lifecycle, breaking-change and deprecation rules are canonicalized in `API-LIFECYCLE.md`.

## 12. Readiness

Gateway readiness:
- DB/schema;
- auth policy;
- required ingress configuration;
- ability to persist admitted requests.

Worker readiness:
- DB/schema;
- workflow/outbox stores;
- provider/tool registry initialized;
- writer/lease infrastructure healthy.

Presence readiness:
- transport connectivity/config;
- realtime adapter registry;
- session-state persistence/bridge;
- no stale lifecycle generation.

Ops readiness:
- security/audit repositories;
- approval/reconciliation stores.

Optional provider failure should degrade that provider/capability, not necessarily the whole service.

## 13. Health vs readiness

Health answers "process is alive".

Readiness answers "may accept this class of work".

Capability readiness may be more granular than service readiness.

Example:
- Gateway ready for web chat while WhatsApp adapter degraded;
- Worker ready for memory jobs while one commerce provider unavailable.

## 14. Initial API surfaces

Exact routes are Phase 2 work, but contracts must cover:

Gateway:
- authenticate/session bootstrap;
- resolve/list Characters;
- create/continue CharacterSession;
- submit Perception/text turn;
- stream turn/run events;
- task status/cancel;
- channel callback/webhook endpoints;
- device connect/pair/capability paths.

Ops:
- health/readiness;
- approvals list/decide;
- reconciliation list/action;
- provider/tool/skill/plugin status;
- device pairing/token administration;
- audit query;
- diagnostics export.

Presence:
- create/join/end PresenceSession;
- signed transport token/session bridge;
- realtime event callbacks.

Worker is primarily internal queue/outbox/workflow driven, not public REST.

## 15. Contract tests

Phase 2 must prove:
- Gateway cannot bypass identity/security to start a run;
- Worker resumes accepted durable task after restart;
- Presence restart preserves durable CharacterSession/Task;
- Ops action goes through same domain authorization/transaction as non-Ops caller;
- service credential without end-user delegation cannot impersonate user;
- typed error retains ambiguity/OperationId for uncertain side effect;
- optional provider degradation does not falsely mark unrelated service unready.

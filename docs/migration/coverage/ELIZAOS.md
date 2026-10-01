# Phase 0B Coverage — elizaOS

Pinned revision: `cda43c762c605b69e4fcb9a791092508814bf6c4` (`develop` at source lock).

Status: **ACTIVE / PARTIAL**. Core runtime, plugin, service, task-scheduler and SQL authority families are covered below. Do not mark elizaOS complete until provider/model, connector/channel, host/plugin-loading, security/access, database-schema, app/UI extension and remaining plugin families have descendant-level disposition.

Canonical boundary: elizaOS is a primary TypeScript component/plugin runtime donor. It is not Masanawa's Character identity, memory, workflow, provider, task or business-truth authority.

## Source-control note

The upstream `develop` branch has advanced beyond Masanawa's pinned revision. All implementation claims below were re-read with `fetch_file(ref=cda43c7...)`; current-branch search results were used only to locate candidate paths, never as behavioral evidence.

## 1. Kernel plugin resolution and supply-chain boundary

Implementation evidence:
- `packages/core/src/plugin.ts`
  - validates plugin shape;
  - normalizes aliases/scoped names;
  - resolves declared dependencies;
  - detects dependency cycles;
  - topologically orders resolved plugins;
  - core never dynamically imports or installs a package by string name;
  - a host-supplied `PluginResolver` is required for string references;
  - absent resolver fails closed by skipping unresolved string references.

Durable state: none required in core resolution itself.

Masanawa destination:
- `packages/plugins` for canonical manifest/registration contracts;
- operator/host layer for package acquisition/resolution;
- `packages/security` for provenance/trust/admission.

Disposition: **A — preserve fail-closed supply-chain boundary; B — redesign contract names around Masanawa**.

Acceptance gate:
- core runtime cannot install arbitrary packages;
- unresolved names fail closed;
- dependency cycles cannot produce partially ordered activation;
- plugin source/provenance is recorded before certification/activation;
- model output cannot directly cause package installation.

## 2. Plugin aggregate contract

Implementation evidence:
- `packages/core/src/types/plugin.ts`.

The pinned `Plugin` surface aggregates actions, providers, evaluators, services, models, routes, events, schema/components, connectors and app/UI metadata. Database-adapter factories are also representable, but only one adapter provider is expected per character/runtime.

Masanawa destination:
- `packages/plugins` as packaging/registration only;
- actions map to canonical tools/skills/workflows depending semantics;
- providers map to `packages/providers`;
- services remain runtime infrastructure;
- routes/connectors/UI are host/adapter extensions.

Disposition: **B — preserve packaging breadth without importing elizaOS ownership boundaries**.

Acceptance gate:
- a plugin may register only canonical Masanawa extension points;
- plugin packaging cannot create parallel identity, memory, world, workflow or provider authority;
- each registered component has an owning plugin/version and teardown path.

## 3. Component contracts: actions and providers

Implementation evidence:
- `packages/core/src/types/components.ts`.

Relevant pinned behavior:
- actions have typed parameter schemas and execution metadata;
- providers return structured prompt/context data;
- provider execution receives an `AbortSignal`;
- provider contract explicitly describes provider `get` as read-only context work and warns against committing side effects because an owner may stop waiting before the provider observes cancellation;
- component-name collisions use explicit override policy; undeclared collisions are deterministic first-wins with warnings.

Masanawa destination:
- read-only context providers -> `packages/providers` / context compiler;
- consequential actions -> canonical `packages/tools` / `packages/workflows`, not generic component handlers.

Disposition: **A for read-only provider/cancellation invariant; B for component structure**.

Acceptance gate:
- provider/context acquisition cannot create consequential external side effects;
- cancellation propagates to network/database/subprocess work where supported;
- action/tool inputs are schema-validated before execution;
- side-effecting work goes through canonical authorization/idempotency/reconciliation contracts.

## 4. Runtime plugin ownership and hot lifecycle

Implementation evidence:
- `packages/core/src/plugin-lifecycle.ts`.

Pinned behavior:
- registration is captured with `AsyncLocalStorage` so actions/providers/evaluators/routes/events/models/services/send handlers/database adapters are attributed to the plugin that registered them;
- unload/reload/reconfigure use a reverse ownership index;
- failed plugin registration rolls back partial registration through the same teardown path;
- owned service instances/classes are stopped on teardown;
- plugin `dispose` runs;
- plugin-boundary component `override: true` is neutralized to first-wins because hot unload cannot safely restore a displaced incumbent;
- a plugin that registers a database adapter cannot be hot-unloaded and requires full runtime reload;
- effective role gates are derived from the per-runtime context registry, preventing runtime-registered stricter contexts from collapsing to a permissive default.

Masanawa destination:
- `packages/plugins` lifecycle registry;
- `packages/security` capability/access admission;
- host/runtime supervisor for reload/restart.

Disposition: **A — preserve ownership/rollback/access invariants; B — reimplement without eliza AgentRuntime authority**.

Acceptance gate:
- failed activation leaves no orphan component registrations;
- unload removes exactly owned registrations;
- database/persistence authority cannot be hot-swapped unsafely;
- access gates are computed from the live canonical registry;
- plugin unload/reload is idempotent and observable.

## 5. Long-lived service lifecycle

Implementation evidence:
- `packages/core/src/types/service.ts`;
- `packages/core/src/runtime/service-lifecycle.ts`;
- runtime service registration paths in `packages/core/src/runtime.ts`.

Pinned behavior:
- explicit async `start` and `stop`;
- optional synchronous `prepareStop(reason)` runs before awaiting drains, allowing ingress rejection while admitted work settles;
- services have stable type identifiers;
- multiple implementations require explicit `allowsMultiple`;
- runtime lifecycle retries eager startup after transient failures and shutdown terminates retries;
- observer/reporting failure must not invalidate an otherwise-running service.

Masanawa destination:
- plugin/runtime service supervisor;
- canonical service health/readiness under Ops/telemetry.

Disposition: **A/B — preserve lifecycle behavior, redesign registry around Masanawa services**.

Acceptance gate:
- shutdown closes admission before drain;
- transient startup failure is retried only under bounded policy;
- stop prevents further restart attempts;
- ambiguous duplicate service types are rejected or explicitly multi-implementation;
- observer failure cannot silently kill healthy service state.

## 6. Shared task scheduler stale-work fencing

Implementation evidence:
- `packages/core/src/services/task-scheduler.ts`;
- `packages/core/src/services/task.ts`.

Pinned behavior:
- one process scheduler batches task queries across registered runtimes;
- each runtime registration receives a monotonically increasing registration ID;
- scheduler has a generation fence;
- changing scheduler adapter/generation invalidates in-flight results;
- stale runtime registration cannot receive tasks;
- adapter results containing tasks for unqueried agents are treated as scope violations and reported;
- shared query failure re-arms affected runtimes and reports typed failures;
- per-runtime tick failures are isolated so one runtime does not suppress others;
- unregistering a runtime prevents later dispatch to it.

Masanawa destination:
- `packages/workflows` / durable job supervisor, not agent runtime state.

Disposition: **A — preserve stale-work/scope/isolation invariants; B — use Masanawa durable workflow scheduler**.

Acceptance gate:
- restarted/replaced scheduler cannot dispatch stale query results;
- task query results cannot cross tenant/agent scope;
- one worker failure does not suppress unrelated work;
- repeated ticks are idempotent at workflow/job boundary;
- task execution state is durable, not process-only.

## 7. SQL adapter and persistence plugin — non-canonical authority

Implementation evidence:
- `plugins/plugin-sql/src/index.ts`.

Pinned behavior:
- selects PostgreSQL when configured, otherwise per-agent PGlite;
- PostgreSQL connection managers may be reused;
- optional data isolation requires `ELIZA_SERVER_ID`;
- plugin registers database adapter before dependent behavior;
- adapter readiness errors are distinguished;
- plugin exports a very broad schema covering agents, auth, channels, entities, identity authority, relationships, memories, messages, tasks, worlds and other domains;
- runtime migrator and RLS utilities are exposed;
- corrupt/local PGlite managers can be bounded-close/drop/rebuilt.

Masanawa boundary:
- elizaOS database schema is **not** canonical;
- Masanawa PostgreSQL domain tables remain owned by canonical packages;
- useful RLS/readiness/migration/recovery mechanics are secondary reference only.

Disposition: **C for domain schema authority; B for adapter readiness/RLS/recovery mechanics**.

Acceptance gate:
- plugin persistence cannot become a second source of truth;
- canonical domain migrations live in Masanawa;
- data isolation cannot depend on plugin-local identity semantics;
- local cache/embedded DB loss cannot erase canonical platform truth.

## 8. AgentRuntime identity boundary

Implementation evidence:
- `packages/core/src/runtime.ts`;
- Phase 0A source map `docs/migration/sources/ELIZA.md`.

The runtime aggregates one agent's settings, registries and execution surface. That shape is useful for execution composition but is incompatible with Masanawa's rule that Character identity is a durable domain entity independent of agent strategy/runtime.

Disposition: **C as Character/identity authority; B as runtime composition reference**.

Acceptance gate:
- runtime restart/replacement cannot create a new Character identity;
- agent strategy/runtime instances are replaceable execution mechanisms;
- memory/world/workflow truth survives runtime replacement.

## Current unresolved descendant families

The following must still be swept before elizaOS can be marked covered:
1. model registration/dispatch and provider fallback/health;
2. evaluator/response-handler lifecycle and failure isolation;
3. connector/channel source definitions and delivery semantics;
4. host-side plugin resolver/install/staging and optional-plugin failure behavior;
5. core/agent access, disclosure, principal/membership and authorization paths;
6. plugin SQL schema families/RLS/migrations at domain-family level;
7. app/UI/view/widget extension authority and sandboxing;
8. local/device/native bridge capability boundaries;
9. representative bundled plugins and external integrations;
10. deployment/cloud/runtime proxy behavior that could create alternate runtime authority;
11. direct test/acceptance coverage for the consequential invariants above.

Do not advance the handoff to the next donor until these are dispositioned or explicitly proven irrelevant.

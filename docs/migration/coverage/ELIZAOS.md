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


## 9. Model registry, dispatch and fallback

Implementation evidence:
- `packages/core/src/types/model.ts` — model-neutral type registry spanning text, embeddings, tokenization, image, transcription, TTS, audio/video and research; model/tool call shapes and per-call configuration.
- `packages/core/src/runtime/model-dispatch/dispatcher.ts` — registered-handler selection, admission, failover, streaming and trajectory/inference timing hooks.
- `packages/core/src/runtime/__tests__/use-model-provider-fallback.test.ts` — provider fallback behavior at the pinned tree.

Relevant behavior:
- model types are capabilities, not provider identities;
- multiple handlers may compete by registration metadata/priority;
- dispatch/failover sits below the runtime;
- inference timing/provider identity are observable;
- structured tool definitions and model calls remain provider-neutral.

Masanawa destination:
- `packages/providers` for canonical model/provider capability registry;
- `packages/telemetry` for inference timing/trace metadata.

Disposition: **B — preserve capability/dispatch structure, not eliza runtime ownership**.

Acceptance gate:
- model/provider failure can fail over only according to explicit policy;
- fallback cannot cross privacy/region/cost/capability constraints;
- provider selection is observable;
- model response never becomes authoritative side-effect truth without tool/workflow validation.

## 10. Evaluator / response-handler isolation

Implementation evidence:
- `packages/core/src/types/evaluator.ts`;
- `packages/core/src/runtime/response-handler-evaluators.ts`;
- response field/evaluator infrastructure under `packages/core/src/runtime/`.

Pinned behavior:
- evaluators are independent response-stage enrichers;
- each evaluator has its own `shouldRun` and evaluate path;
- failures are collected/reported while remaining evaluators continue;
- patches are applied through a bounded response-handler surface rather than arbitrary runtime mutation;
- deterministic-tool-call admission is checked before evaluator-produced effects are accepted.

Masanawa destination:
- bounded `packages/decisions` / response-posture/evaluation seams;
- consequential actions still belong to tools/workflows.

Disposition: **A/B — preserve failure isolation and bounded patch semantics**.

Acceptance gate:
- one evaluator failure cannot suppress unrelated evaluators;
- evaluator output cannot bypass action/tool authorization;
- applied patches are traceable to evaluator/version;
- evaluator errors remain observable without corrupting the turn.

## 11. Connector source registry and channel metadata boundary

Implementation evidence:
- `packages/core/src/connectors.ts`;
- connector registration through plugin contracts/runtime.

Pinned behavior:
- connector sources canonicalize aliases;
- metadata is owner-scoped so plugin contributions can be removed without clobbering other owners;
- active/passive source classification is explicit;
- identity-field projection and world-id metadata keys are declared by connector metadata instead of hard-coded channel branches;
- owner contributions can be unregistered wholesale.

Masanawa destination:
- gateway/channel adapter registry;
- canonical identity resolution remains in `packages/identity` / security.

Disposition: **A/B — preserve declarative connector metadata and owner-scoped registration; reject connector-owned identity truth**.

Acceptance gate:
- channel adapters declare identity projection instead of embedding channel-specific branches in core;
- connector metadata cannot manufacture canonical account ownership;
- unloading a connector removes only its aliases/metadata;
- passive/active source semantics are explicit and testable.

## 12. Unified action access gate

Implementation evidence:
- `packages/core/src/runtime/action-gate.ts`;
- plugin lifecycle role-context derivation in `packages/core/src/plugin-lifecycle.ts`.

Pinned behavior:
- one gate is intended to govern both planner exposure and execution;
- gate composes private/autonomy-only policy, non-overridable disclosure/destination checks, operator role policy, context gates and role gates;
- execution cannot use `skipPrivateGate`;
- runtime-registered contexts participate in access decisions.

Masanawa destination:
- `packages/security` + canonical tools/skills admission.

Disposition: **A — preserve one exposure/execution gate invariant; B — translate roles/contexts to Masanawa policy model**.

Acceptance gate:
- planner-visible does not imply executable unless the same current-authority gate passes;
- forced/hallucinated calls cannot bypass private/action role policy;
- disclosure/destination constraints are non-overridable by model output;
- policy revalidates at execution time.

## 13. Cloud runtime proxy — alternate execution location, not authority

Implementation evidence:
- `plugins/plugin-elizacloud/src/cloud/cloud-proxy.ts`.

Pinned behavior:
- a lightweight proxy can route chat/status calls to a remote sandbox instead of a local runtime.

Masanawa disposition: **C as canonical runtime boundary; B as remote-execution adapter pattern**.

Reason:
Masanawa must not create local and cloud brains with divergent identity/memory/workflow truth. Remote compute is an execution location behind the same canonical contracts.

Acceptance gate:
- local/cloud execution resolves the same Character, relationship, memory scope and workflow IDs;
- proxy loss does not lose canonical task/business state;
- remote runtime status is health metadata, not domain truth.

## Updated unresolved descendant families

Still required before closure:
1. host-side plugin install/staging/resolution and failure/rollback behavior;
2. SQL schema/RLS/migration descendant families and authority disposition;
3. principal/membership/auth/disclosure implementation beyond action gate;
4. app/view/widget capability brokerage and sandbox/authority controls;
5. local/native device bridges and computer-use capability boundaries;
6. representative bundled plugins/integrations and their side-effect semantics;
7. deployment/cloud services that may own durable state or credentials;
8. exact direct-test inventory for the retained consequential behaviors.

The core model/evaluator/connector/access families are no longer unresolved.


## 14. Host-side plugin resolution and staging

Implementation evidence:
- `packages/agent/src/runtime/plugin-resolver.ts`.

Pinned behavior:
- app manifests can restrict candidate plugin sets and supply defaults without silently overriding explicit user config;
- auto-enable decisions come from plugin/app manifests rather than a central hard-coded enable map;
- required manifest-evaluation failure aborts boot instead of silently producing an incomplete plugin plan;
- load reasons and failed-plugin details are retained for diagnostics;
- optional missing-plugin failures are distinguished from required failures;
- staged package loading copies/links dependencies into a controlled staging tree and tracks dependency graphs/cycles;
- filesystem/user paths are redacted in diagnostics;
- source-staged workspace dependencies are explicit exceptions rather than general arbitrary source execution.

Masanawa destination:
- operator/plugin host and package quarantine/certification layer, never the domain kernel.

Disposition: **A/B — preserve explicit provenance, failure classification and staged-resolution safety; redesign host mechanics around Masanawa packaging**.

Acceptance gate:
- plugin discovery/enablement has an auditable reason;
- required plugin-plan evaluation fails closed;
- optional missing plugins degrade explicitly without being mistaken for healthy activation;
- package staging cannot escape the controlled root through symlinks;
- install/resolve remains an operator-authorized action, never an implicit model side effect.

## 15. SQL migrations and RLS mechanics

Implementation evidence:
- `plugins/plugin-sql/src/migration-service.ts`;
- `plugins/plugin-sql/src/rls.ts`;
- plugin SQL schema/runtime migrator families.

Pinned behavior:
- schema registration is plugin-scoped;
- migration service runs plugin schemas independently, records successes/failures and aggregates errors rather than pretending an all-success result;
- post-schema guards are installed;
- RLS can be re-applied after migration when data isolation is enabled;
- migration backend differences (PostgreSQL/PGlite) are explicit.

Masanawa boundary:
- useful migration/RLS failure handling is secondary evidence;
- eliza plugin-owned schemas must not define Masanawa identity/memory/world/workflow authority.

Disposition: **B for migration/RLS mechanics; C for domain schema ownership**.

Acceptance gate:
- canonical migrations are ordered/versioned and fail visibly;
- partial migration outcome cannot be reported as full success;
- RLS/policy re-application is verified after schema change where applicable;
- domain ownership is defined by Masanawa package migrations, not plugin presence.

## 16. View capability broker and human-only controls

Implementation evidence:
- `packages/core/src/types/plugin.ts` `ViewCapability` authority field;
- `packages/ui/src/components/views/view-capability-broker.ts`;
- `plugins/plugin-native-phone/src/view-capabilities.ts`.

Pinned behavior:
- view capabilities explicitly distinguish `agent` versus `human` authority;
- human-only capability declaration overrides generic grants;
- unknown/mutating capabilities fail closed unless the surface grants agent interaction;
- denial throws before the semantic handler/DOM operation and remains observable rather than becoming a silent no-op;
- Phone surface explicitly permits read-only `phone-state` to the agent while call placement, dialer opening and transcript persistence are human-only.

Masanawa destination:
- client/view capability policy in `packages/security` + perception/tools UI bridge.

Disposition: **A — preserve fail-closed human-vs-agent authority semantics**.

Acceptance gate:
- human-only UI actions cannot be driven by planner/tool calls;
- new mutating capabilities default denied;
- denied writes are surfaced as denied, never fabricated success;
- a client capability grant is still subordinate to canonical server authorization for consequential external actions.

## 17. Native/device bridge boundary

Implementation evidence:
- native plugin families such as `plugins/plugin-native-location/src/index.ts`;
- native phone capability declarations above;
- plugin/native bridge registrations across platform packages.

Pinned behavior:
- device functions are packaged as platform bridges and can expose web/native implementations behind a shared capability surface.

Masanawa boundary:
- native/device bridge is an adapter lane only;
- device state or bridge registration cannot become Character, memory, workflow or authorization truth.

Disposition: **B — preserve portable bridge pattern, rebind to Masanawa device-node/perception/tool permissions**.

Acceptance gate:
- device permissions are explicit and revocable;
- bridge absence/degradation is health state, not domain corruption;
- consequential device actions require current authorization and audit;
- local/native capability cannot bypass server-side policy just because the platform API exists.

## Updated unresolved descendant families

Still required before closure:
1. principal/membership/auth/disclosure implementation beyond the action gate;
2. representative SQL schema families and exact authority mapping;
3. bundled provider plugins and local/native inference fallback/readiness behavior;
4. bundled connector/channel plugins and outbound-delivery failure/idempotency behavior;
5. additional native/device actions beyond the view layer, especially computer use;
6. cloud/deployment credential/state ownership and recovery;
7. direct-test inventory for the consequential retained behaviors;
8. repository-wide descendant/file-family proof sufficient to show no production subsystem remains unexplained.


## 18. Authorization, membership and delivery audience

Implementation evidence:
- `packages/agent/src/security/access.ts` — agent-side checks delegate to canonical core role primitives rather than maintaining a second authorization implementation; malformed/missing context fails closed.
- `packages/core/src/roles.ts` — one role-rank source, auditable grant provenance, connector identity projection, privilege-escalation rules and fail-closed sender resolution.
- `plugins/plugin-sql/src/services/sql-membership.ts` — SQL-backed membership authority with tenant/scope checks, expected-generation fencing, idempotency keys, publisher generations, ordered evidence cursors, bounded validity and exact command validation.
- `packages/core/src/security/trusted-delivery-audience.ts`, `packages/core/src/access-control/audience-egress.ts`, `packages/core/src/access-control/provenance-envelope.ts` — turn/destination-bound disclosure evidence, canonical room/source provenance and fail-closed recall/egress checks.
- tests: `plugins/plugin-sql/src/__tests__/integration/membership-authority.real.test.ts`, `packages/core/src/security/trusted-delivery-audience.renewal.test.ts`.

Pinned invariants worth preserving:
- authorization helpers do not fork a second role hierarchy;
- missing/failed private-access resolution denies and reports;
- membership updates are tenant-scoped, generation-fenced and idempotent;
- membership evidence has bounded freshness rather than indefinite trust;
- delivery-audience evidence is turn/runtime/destination bound and must be revalidated after expiry or authority change;
- stored connector metadata is provenance evidence, not automatically an unforgeable identity attestation.

Masanawa destination:
- `packages/security` + canonical `packages/identity` relationship/account bindings;
- channel adapters supply evidence, never authority.

Disposition: **A for fail-closed/current-authority/idempotency/freshness invariants; B for data model; C for eliza world/role schema as canonical truth**.

Acceptance gate:
- role/membership resolution has one canonical policy source;
- stale membership evidence cannot authorize an action;
- owner/private disclosure is revalidated at use time;
- connector metadata cannot self-promote an identity;
- auth lookup failures deny consequential access and surface telemetry.

## 19. Connector ingress idempotency and provenance

Implementation evidence:
- `plugins/plugin-discord/__tests__/messages-inbound-idempotency.test.ts`;
- `plugins/plugin-discord/messages.ts`;
- `packages/core/src/access-control/provenance-envelope.ts`.

Pinned behavior proven by tests:
- duplicate inbound platform messages are suppressed within one manager;
- duplicate delivery remains suppressed after manager reconstruction when the inbound record was durably persisted;
- if processing failed before persistence, the same platform message remains retryable rather than being permanently poisoned by an in-memory dedupe guard;
- a direct-message delivery-audience attestation is created from canonical room state before dispatch and survives persistence;
- provenance dedupe includes source/account/room/platform-record identity rather than text alone.

Masanawa destination:
- gateway/channel ingress + canonical event/delivery idempotency evidence.

Disposition: **A — preserve durable inbound dedupe/retry semantics; B — normalize away eliza Memory authority**.

Acceptance gate:
- same provider event cannot produce two canonical turns after restart;
- failure before durable admission can retry;
- failure after durable admission resumes without duplicate downstream effects;
- dedupe scope includes account + destination + provider record ID;
- inbound provenance is retained for audit and disclosure policy.

## 20. Provider fallback and local/cloud routing

Implementation evidence:
- `packages/core/src/runtime/model-dispatch/dispatcher.ts`;
- `packages/core/src/runtime/__tests__/use-model-provider-fallback.test.ts`;
- `plugins/plugin-openai/index.ts`;
- `plugins/plugin-local-inference/src/services/cloud-fallback.ts`;
- `plugins/plugin-local-inference/src/services/router-dispatch.test.ts`;
- `plugins/plugin-local-inference/src/services/router-tts-fail-closed.test.ts`.

Pinned behavior:
- model handlers are capability-registered rather than hard-coded by provider;
- retryable provider errors may rotate to lower-priority handlers;
- non-retryable failures fail closed;
- pinned-provider requests are honored;
- local fallback classifies known recoverable local failures explicitly and lets unknown/programming failures surface;
- cloud fallback is registry-driven rather than hard-coded to a vendor;
- TTS/voice routing deliberately fails closed instead of silently switching to a different voice engine where voice identity would change.

Masanawa destination:
- `packages/providers` provider registry/health/routing.

Disposition: **A/B — preserve typed fallback classification/current policy and voice identity safeguards; redesign registry under Masanawa provider contracts**.

Acceptance gate:
- failover is per-capability and policy-constrained;
- non-retryable/programming failures are not hidden by fallback;
- pinned provider/voice constraints are honored;
- fallback path and reason are observable;
- local-to-cloud escalation obeys privacy/consent/data-residency policy.

## 21. Direct test evidence recorded

Consequential pinned tests now explicitly accounted for:
- `plugins/plugin-sql/src/__tests__/integration/membership-authority.real.test.ts` — publisher registration, complete-snapshot atomicity, bounded freshness, cursor fencing, restart and concurrent revocation;
- `packages/core/src/runtime/__tests__/use-model-provider-fallback.test.ts` — retryable rotation, non-retryable/TTS fail-closed and pinned-provider behavior;
- `packages/ui/src/components/views/view-capability-broker.test.tsx` — fail-closed mutation brokerage through the real view-interact path;
- `plugins/plugin-sql/src/__tests__/unit/plugin-init-error-policy.test.ts` — unexpected adapter-readiness failures cannot masquerade as missing-adapter replacement;
- `plugins/plugin-local-inference/src/services/router-dispatch.test.ts` — registry introspection dispatch;
- `plugins/plugin-local-inference/src/services/router-tts-fail-closed.test.ts` — no silent TTS provider rotation;
- `plugins/plugin-discord/__tests__/messages-inbound-idempotency.test.ts` — durable ingress dedupe/retry;
- `packages/core/src/security/trusted-delivery-audience.renewal.test.ts` — expiry renewal and invalidation on membership/ownership/destination/runtime changes.

These tests are evidence for specific retained behaviors, not proof that every elizaOS descendant is covered.

## Updated unresolved descendant families

Still required before closure:
1. representative outbound delivery semantics across connector implementations (Telegram/Discord/iMessage etc.), including ambiguous send outcomes and receipt persistence;
2. representative native/device action families beyond view brokerage, including computer-use/terminal/browser bridges;
3. cloud/deployment credential and durable-state ownership/recovery;
4. remaining SQL schema family classification so eliza identity/memory/world/task tables are explicitly C/B mapped rather than generically rejected;
5. repository-wide descendant/file-family proof sufficient to show no meaningful production subsystem remains unexplained.

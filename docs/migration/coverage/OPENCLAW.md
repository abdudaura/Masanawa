# Phase 0B Coverage — OpenClaw

Pinned revision: `openclaw/openclaw@83e4755b55e8864e48348f3eb2364ee3e5f0fb54`.

Status: **ACTIVE / PARTIAL**.

Canonical boundary: OpenClaw is Masanawa's primary Gateway/channel/device-node operating-layer donor and a secondary skill/session/current-authority donor. It is not Masanawa's kernel, public multi-tenant authorization boundary, Character identity source, memory authority, world authority or workflow engine.

## 1. Repository/runtime boundary

Pinned evidence:
- root `package.json` identifies OpenClaw as a multi-channel AI gateway with schema-versioned state/agent formats;
- `pnpm-workspace.yaml` spans root, UI, `packages/*`, `extensions/*` and examples;
- root distribution exposes a very broad plugin SDK surface covering channel ingress/outbound, approvals, sessions, devices/nodes, provider/model, memory host, browser, sandbox, realtime and state-worker families;
- README explicitly describes one Gateway as local control plane for sessions/tools/events/channels and supports shared team deployment.

Masanawa disposition: **B**.

Acceptance gate:
- Gateway/channel/device components normalize and route only;
- canonical user/Character/relationship/memory/world/workflow/business state remains outside OpenClaw;
- OpenClaw IDs are external references, never Masanawa authority.

## 2. Durable channel ingress, replay and crash recovery

Implementation/docs evidence:
- `docs/plugins/sdk-channel-plugins/durable-ingress.md`;
- channel-ingress/outbound/persistent-dedupe/ingress-effect-once SDK families;
- channel implementations/tests referenced by the durable-ingress guide.

Pinned behavior:
- enqueue raw transport envelope at one receive chokepoint;
- webhook/event ack is gated on durable append;
- polling/stream cursor or ack advances only after durable append;
- one serialized lane per conversation;
- completion tombstones rather than deleting the row, giving durable replay rejection for retention window;
- queue primary identity is `(queue_name,event_id)`;
- replay guards remain separate only when their logical identity or retention differs from queue event identity;
- state-worker reads/writes/migrations are awaited and competing records are rechecked in the write transaction;
- restart reopens the same account queue and recovers undispatched rows; no second reload replay path;
- queue purge for transport-identity replacement is transactional and current-authority checked;
- non-replay sockets still benefit from local crash recovery even when the provider cannot redeliver.

Masanawa destination:
- gateway durable ingress + canonical event admission.

Disposition: **A/B**.

Acceptance gate:
- provider ack never precedes durable canonical ingress admission when provider retry is available;
- duplicate provider delivery cannot create duplicate canonical turns after restart;
- restart resumes pending ingress from one canonical queue;
- identity reset/purge is atomic and authorized;
- ingress evidence carries account/conversation/provider record identity and scope.

## 3. At-least-once side effects and effect-once claims

Evidence:
- durable-ingress guide `createIngressEffectOnce(...)`.

Pinned behavior:
- dispatch side effects may happen before the ingress row is tombstoned;
- a crash in that window can replay the row;
- non-idempotent effects use stable event ID + effect name + namespace;
- durable once-claim commits only after the effect succeeds;
- thrown effect releases the claim for retry;
- concurrent callers wait for the active claim;
- persistence failure rejects instead of falling back to process-only memory;
- documentation explicitly admits a residual ambiguous window if the external effect succeeds but the durable effect claim cannot commit.

Masanawa disposition: **A — preserve explicit ambiguity/idempotency contract**.

Acceptance gate:
- every consequential ingress-triggered effect has canonical idempotency/reconciliation semantics;
- success-before-receipt ambiguity is never treated as safe blind retry;
- claim TTL/retention cannot expire before the associated replay window;
- persistence failure cannot silently downgrade to in-memory correctness.

## 4. Dynamic policy publication and current authority

Evidence:
- durable-ingress guide;
- runtime config reader/publication contracts.

Pinned behavior:
- new turn admission reads current committed runtime model config;
- account monitor derives coherent policy snapshot at each admission rather than retaining startup allowlists indefinitely;
- asynchronous authorization can return a synchronous `assert current` guard checked immediately before mutation/cancellation;
- mixed dynamic-policy and restart-required changes preserve atomic reload/drain behavior.

Masanawa disposition: **A/B**.

Acceptance gate:
- asynchronous policy preparation cannot authorize with a stale snapshot;
- current authority is reasserted immediately before consequential mutation;
- configuration publication is versioned/atomic;
- a low-risk dynamic policy path cannot accidentally make credentials/lifecycle settings hot-swappable without restart semantics.

## 5. Device pairing and uncertain credential delivery

Implementation evidence:
- `packages/gateway-protocol/src/schema/devices.ts`.

Pinned behavior:
- setup credential has an opaque non-secret `setupId` independent of bearer material;
- terminal `completion` records confirmed credential delivery;
- `deliveryUncertain` records bearer retirement where response delivery could not be confirmed;
- setup status reconciles the exact credential attempt by `setupId`;
- bearer material is not embedded in terminal status events;
- setup code creation is a high-privilege method and supports narrower bootstrap profiles;
- device-token rotation declares whether replacement token was delivered in-band or withheld for cross-device/admin rotation;
- token revoke and scope-upgrade request/result are explicit protocol operations.

Masanawa destination:
- device-node registry + security credential/authorization subsystem.

Disposition: **A/B**.

Acceptance gate:
- one-time bootstrap secret is never reusable after uncertain outcome;
- client can reconcile uncertain setup outcome without bearer recovery from logs/history;
- privileged device setup requires current canonical operator authority;
- role/scope/token rotation is explicit, revocable and audited;
- cross-device rotation never leaks replacement bearer to the wrong operator surface.

## 6. Node invocation retry boundary

Implementation/test evidence:
- `src/gateway/server-methods/nodes.invoke-wake.test.ts` and node invocation runtime family.

Phase 0A evidence plus pinned test family establishes the intended boundary:
- retry is narrow and tied to pre-execution node readiness/wake conditions;
- post-progress/disconnect/timeout/ambiguous execution is not a generic safe-retry condition;
- retry rechecks node connection/pairing/command authorization.

Masanawa destination:
- device-node tool adapter + workflow reconciliation.

Disposition: **A/B**.

Acceptance gate:
- a device command may retry only when execution is proven not to have started or provider idempotency proves replay safe;
- ambiguous node effects become reconciliation state;
- every retry revalidates current pairing/scopes/tool authorization.

## 7. Durable approvals and current-authority persistence

Implementation evidence:
- `src/gateway/exec-approval-lifecycle.ts`;
- `src/gateway/operator-approval-store.ts`;
- approval result/recovery/state-worker families.

Pinned behavior:
- in-memory lifecycle observes but does not own durable approval truth;
- observers cannot change durable verdict;
- storage operations capture admission authority and reassert current authority after FIFO wait and before worker/native commit;
- native commit receipt can be published even when command reply is lost;
- terminal decisions are reconciled from durable store;
- observer close/manager retirement does not invent an approval verdict;
- pending entries retain uncertain verdict/current-authority guards across retries;
- allow-once has explicit durable consumption semantics;
- terminal approval history is queryable.

Masanawa destination:
- `packages/security` approval authority + `packages/workflows` pending approval state.

Disposition: **A**.

Acceptance gate:
- first committed durable verdict is canonical;
- stale authority cannot commit after async wait/preparation;
- command reply loss after durable commit cannot cause a second decision;
- manager/process retirement does not resolve a pending request by implication;
- allow-once consumption is atomic/idempotent;
- terminal history is auditable.

## 8. Shared Gateway trust-boundary mismatch

Evidence:
- `docs/gateway/security/access-control.md`;
- session visibility/access code under `src/plugin-sdk/session-visibility.ts` and `src/agents/tools/sessions-access.ts`;
- QA scenarios for cross-agent session sends.

Pinned documented boundary:
- default DM context can be one shared main session for personal-assistant continuity;
- multi-user deployments should explicitly isolate DM scope;
- the docs state session/message-context isolation is **not** a hostile host-admin boundary and recommend separate Gateways for mutually adversarial users;
- context visibility is separate from trigger authorization;
- command authorization can follow channel allowlists/pairing, with open allowlists effectively opening commands.

Masanawa disposition: **C as public authorization boundary; B as trusted-team Gateway bridge pattern**.

Acceptance gate:
- public Masanawa tenants/users never rely on OpenClaw session visibility as security isolation;
- every normalized channel input is re-authenticated/re-authorized by Masanawa;
- cross-session/cross-agent operations require canonical relationship/tenant policy;
- context visibility cannot substitute for trigger/tool authorization.

## 9. Managed skill revisions and session pinning

Evidence:
- `docs/tools/skills.md`;
- skill library/revision/runtime families.

Pinned behavior:
- deterministic multi-root source precedence is separate from per-agent visibility allowlists;
- invalid skills are isolated while valid siblings remain usable;
- managed skill revision hash includes portable paths, exact content, sizes and executable flags;
- identical save is a no-op;
- stale edit conflicts instead of overwriting a newer revision;
- sessions retain selected skill IDs and exact revisions;
- publishing/removing/disabling a skill does not silently rewrite an already pinned session revision;
- immutable bundles are bounded by file/count/aggregate size limits;
- managed library ownership/sharing governs management/discovery, **not** tool/credential/host authorization;
- node-hosted skills exist only while node is connected and are namespaced on collision.

Masanawa destination:
- `packages/skills` revision/distribution/session-selection subsystem.

Disposition: **A/B**.

Acceptance gate:
- certified skill version is immutable/content-addressed;
- session pins exact revision;
- stale write conflicts;
- visibility/source precedence never grants tool authority;
- executable skill scripts still pass canonical tool/sandbox/approval policy;
- dynamic node skill disappearance does not erase durable certified skill history.

## Current unresolved descendant families

Before OpenClaw can be marked covered, the remaining gaps are now limited to:

1. exact direct-test inventory proving every retained consequential invariant has pinned implementation/test evidence;
2. repository-wide descendant proof with zero unexplained production families after the above closure.

The repository/package/plugin enumeration gap is closed by `OPENCLAW-INVENTORY.md` (18/18 maintained packages; 163/163 generated plugin inventory entries; zero enumeration ambiguity). Gateway RPC, approvals, steering/restart, provider, memory, scheduler, SSRF/privacy, session lineage, outbound delivery, session catalog/import/attachment handling, and broad skill-source/node-host behavior are covered in the sections below.

Do not advance to OpenClaw Agent Skills until these remaining gaps are closed.


## 10. Tool policy, sandbox and elevated execution

Implementation/docs evidence:
- `docs/gateway/sandbox-vs-tool-policy-vs-elevated.md`;
- exec/tool policy runtime families under `src/agents` and policy extension.

Pinned behavior:
- sandbox decides where a tool runs;
- tool policy decides whether a tool exists/is callable;
- elevated is an exec-only escape from ordinary sandboxing and does not grant tools;
- deny always wins;
- a non-empty allowlist blocks everything not listed;
- `/exec` cannot override a denied exec tool;
- creator-role-required sandbox cannot be bypassed by elevated or host override and fails closed if sandbox provision fails;
- bind sources are validated before and after resolving existing ancestors so symlink-parent escapes cannot bypass blocked/allowed-root checks;
- tool-name policy alone does not make shell execution read-only.

Masanawa destination:
- `packages/security` + `packages/tools` sandbox/tool admission.

Disposition: **A/B**.

Acceptance gate:
- execution-location policy and capability authorization remain separate;
- deny/current-role requirements dominate local session overrides;
- privileged/elevated mode cannot mint tool permission;
- symlink/ancestor resolution cannot escape filesystem scope;
- shell capability is treated as broad consequential authority, not inferred safe from denial of higher-level file tools.

## 11. Plugin inventory, hot replacement and resource ownership

Implementation/docs evidence:
- `docs/plugins/architecture.md`;
- `docs/plugins/sdk-runtime/state-and-system.md`;
- Gateway startup/maintenance plugin lifecycle families.

Pinned behavior:
- Gateway retains one prepared plugin inventory/cache generation;
- runtime readers reuse one published inventory rather than cold-discovering independently;
- install/update/remove/source changes prepare a new inventory before publication;
- candidate metadata is validated before draining affected services/channels;
- unchanged plugin instances are retained;
- previous registration is stopped/disposed before replacement acquires its resources;
- failure before publication attempts recovery from captured previous code/config rather than newly changed package files;
- replacement waits for admitted/retained work and cleanup; deadline failure leaves previous generation serving instead of force-disposing writes;
- publication and runtime methods/metadata move together;
- failure after publication reports the committed generation and attempts explicit recovery;
- shutdown closes admission, joins retained cleanup and reports cleanup failures before shared DB closure;
- plugin-scoped SQLite stores are durable, namespace-isolated and support atomic register-if-absent / compare-and-apply;
- ownership/current-authority assertions can be carried through worker preparation/admission before plugin-state writes.

Masanawa destination:
- `packages/plugins` + runtime supervisor + security/state adapters.

Disposition: **A/B**.

Acceptance gate:
- one published plugin registry generation is authoritative per runtime;
- hot replacement never runs old/new callbacks concurrently against the same exclusive resource without explicit version ownership;
- failed candidate activation cannot silently strand partial registrations;
- previously admitted work may drain, but retired generation cannot accept new work;
- current-authority mutation checks survive async worker queues;
- plugin state cannot become Character/memory/workflow/business truth merely because it is durable.

## 12. Queue steering and transcript commitment

Implementation/docs evidence:
- `docs/concepts/queue.md`;
- `docs/plugins/codex-harness-runtime/queue-and-feedback.md`.

Pinned behavior:
- queue modes distinguish steer, follow-up, collect and interrupt;
- steering targets the current run where the runtime supports it;
- if steering cannot be accepted, the full input remains eligible as follow-up rather than disappearing;
- steer does not imply aborting in-flight tools;
- transcript-commit acknowledgment is distinct from request acceptance and distinct again from a later model having read the input;
- input sent without confirmed transcript commit is not automatically replayed;
- confirmed history items retain identities so later steers do not duplicate them;
- pending question answers are checked against the question creator's current permissions and active run;
- uncertain question-answer commit is reported as uncertainty and is not automatically resent;
- queued-turn cancellation retains a Gateway-owned cancel identity per run and checks requester ownership.

Masanawa destination:
- agent/session turn-control + workflow-safe input admission.

Disposition: **A/B**.

Acceptance gate:
- steer/follow-up/collect/interrupt remain distinct typed intents;
- steering cannot authorize replay/undo of already-started consequential effects;
- accepted input, transcript-committed input and model-consumed input are separate states;
- uncertain commit enters reconciliation rather than automatic replay;
- queued cancellation is requester/current-authority scoped.

## 13. Restart recovery, write custody and durable ownership

Implementation/docs evidence:
- `docs/gateway/restart-recovery.md`;
- session/delivery/cron/subagent/restart-sentinel state families.

Pinned behavior:
- conversations, transcripts, accepted browser follow-ups, interrupted main-session turns, subagent records, outbound deliveries, cron schedules and restart continuation are durable;
- PTY processes are explicitly not recovered;
- browser reconnect reconciles saved receipt before resubmitting and never reuses old execution authority;
- output-persistence failure does not make consumed input automatically replayable;
- uncertain submission remains unconfirmed until reconciled or explicitly retried;
- detached child completion recovery retains exact source completion/requester-session claims and does not restart the child merely because the old monitor disappeared;
- contradictory/missing source ownership does not authorize replay;
- failed outbound delivery settlement can resume without resending when payload already exhausted retry/failure state;
- graceful restart first fences new admission and drains admitted work;
- read-only waiters can disconnect/retry while underlying durable run/approval/write continues;
- maintenance exposes write-custody phases distinct from generic active work.

Masanawa destination:
- runtime supervisor + `packages/workflows` + gateway outbox/recovery.

Disposition: **A/B**.

Acceptance gate:
- every admitted durable operation has explicit recovery ownership;
- restart cannot reuse stale request authority;
- consumed input is not replayed because output persistence failed;
- terminal external effect settlement can resume without repeating the effect;
- recovery requires original lineage/ownership evidence;
- graceful restart fences admission before drain and preserves already-admitted write custody.

## 14. SQLite integrity/quarantine boundary

Implementation/docs evidence:
- `docs/reference/database-schemas/integrity-and-recovery.md`;
- `src/state/openclaw-state-schema.sql`;
- database preflight/backup/doctor/recovery families.

Pinned behavior:
- writable agent admission validates schema metadata and conditionally performs integrity/foreign-key checks;
- corruption or FK violations fail admission into quarantine;
- pending migrations/repairs/backup verification use full checks;
- clean-close/runtime verification is bound to physical file identity and can be revoked;
- failed dirty-marker publication refuses open rather than reusing stale clean proof after crash;
- database replacement/quarantine/failed admission discards verification;
- ownership/current write authority is not inferred from integrity success;
- independent Gateways must not share mutable agent databases across state directories.

Masanawa disposition:
- **B** for integrity/quarantine/repair mechanics;
- **C** for OpenClaw SQLite files as Masanawa canonical domain persistence.

Acceptance gate:
- canonical PostgreSQL migrations/readiness include integrity/version/ownership checks appropriate to the DB;
- corruption/readiness failure quarantines unsafe state rather than serving it;
- clean-shutdown evidence cannot override current authorization/ownership;
- backup/restore/migration verification is explicit and observable.


## 15. Provider/model and credential-egress boundary

Implementation/docs evidence:
- `docs/plugins/sdk-provider-plugins/runtime-hooks.md`;
- `docs/plugins/sdk-runtime/models.md`;
- provider SDK/runtime families.

Pinned behavior:
- model route intent is prepared secret-free consumer intent; plugins do not reload config/credentials to reconstruct policy;
- route preference can rank already-eligible auth classes but cannot manufacture a credential or make an unavailable/cooldown-blocked profile eligible;
- candidate model order and credential precedence are separate concerns;
- request cancellation can end a caller's wait for queued auth/profile/OAuth work without pretending an already-owned credential refresh write was cancelled;
- built-in text transports keep SDK-internal retries disabled and let the embedded runner own retry budgeting;
- streaming wrappers are discouraged from injecting their own retry count;
- provider hooks explicitly classify failover reasons and can declare custom transport/auth/model normalization without owning canonical session identity;
- command-scoped configured-model egress uses a destination-bound credential sentinel/proxy; credentials stay on the credential-owning host and output redaction covers secrets split across chunks;
- proxy/credential access is revoked on cancellation, callback completion or failure.

Masanawa destination:
- `packages/providers` + `packages/security` credential egress.

Disposition: **A/B**.

Acceptance gate:
- provider/model routing never reconstructs secret policy independently of canonical configuration;
- provider retry is error/operation/stream aware and centrally observable;
- credential refresh ownership survives caller cancellation correctly;
- destination-bound secret egress cannot be reused outside its authorized provider endpoint/operation;
- remote provider thread/session IDs remain external references only.

## 16. Memory provenance, dreaming and recall boundary

Implementation/docs evidence:
- `docs/concepts/memory-architecture.md`;
- memory-core/memory-host packages and direct tests located under `extensions/memory-core`, `packages/memory-host-sdk`, and QA runtime tests.

Pinned behavior worth preserving:
- write-time provenance is treated as the security boundary;
- deterministic eligibility gates surround model judgment;
- origin class is a closed set such as owner/agent/untrusted/system, with unknown external content classified conservatively rather than promoted to owner;
- cron, heartbeat and subagent sessions do not automatically produce long-term memory candidates;
- content recalled from memory is structurally marked so recall does not recursively re-extract itself;
- declared network-derived tool output taints subsequent assistant text in that turn as untrusted for memory promotion;
- episodic evidence reaches curated core only through deterministic promotion gates;
- untrusted/system candidates are excluded before consolidation prompt construction;
- pre-compaction memory flush preserves unsummarized context before compaction;
- consolidation performs merge/supersession/dedupe with optimistic-concurrency check before atomic replacement;
- rejected/oversized consolidation does not clobber the existing curated core;
- reply-path memory failures degrade recall rather than blocking the reply.

Masanawa boundary:
- OpenClaw files/SQLite/indexes are **not** canonical memory.
- `packages/memory` remains sole authority per ADR-0007.

Disposition: **A/B for provenance/lifecycle behavior; C for storage/authority model**.

Acceptance gate:
- every memory fact carries provenance/scope/time/supersession evidence;
- untrusted/system/automation evidence cannot silently promote to durable curated memory;
- recalled content cannot feed a positive feedback extraction loop;
- consolidation is version/CAS fenced;
- memory degradation cannot corrupt or suppress an otherwise valid turn;
- memory projections/indexes remain rebuildable from canonical records.

## 17. Cron, heartbeat and proactive execution boundary

Implementation evidence:
- `src/cron/service/state.ts`;
- `src/infra/heartbeat-runner-run.ts`;
- heartbeat scheduler/test families;
- `src/infra/state-migrations.cron-run-logs.ts`.

Pinned behavior:
- cron service tracks durable next-run state, lifecycle generation, scheduling pause/startup catch-up and a shared admission bound across scheduled/manual/on-exit work;
- stopping rotates lifecycle generation so stale queued work cannot revive under the next service instance;
- queued runs have durable reservation/receipt custody;
- missed jobs are bounded/staggered on restart instead of exploding simultaneously;
- execution/delivery uses attempt fences and terminal settlement callbacks;
- service mutations are serialized;
- heartbeat wake/preparation can skip explicitly; once work has been admitted, later skips preserve occurrence/lifecycle facts rather than pretending nothing happened;
- legacy cron run history migrates transactionally into generic `task_runs`, avoiding duplicate mirrored identities before dropping the old table.

Masanawa destination:
- `packages/workflows` durable scheduler/automation;
- heartbeat/proactivity becomes a trigger type, not a second job engine.

Disposition: **A/B for scheduler/recovery invariants; C for OpenClaw cron as canonical business workflow authority**.

Acceptance gate:
- every scheduled occurrence has durable identity/attempt/settlement state;
- lifecycle generation fences stale queued work across restart;
- restart catch-up is bounded and observable;
- delivery/side effects use the same idempotency/reconciliation rules as other workflows;
- heartbeat/proactivity cannot create an alternate durable task source of truth.

## 18. SSRF/network egress policy

Implementation/test evidence:
- `src/infra/net/ssrf.ts`;
- `src/infra/net/fetch-guard.ts`;
- `src/infra/net/fetch-guard.ssrf.test.ts`.

Pinned behavior:
- blocked network classes include loopback/link-local/cloud metadata/special-use IP forms unless explicitly authorized by policy;
- hostname/origin allow/deny policy is normalized deterministically;
- HTTP base-url exceptions are scoped to explicit hostname/origin;
- allowed-origin trust is recalculated per URL in the redirect loop rather than inherited blindly across redirects;
- DNS resolution is part of the policy enforcement boundary rather than relying only on the original hostname string;
- private-network relaxations are explicit dangerous capabilities;
- guarded fetch owns dispatcher cleanup and cancellation.

Masanawa destination:
- `packages/security` network policy + tools/provider HTTP adapters.

Disposition: **A/B**.

Acceptance gate:
- every server-side URL fetch performs DNS/IP/redirect-aware SSRF validation;
- redirect cannot escape an origin/host exception;
- metadata/loopback/private ranges fail closed unless a narrowly scoped policy explicitly allows them;
- proxy/custom dispatcher use cannot bypass the same effective network policy;
- policy exceptions are auditable by capability owner.

## 19. Secret storage, redaction and diagnostic privacy

Implementation/docs evidence:
- `docs/gateway/security/secrets-and-storage.md`;
- `docs/gateway/secrets/runtime-model.md`;
- `docs/gateway/logging.md`;
- `docs/gateway/diagnostics.md`;
- `docs/gateway/telemetry.md`;
- `docs/gateway/opentelemetry/privacy-and-trace-context.md`.

Pinned behavior:
- secret references distinguish active vs inactive runtime surfaces and active unresolved references can fail startup/reload rather than silently yielding an unusable runtime;
- command/provider secret egress is scoped to an explicit destination/operation;
- diagnostic bundles are local, approval-gated from chat and redact/omit prompts, chat text, tool output, credentials, raw request bodies, account/message/session identifiers, hostnames and usernames;
- group-chat diagnostics deliver sensitive result/approval details privately to the owner rather than echoing them into the group;
- anonymous feature statistics are opt-in and separate from the default update check;
- OpenTelemetry raw model/tool content is disabled by default;
- enabling OTel content capture is explicit and still excludes system prompts/provider private thinking payloads;
- inbound WebSocket `traceparent` is accepted only after authentication and never influences authorization;
- outbound provider trace ancestry uses exporter-owned span context rather than caller-supplied spoofable headers.

Masanawa destination:
- security/vault, telemetry and support-diagnostics subsystems.

Disposition: **A/B**.

Acceptance gate:
- secrets are references/capabilities, not copied into ordinary logs/config projections;
- active missing secret fails the relevant runtime surface visibly;
- diagnostics content release requires explicit authority and uses privacy-safe recipient routing;
- raw prompt/tool content is opt-in in telemetry;
- trace context is provenance only, never authorization;
- external/caller trace headers cannot forge provider-side trust ancestry.


## 20. Gateway handshake, RPC scopes and closed worker protocol

Implementation/docs evidence:
- `docs/gateway/protocol/handshake.md`;
- Gateway method policy/operator-scope families;
- node pairing authorization tests.

Pinned behavior:
- authenticated hello reports negotiated role/scopes separately from client capability claims;
- capabilities describe presentation/runtime support, not authorization;
- operator method scopes are closed/core-defined and some reserved method prefixes force administrator scope;
- method scope is only the first gate; individual operations may impose stricter current-resource checks;
- node pairing approval validates the pending node's declared commands/scopes at approval time;
- node-declared capabilities/commands remain claims and are intersected with server-side policy;
- worker mode uses a separate closed protocol and route that never dispatches general operator/node/plugin methods;
- worker credential is bound to environment, bundle hash, owner epoch, RPC-set version, expiry and optional session;
- transcript commits use owner-epoch fencing, gateway-owned session binding, base-leaf CAS and durable replay sequence;
- each worker RPC rechecks ownership and expiry.

Masanawa destination:
- gateway protocol/security + worker/device execution adapters.

Disposition: **A/B**.

Acceptance gate:
- capability advertisement never grants authorization;
- method-scope policy and resource/current-authority checks compose, with the stricter rule winning;
- worker/node protocol surfaces are closed allowlists;
- worker transcript/state mutation is fenced by canonical run/session generation and CAS;
- reusable credentials are bound to role/scope/device/environment and revocable.

## 21. Agent bindings and routing are not authorization

Evidence:
- `docs/concepts/agent-bindings.md`;
- channel routing/binding runtime.

Pinned behavior:
- a binding selects the agent only after the channel has already admitted the message;
- it does not create channel accounts and does not grant sender access;
- matching is deterministic by specificity, then config order within a tier;
- an omitted account ID means the default account, while wildcard is explicit;
- missing/ambiguous owner in explicit multi-agent mode returns an agent-selection error rather than silently falling back;
- ACP persistent bindings have a distinct concrete conversation identity contract.

Masanawa destination:
- gateway routing -> canonical Agent/Character runtime binding after identity/channel authorization.

Disposition: **A/B**.

Acceptance gate:
- routing selection never substitutes for sender/tenant/tool authorization;
- ambiguous ownership fails closed instead of picking an arbitrary agent;
- routing precedence is deterministic and observable;
- route changes cannot rewrite historical canonical relationship identity.

## 22. Session/subagent/ACP lineage and authority

Implementation/test evidence:
- `src/gateway/session-create-service.ts`;
- `src/agents/subagents/spawn/subagent-spawn.ts`;
- `src/agents/subagents/spawn/acp-spawn.authority.test.ts`;
- `docs/plugins/sdk-agent-harness/sessions-and-results.md`;
- session create/recovery/child-custody tests.

Pinned behavior:
- session creation is a lifecycle operation that resolves owner/agent/workspace/model selection, writes session/transcript state and publishes creation effects under one admitted operation;
- parent-fork/session selection inheritance is explicit rather than reconstructed from an arbitrary child key;
- subagents/ACP runs retain requester/parent/child lineage and admitted delegated authority;
- spawn authority tests exercise real admitted-run delegated authority and Gateway tool caller identity rather than only string parent IDs;
- persistent ACP/bound conversations are not authorized solely because a binding exists;
- restart recovery requires retained assignments/requester identity/lifecycle/connection evidence; native lineage alone cannot reconstruct an unrecorded obligation.

Masanawa destination:
- `packages/agents` execution instances + `packages/workflows` child tasks/handoffs + canonical identity/relationship authorization.

Disposition: **A/B for lineage/custody; C for OpenClaw session IDs as Character/relationship authority**.

Acceptance gate:
- child run records parent/requester/run generation and delegated authority explicitly;
- stale parent/connection/generation cannot adopt a child completion;
- spawning a child cannot expand authority beyond the delegating principal/run;
- session creation and initial transcript publication are atomic/idempotent enough for retry/recovery;
- provider/native session binding never becomes canonical user/Character identity.

## 23. Outbound delivery idempotency and timeout reconciliation

Implementation/docs evidence:
- `docs/plugins/sdk-channel-outbound.md`;
- `src/infra/outbound/message-action-execution.ts`;
- channel-specific send paths/tests.

Pinned behavior:
- every gateway message action can carry a stable idempotency key;
- delivery authority/current handoff is checked before attempts and after async preparation;
- a caller-side timeout after request transmission does not prove the provider send failed;
- timed-out sends reattach once to the same Gateway operation using the unchanged idempotency key instead of issuing a fresh send;
- reconciliation has its own bounded wait;
- confirmed pre-dispatch Gateway rejection may cancel a pending terminal receipt, while ambiguous provider/runtime failures preserve uncertainty;
- partial delivery is typed and retains accepted receipt evidence;
- queued delivery explicitly tells the caller that the Gateway owns retry/reconciliation and must not be resent;
- terminal source-reply intent is made durable before send and reconciliation failure returns provider result without inviting model replay.

Masanawa destination:
- gateway outbox/delivery reconciliation + `packages/workflows` side-effect receipts.

Disposition: **A**.

Acceptance gate:
- timeout after dispatch never causes a fresh non-idempotent provider send;
- retry/join uses the same canonical delivery operation/idempotency key;
- partial/queued/unknown/confirmed-rejected outcomes remain distinct;
- current authorization is rechecked immediately before delivery;
- provider acceptance/receipt survives local settlement failure so recovery can settle without duplicate visible delivery.


## 24. Session catalogs, imports and attachment custody

Implementation/docs evidence:
- `docs/nodes/session-catalogs.md`;
- `src/gateway/server-methods/session-catalog-list.ts`;
- `src/gateway/server-methods/session-catalog-list-admission.test.ts`;
- `src/gateway/server-methods/session-catalog-provider-access.test.ts`;
- `src/gateway/server-methods/session-catalog-list-lifetime.test.ts`;
- `src/gateway/server-methods/chat-send-attachments.ts`;
- `src/gateway/server-methods/chat-send-attachments.owner.test.ts`;
- `src/gateway/server-methods/chat-send-attachments.cancel.test.ts`;
- managed attachment authority/custody tests under `src/gateway/managed-image-attachments*.test.ts`.

Pinned behavior:
- catalog providers are independently budgeted; one slow/failed provider may return bounded pending/stale cached projection while other providers remain usable;
- catalog delivery rechecks current config, caller visibility and current local-session identity after asynchronous provider work rather than trusting the provider's planning snapshot;
- catalog read/list requires read authority; continue/import/archive requires write authority, with multi-user visibility scoped to the authenticated actor;
- imported transcripts are bounded projected copies with explicit source provenance and an untrusted-reference notice; re-import of the same source identity updates the same imported session and appends only unseen projected items;
- revocation stops future copying but does not erase already committed imported content;
- native catalog/session IDs remain external references and do not become canonical Character/relationship identity;
- attachment preparation is owner/workspace isolated, rechecks admission/current authority around async staging, and transfers custody only to a persisted transcript or pending input;
- cancellation/failure cleanup keeps admitted write custody until temporary inbound media is actually discarded, preventing a late abort/retry from reusing abandoned media;
- managed-PDF cancellation cannot silently fall back to a host path; ordinary non-cancellation failure preserves its typed attachment failure classification.

Masanawa destination:
- gateway external-session catalog/projection adapter;
- `packages/agents` execution-session references only;
- gateway/perception attachment staging + canonical transcript/workflow custody.

Disposition: **A/B**.

Acceptance gate:
- external/native session discovery is caller-authorized on every delivery and cannot become identity authority;
- slow/failed catalog providers degrade independently without exposing stale rows to a caller who no longer has visibility;
- import is bounded, provenance-carrying and idempotent for the same external source identity;
- imported content is explicitly non-authoritative until promoted by canonical Masanawa memory/world rules;
- attachment bytes are isolated by canonical owner/workspace and every staged artifact has exactly one terminal custody path: persisted/adopted or deleted;
- cancellation/timeout cannot turn an uncommitted attachment into a replayable or host-path side effect.

## 25. Skill source installs, ClawHub trust and node-hosted projections

Implementation/docs evidence:
- `docs/tools/skills.md`;
- `docs/nodes/mcp-and-skills.md`;
- `src/skills/lifecycle/source-install.test.ts`;
- `src/gateway/server-methods/skills.clawhub.test.ts`;
- `src/infra/clawhub-skill-security.test.ts`;
- `src/skills/runtime/remote-skills.ts`;
- `src/skills/runtime/remote-skills.test.ts`;
- `src/skills/runtime/remote-reconciliation.test.ts`;
- node-host runtime/inventory tests under `src/node-host/*.test.ts`.

Pinned behavior:
- local/git/registry skill installation validates the actual `SKILL.md` before publication, enforces byte/path/link constraints, records resolved git commit provenance and strips repository metadata from installed content;
- git source execution is isolated from inherited Git hook/config state and rejects clone-option injection;
- ClawHub security results are correlated by exact slug + publisher owner + version; owner/version mismatches fail closed even when a registry reports a superficially clean result;
- concurrent identical ClawHub install requests dedupe to one underlying install operation across reconnect/retry;
- trust-blocked ClawHub installs return typed trust details rather than silently forcing installation;
- node-hosted skills are ephemeral projections: present only while the publishing node is current/connected, hidden when the node/session cannot execute there, and removed on disconnect/generation mismatch;
- local skill names win collisions; remote collisions receive deterministic node-prefixed names;
- remote skill content is parsed/validated, content-hashed and locator-bound; malformed frontmatter is dropped;
- node-hosted skill frontmatter cannot directly dispatch a tool to bypass canonical execution policy.

Masanawa destination:
- `packages/skills` source/import/provenance adapters;
- `packages/security` skill trust/admission;
- device-node skill projection behind canonical tool/exec authority.

Disposition: **A/B**.

Acceptance gate:
- every external skill import records immutable source provenance (registry/publisher/version or git URL/ref/resolved commit) before certification;
- identity/version/security-verdict mismatch fails closed;
- retries/reconnects cannot create duplicate installs for the same idempotent install operation;
- imported executable resources are revalidated at certification/use time and do not inherit ambient host Git/shell authority;
- node-hosted skills are derived availability projections, never durable certified-skill truth;
- disconnect, pairing-generation change or loss of exec-node authority removes remote skill availability immediately;
- skill visibility/source trust never grants tool, credential, filesystem or node execution authority.

The remaining skill-specific Phase 0B gap is direct Workshop/Custodian descendant/test closure; managed revision/session pinning, generic source installs, ClawHub trust behavior and node-hosted skills are now evidenced.


## 26. Channel lifecycle, presentation feedback and carrier-specific recovery

Generic implementation/docs/tests:
- `docs/plugins/sdk-channel-plugins/status-and-media.md`;
- `src/plugin-sdk/channel-lifecycle.test.ts`;
- `src/channels/typing-lifecycle.test.ts`;
- `src/infra/heartbeat-runner.typing.test.ts`.

Major bundled-carrier direct evidence at the pinned revision:
- WhatsApp: `extensions/whatsapp/src/inbound/durable-receive.test.ts`, `extensions/whatsapp/src/channel.status.test.ts`;
- Telegram: `extensions/telegram/src/channel.gateway.test.ts`, `extensions/telegram/src/telegram-ingress-drain.test.ts`;
- Discord: `extensions/discord/src/monitor/message-handler.ingress-recovery.test.ts`, `extensions/discord/src/monitor/thread-bindings.authority.test.ts`;
- Slack: `extensions/slack/src/monitor/ingress.test.ts`, `extensions/slack/src/monitor/message-handler/prepare.route-owner-admission.test.ts`;
- Signal: `extensions/signal/src/monitor/event-handler.ingress-lifecycle.test.ts`;
- Matrix: `extensions/matrix/src/matrix/monitor/sync-lifecycle.test.ts`;
- LINE: `extensions/line/src/webhook-spool.test.ts`, `extensions/line/src/monitor.lifecycle.test.ts`;
- iMessage: `extensions/imessage/src/monitor.watch-subscribe-retry.test.ts`.

Pinned generic behavior:
- account lifecycle remains pending while active and joins abort/cleanup; readiness/startup failures settle the account task rather than leaking a detached monitor;
- lifecycle/status is account-scoped; transport state distinguishes ready/recovering/blocked/stopped/error where supported;
- typing keepalive has one active provider tick across stop/restart, begins before work, refreshes while work is active and clears exactly once on success or failure;
- media limits and local media roots come from resolved account/session authority, never from an untrusted requested path;
- grouped media/payload sends are opt-in and reassert the current delivery owner immediately before each physical provider send;
- an ambiguous send is not a receipt; follow-up actions such as pinning carry the existing delivery-owner assertion and cannot reuse expired authority.

Carrier-specific retained deltas:
- WhatsApp requires a native message ID, retains durable queue claims until turn adoption, preserves per-chat receive order through debounce/merge and bounds completion/failure replay guards;
- Telegram marks invalid credentials as terminal blocked startup, rejects ambiguous multi-agent account ownership before monitor start, preserves identity/cursor state selectively across config changes, and classifies recipient-unreachable failures separately from retryable flood/permission failures;
- Discord preserves retry facts across cancellation/monitor replacement and binds accepted thread creation to current owner authority without losing already accepted native-create settlement;
- Slack never acknowledges before durable append, recovers uncompleted rows after restart, tombstones delayed provider redelivery, keeps channel-ID migration ordered with message lanes and revalidates reply ownership after routing;
- Signal fans merged/debounced turns into the constituent durable claim lifecycles so every source claim reaches the same adopted/failed terminal fact;
- Matrix distinguishes intentional shutdown from fatal sync stop/error and will not downgrade a recorded fatal error during later shutdown noise;
- LINE acknowledges signed HTTP webhook input only after durable admission, routes shared paths by account signature, rejects ambiguous signatures, recovers uncompleted spool rows exactly once, bounds retry and dead-letters permanent/auth/post-side-effect failures;
- iMessage distinguishes transient startup recovery from terminal permission failure, bounds watch-subscribe retries, and redacts message/conversation identifiers from recovery diagnostics.

Masanawa destination:
- canonical Gateway ChannelAccount runtime/readiness projection;
- gateway durable ingress/outbox and channel adapters;
- security current-authority policy;
- perception/media attachment policy;
- telemetry privacy-safe channel diagnostics.

Disposition: **A/B**.

Acceptance gate:
- no provider ack/cursor advancement precedes durable ingress admission when replay is available;
- account lifecycle exposes typed recoverable versus terminal failure without orphaning startup/drain work;
- carrier retry occurs only while the provider-specific operation remains safely retryable; post-effect ambiguity is reconciled, not blindly replayed;
- routing/thread/account selection cannot grant sender or tool authority and ambiguous ownership fails closed;
- typing/status are presentation facts only and cannot become authorization/session truth;
- media path/root and grouped-send authority are host-derived and rechecked at provider-I/O boundaries;
- restart/config replacement preserves accepted durable work and its retry/settlement facts without duplicate visible effects.

The channel-specific descendant gap is closed for the shared framework and the major bundled carrier families above. Remaining external plugins stay classified by the generated plugin inventory and must conform to these canonical adapter contracts; they do not create separate authority.


## 27. Native apps, node capability publication and route-authority fencing

Implementation/docs/tests:
- `docs/nodes/device-commands.md`;
- `docs/nodes/command-policy.md`;
- `docs/platforms/android.md`;
- `docs/platforms/ios.md`;
- `src/gateway/node-command-policy.test.ts`;
- `src/gateway/node-registry.test.ts`;
- `src/gateway/node-registry-policy.test.ts`;
- `src/gateway/node-connect-reconcile.test.ts`;
- `src/gateway/device-scope-upgrade.test.ts`;
- `src/gateway/android-node.capabilities.required-commands.test.ts`;
- `src/gateway/android-node.capabilities.live.test.ts`;
- `apps/android/app/src/test/java/ai/openclaw/app/node/ConnectionManagerTest.kt`;
- `apps/android/app/src/test/java/ai/openclaw/app/node/InvokeDispatcherTest.kt`;
- `apps/android/app/src/test/java/ai/openclaw/app/GatewayBootstrapAuthTest.kt`;
- `apps/android/app/src/test/java/ai/openclaw/app/gateway/GatewaySessionReconnectTest.kt`;
- `apps/shared/OpenClawKit/Tests/OpenClawKitTests/GatewayNodeSessionTests.swift`;
- `apps/ios/Tests/GatewayConnectionControllerTests.swift`;
- `apps/ios/Tests/GatewayOperatorFleetTests.swift`;
- `apps/macos/Tests/OpenClawIPCTests/MacNodeModeCoordinatorTests.swift`.

Pinned authority model:
- pairing a device is necessary but insufficient to authorize commands;
- an invocation is usable only when the current authenticated node declares the command, the exact paired-device generation has the command in its approved surface, Gateway policy permits it, any plugin policy permits it, and the local OS/app capability is actually available;
- `commands.deny` wins; dangerous/privacy-heavy commands require persistent Gateway opt-in even when the node declares them;
- command/capability expansion creates a pending approval surface; the old approved intersection remains effective until the expanded surface is explicitly approved;
- node registry dispatch revalidates current persistent pairing generation and runtime connection immediately before dispatch and rejects replaced/stale sockets;
- node-hosted plugin tools remain inside the approved command surface rather than becoming a second invocation authority.

Native application boundary:
- Android is explicitly a companion node and never hosts the Gateway;
- Android may keep multiple operator Gateway sessions, but only the focused Gateway owns the node/device capability session, preventing simultaneous Gateways from commanding one phone;
- iOS/Android advertised commands are derived from current settings, platform support and permissions; sensitive command families remain separately Gateway-authorized;
- route changes, disconnects and socket replacement fence decoded/queued native invokes before detached admission; stale completion/results cannot adopt the replacement route;
- sequence gaps trigger reconnect without admitting the gap-triggering event or command, and sequence state restarts fresh on the replacement connection;
- macOS separates native app capabilities from CLI/node-host worker commands, binds stored device auth to the endpoint owner, and rotates route-authority generations so revocation completes before successor command admission;
- native worker failure may degrade the node capability set with a visible reason without falsely killing unrelated native capabilities.

Local state treatment:
- saved endpoints, device tokens, TLS fingerprints, local permission/settings state and presentation caches are native credential/cache state;
- they are scoped to the exact Gateway/device/role/endpoint owner and may support reconnect;
- they are not Character, relationship, memory, world, workflow, commerce or permission truth for Masanawa;
- canonical server-side pairing/authorization and durable domain state remain authoritative after reconnect or app reinstall.

Masanawa destination:
- device-node transport/host adapters;
- `packages/security` for pairing, command-surface approval and current-authority checks;
- `packages/tools` for command invocation contracts;
- clients/mobile/desktop for local presentation/permission/cache state only.

Disposition: **A/B**.

Acceptance gate:
- no native app can widen server authority merely by advertising a command/capability or receiving an OS permission;
- every consequential node invocation is bound to the exact current device identity, pairing generation, connection/route generation and approved command surface;
- disconnect/replacement/scope change revokes old admission before successor work can use the route;
- reconnect may restore safe local transport/cache state but cannot silently restore revoked server authorization;
- Android/iOS/macOS local state remains explicitly noncanonical for Masanawa domain truth;
- capability degradation/offline state is observable and does not masquerade as successful execution;
- dangerous device actions remain least-privilege, explicit and independently gated by server policy and device permission.

The native/mobile/desktop descendant gap is closed. The donor's app implementations remain reference/adapter donors; Masanawa does not inherit their local stores as server truth.


## 28. Workshop proposals, autonomous review and Custodian skill isolation

Implementation/docs/tests:
- `docs/tools/skill-workshop/reference.md`;
- `docs/tools/custodian-skills.md`;
- `src/skills/workshop/policy.test.ts`;
- `src/skills/workshop/service.test.ts`;
- `src/skills/workshop/experience-review.apply.test.ts`;
- `src/agents/tools/skill-workshop-tool.review.test.ts`;
- `src/gateway/server-methods/skills.proposals.test.ts`;
- `src/gateway/skill-library-authoring.test.ts`;
- `src/gateway/server-cron-skill-review-jobs.test.ts`;
- `src/skills/loading/workspace-skill-snapshot.test.ts`;
- `src/skills/loading/skill-path-containment.test.ts`;
- `packages/gateway-protocol/src/schema/agents-models-skills.test.ts`.

Pinned Workshop behavior:
- Workshop authoring is proposal-first: create/update/revise produce a pending immutable-generation draft; apply/reject/quarantine are separate lifecycle actions;
- read/list is operator-read scoped while proposal mutation/apply/reject/quarantine is operator-admin scoped;
- pending proposals are isolated per owning agent and survive execution/session workspace changes;
- update apply carries a baseline and becomes stale when the live target/support files change before apply; ambiguous proposal names require an explicit proposal ID;
- proposal generations are never overwritten in place, and apply records rollback/recovery facts before mutating the live skill;
- interrupted create/update applies are explicitly reconciled from recorded rollback facts; tampered drafts, cross-agent recovery, unreadable targets and targets outside those facts fail closed rather than guessing;
- unsafe content/path/link/executable/credential cases are rejected or quarantined before publication;
- internal autonomous review gets a bounded mutation budget, invalidates prepared patch authority when the target/substitution changes, and must reread after stale races;
- switching autonomous mode does not retroactively auto-apply a human/manual proposal;
- scheduled collection review is one converged declaration per agent, removes duplicates/stale monitors, rechecks current authority between async mutations, and revocation cancels the active review before its final workspace write.

Custodian behavior:
- release-owned Custodian skills are visible only to the configured system/Custodian agent and absent from every non-Custodian discovery, snapshot, slash-command, sandbox and model-prompt surface;
- ambiguous multi-agent configuration without a resolved system-agent owner yields no Custodian library rather than broadening visibility;
- per-skill disable/agent filters still narrow the Custodian set;
- local operator additions live in the Custodian workspace skill tier, not by mutating the release-owned package directory;
- packaged Custodian files are accepted as package-owned content while ordinary Workshop/workspace roots retain strict path/symlink/hardlink containment rules.

Masanawa destination:
- `packages/skills` canonical draft/revision/certification/publication lifecycle;
- `packages/security` proposal authority, current-authority assertion and approval;
- `packages/workflows` for scheduled review occurrence/cancellation only;
- system-agent operational playbooks as scoped skills, never a parallel administration authority.

Disposition: **A/B**.

Acceptance gate:
- every skill mutation has one owning agent/principal, expected revision/baseline and immutable proposal revision;
- proposal review/evaluation cannot publish by itself unless the canonical policy explicitly authorizes an auto-apply path for that exact proposal generation;
- apply is crash-recoverable and idempotent from durable rollback/commit facts; recovery never infers a target or owner from ambiguous filesystem state;
- stale target, owner loss, authority loss, tampering or unsafe support content fails closed before publication;
- scheduled/autonomous review cannot outlive the authority generation that admitted it;
- system/Custodian playbooks are discoverable only by their resolved owner and never grant extra tool/credential authority merely by being loaded;
- local operator/system-agent customizations use higher-precedence canonical skill scopes instead of editing release-owned content.

The Workshop/Custodian descendant gap is closed. Masanawa should preserve the proposal/recovery/current-authority semantics while implementing them behind its single `packages/skills` authority rather than inheriting OpenClaw's SQLite/filesystem ownership.

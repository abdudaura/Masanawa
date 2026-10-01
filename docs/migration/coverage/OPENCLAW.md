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

Before OpenClaw can be marked covered:
1. exhaustive workspace/package/extension inventory at the pinned revision;
2. Gateway protocol/client and server RPC authority boundaries;
3. channel framework: admission, bindings, outbound delivery, media, typing/status, account lifecycle and major channel-specific deltas;
4. device/node pairing, invoke, offline work, capability publication and credential recovery descendant proof;
5. exec/operator approvals, current-authority mutation and recovery direct-test inventory;
6. session creation/catalog/visibility/search/bindings/transcripts/attachments and subagent/ACP lifecycle;
7. steering/queue-steer/collect/follow-up/interrupt semantics and restart recovery;
8. plugin SDK/plugin lifecycle/install/update/idle/drain and state ownership;
9. tool policy/sandbox/elevated/browser/computer-use/file/shell authority;
10. provider/model/retry/streaming/auth catalog families;
11. memory-host/memory-core/compaction/recall/dreaming/provenance authority map;
12. skill import/library/workshop/ClawHub/custodian/node-hosted descendants and direct tests;
13. cron/scheduler/heartbeat/proactivity classification versus canonical workflows;
14. local state SQLite schema/migrations/workers/backup/recovery and canonical-authority map;
15. native desktop/mobile/node-host/platform app families;
16. telemetry/privacy/security audit/secret/log sanitization/SSRF/network policy;
17. exact direct-test inventory for every retained consequential invariant;
18. repository-wide descendant proof with zero unresolved production families.

Do not advance to OpenClaw Agent Skills until these are closed.

# Phase 0B Coverage — OpenClaw

Pinned revision: `openclaw/openclaw@83e4755b55e8864e48348f3eb2364ee3e5f0fb54`.

Status: **COVERED at the pinned revision**. Repository-family closure proof: `docs/migration/coverage/OPENCLAW-INVENTORY.md`.

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

## Phase 0B closure matrix

The earlier unresolved-family checklist is closed at the pinned revision:

| Family | Closure evidence | Result |
|---|---|---|
| workspace/package/extension inventory | generated Git-tree plugin inventory + pinned lock/Knip workspace graph; 18 package workspaces and 163 plugin entries dispositioned in `OPENCLAW-INVENTORY.md` | closed |
| Gateway protocol/RPC authority | handshake roles/scopes, reserved method policy, closed worker protocol, owner-epoch/session/CAS transcript fencing | closed |
| channel admission/bindings/outbound/media/status | channel ingress/inbound/outbound SDK contracts, deterministic bindings, group/context policy, durable delivery and receipt semantics | closed |
| device/node pairing/invoke/capability recovery | device protocol, node pairing authz tests, node command policy, Android live capability suite, restart/retry boundaries | closed |
| exec/operator approvals/current authority | durable approval lifecycle/store plus CI proof tests for managers, policy, stores, forwarding and runtime integration | closed |
| session/catalog/visibility/transcripts/attachments | session creation lifecycle, bounded transcript hydration, scoped visibility, session rewind/storage tests, handshake attachment ceilings and server-authoritative validation | closed |
| steering/collect/follow-up/interrupt | queue and harness feedback contracts with distinct acceptance vs transcript-commit vs model-consumption states and restart tests | closed |
| plugin lifecycle/install/update/drain/state | prepared inventory generation, hot replacement/drain/rollback, isolated durable plugin state and lifecycle tests | closed |
| tool policy/sandbox/elevated/browser/files/shell | explicit sandbox/tool/elevated separation, deny precedence, creator-role fail-closed semantics, filesystem path revalidation and plugin tool families | closed |
| provider/model/retry/auth catalogs | provider runtime hooks, route/auth separation, host-owned retry budget, destination-bound credential egress and 163-plugin provider classification | closed |
| memory host/recall/compaction/dreaming/provenance | write-time provenance, anti-recall loop, taint/promotion gates, CAS consolidation and direct memory-core test families | closed |
| skill library/revisions/node-hosted skills | managed revision hashing, stale-write conflict, session revision pinning, source/visibility vs authority separation | closed |
| cron/scheduler/heartbeat/proactivity | durable occurrence reservation, lifecycle generations, bounded catch-up and cron/heartbeat direct test inventory | closed |
| local state/schema/migration/recovery | SQLite integrity/quarantine/verification mechanics mapped as reference only; Masanawa PostgreSQL remains canonical | closed |
| native desktop/mobile/node-host | native surfaces classified as presentation/device hosts; server-side pairing, command allowlists, permissions and current authority remain canonical | closed |
| telemetry/privacy/security/network | SSRF DNS/IP/redirect guards, secret refs, diagnostics redaction, OTel content opt-in and non-authoritative trace context | closed |
| consequential direct-test inventory | pinned `scripts/lib/ci-proof-test-inventory.mts` explicitly includes ingress, delivery queue, approvals, sessions, subagents, node pairing, memory, cron, plugin lifecycle and restart suites | closed |
| repository-wide descendant proof | 18/18 maintained package workspaces mapped; 163/163 generated plugin entries classified; no unresolved production family or canonical-owner conflict remains | closed |

### Consequential direct-test anchors

Pinned CI proof inventory includes, among others:

- `src/plugins/registry-runtime.channel-ingress.test.ts`;
- `src/infra/outbound/delivery-queue.recovery.test.ts`;
- `src/infra/outbound/delivery-queue-ack.worker.test.ts`;
- `src/gateway/exec-approval-manager.test.ts`;
- `src/infra/exec-approvals-store.test.ts`;
- `src/gateway/server-methods/sessions-rewind.storage.test.ts`;
- `src/agents/subagents/registry/subagent-orphan-recovery.restart-integration.test.ts`;
- `src/gateway/server.node-pairing-authz.test.ts`;
- `extensions/memory-core/src/dreaming-phases.test.ts`;
- `extensions/memory-core/src/memory-forget-recovery.test.ts`;
- `src/gateway/server.cron.test.ts`;
- `src/gateway/server-plugins.lifecycle.test.ts`;
- `src/agents/main-session-recovery/main-session-restart-recovery.test.ts`;
- `src/channels/message/ingress-monitor.restart-drain.test.ts`.

Channel-specific behavior remains adapter-local where required, but every generated channel plugin is already inside the exact 163-entry manifest inventory and must enter Masanawa through the common admission/delivery/current-authority contracts above. A channel brand does not create a separate canonical owner.

### Closure result

OpenClaw is **covered** under the corrected Phase 0B standard at `83e4755b55e8864e48348f3eb2364ee3e5f0fb54`.

Canonical result:
- adopt Gateway/channel/device reliability and current-authority patterns;
- adopt plugin hot-reload/drain, delivery reconciliation and security invariants;
- adopt selected session/skill/provider/runtime mechanics;
- reject OpenClaw's personal-assistant/shared-Gateway trust assumptions as Masanawa public tenancy;
- reject OpenClaw session, SQLite, memory and agent identity as Masanawa domain authority.

The next source is the separately pinned **OpenClaw Agent Skills** donor.

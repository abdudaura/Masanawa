# Phase 0B Coverage — AI Town

Pinned revision: `8e05997f2409275669c8344b84a51692e83f3f33`.

Status: exhaustive descendant-family remediation complete at the pinned revision.

Canonical boundary: AI Town remains a simulation-mechanics donor only. `packages/world` is Masanawa's sole canonical world/life authority. AI Town `World`, `Player`, `Agent`, Convex documents, messages, memories and provider state do not become Masanawa domain truth.

## Evidence standard

This coverage pass follows `PHASE-0B-REMEDIATION.md`: every retained family below records exact implementation evidence, test/acceptance evidence where present, durable-state treatment, external-integration treatment, A/B/C disposition, one canonical Masanawa owner and an observable acceptance gate.

The pinned source has very limited direct tests for the consequential engine/world state machine. Where donor tests are absent, that absence is explicit and Masanawa's acceptance gate is the required proof before implementation can be considered parity-complete.

## 1. Ordered inputs and typed game commands

Implementation evidence:
- `convex/engine/schema.ts` — per-engine input rows, monotonically increasing `number`, receipt time and durable success/error return value.
- `convex/engine/abstractGame.ts` — loads inputs after `processedInputNumber`, processes them in order, bounds work with `maxInputsPerStep`, writes outcomes during step commit.
- `convex/aiTown/inputs.ts` — one typed command map.
- `convex/aiTown/inputHandler.ts` — validator/handler wrapper.
- `convex/aiTown/insertInput.ts`, `convex/aiTown/main.ts`, `convex/world.ts` — insertion/status/public ingress.

Durable state:
- donor `inputs` table plus engine `processedInputNumber`.
- Masanawa destination: `SimulationInput` + idempotency/outcome receipt in `packages/world`.

Disposition: **A — preserve behavior**, primary simulation donor.

Security boundary:
- `convex/world.ts` currently has user authentication checks commented out for world join/leave/send paths. This is not adoptable production behavior.
- Masanawa must authorize tenant, principal, actor and command before admission.

Acceptance gate:
- concurrent producers receive one total order per world;
- a committed input has exactly one terminal outcome;
- restart resumes after the last committed input without duplicate world effects;
- unauthorized inputs never enter the authoritative queue.

## 2. Simulation clock, ticks and bounded steps

Implementation evidence:
- `ARCHITECTURE.md` — explicit tick/step design and latency trade-offs.
- `convex/engine/abstractGame.ts` — monotonic run loop, bounded ticks/inputs, current time and step commit.
- `convex/aiTown/game.ts` — `tickDuration = 16`, `stepDuration = 1000`, `maxTicksPerStep = 600`, `maxInputsPerStep = 32`; independent player/pathfinding/position/conversation/agent ticks.
- `convex/engine/schema.ts` — engine `currentTime`, `lastStepTs`, generation and running state.

Durable state:
- donor engine row stores simulation progress.
- Masanawa destination: `WorldGeneration` / `SimulationStep` in `packages/world`.

Disposition: **A — preserve behavior, redesign persistence**.

Acceptance gate:
- simulation time never moves backward;
- catch-up work is bounded;
- a failed step cannot partially advance canonical projections;
- world policy explicitly chooses skip/catch-up/replay/reconcile semantics after pause.

## 3. Generation conflict rejection and single-writer semantics

Implementation evidence:
- `convex/engine/schema.ts` — monotonic `generationNumber`.
- `convex/engine/abstractGame.ts` — captures expected generation, increments generation at commit and rejects mismatches.
- `convex/aiTown/game.ts` — `Game.load` resolves engine at expected generation and `saveWorld` applies engine update before world diff.
- `convex/aiTown/main.ts` — scheduled runs carry expected generation; kick/start increment generation to invalidate stale scheduled work.

Durable state:
- donor engine generation.
- Masanawa destination: PostgreSQL compare-and-swap generation/claim state owned by `packages/world`.

Disposition: **A — preserve invariant, B — redesign implementation**.

Acceptance gate:
- two workers starting from the same generation cannot both commit;
- stale workers fail without overwriting newer world state;
- retry reloads current state rather than replaying stale in-memory state.

## 4. Transactional world commit and archival

Implementation evidence:
- `convex/aiTown/game.ts` — in-memory simulation, diff construction, `saveWorld`, `applyEngineUpdate`, archive of removed players/conversations/agents, co-participation records and scheduled agent operations.
- `convex/engine/abstractGame.ts` — processed input outcomes and world state are committed at one step boundary.
- `convex/aiTown/schema.ts`, `convex/schema.ts` — hot state versus archived/history tables.

Durable state:
- active world state, archived entities/conversations, co-participation edges.
- Masanawa destination: normalized world projections + append-only `WorldEvent` / `WorldInteraction` evidence.

Disposition: **A — preserve atomic transition semantics**, **B — redesign data model**.

Acceptance gate:
- a committed generation exposes matching world projections, event evidence and input outcomes;
- archive/event evidence cannot be lost when hot state removes an actor/interaction;
- failed commit leaves the prior generation authoritative.

## 5. Engine liveness, pause and recovery

Implementation evidence:
- `convex/world.ts` — heartbeat, inactive-world stop, inactive restart, dead-engine detection and kick.
- `convex/crons.ts` — periodic inactive stop, dead-world restart and vacuum scheduling.
- `convex/aiTown/main.ts` — start, stop, kick and long-running scheduled `runStep`.
- `convex/constants.ts` — action duration, idle and heartbeat policies.

Behavior:
- developer stop is distinct from inactivity;
- inactive worlds restart on heartbeat;
- dead running engines are kicked after a timeout;
- start advances simulation time to wall clock instead of replaying all stopped ticks.

Disposition: **A — preserve explicit liveness states**, **B — make recovery/catch-up policy world-configurable**.

Acceptance gate:
- operator stop cannot be auto-restarted;
- inactive worlds can resume without duplicate generations;
- dead worker recovery does not double-commit;
- recovery action and reason are observable.

## 6. Autonomous actor loop and operation serialization

Implementation evidence:
- `convex/aiTown/agent.ts` — tick loop, invitation/cooldown rules, one `inProgressOperation`, operation timeout, conversation behavior and remembering completed conversations.
- `convex/aiTown/game.ts` — scheduled agent operations are emitted from simulation and launched after commit.
- `convex/agent/*` — asynchronous LLM/memory work returns through typed inputs rather than directly mutating game state.

Durable state:
- actor operation/cooldown/conversation fields in game state; separate agent tables for asynchronous cognition.
- Masanawa destination: world actor state in `packages/world`; durable work in `packages/workflows`; inference in `packages/agents`.

Disposition: **B — preserve capability, split canonical ownership cleanly**.

Acceptance gate:
- long-running cognition cannot directly write canonical world state;
- one actor operation cannot silently overlap itself unless policy explicitly permits it;
- operation timeout is observable and recoverable;
- workflow truth never hides inside actor conversation state.

## 7. Conversation interaction state machine

Implementation evidence:
- `convex/aiTown/conversation.ts` — invite, accept, reject, walking-over, participating, typing lock/timeout, proximity transition, leave/stop.
- `convex/aiTown/conversationMembership.ts` — membership state representation.
- `convex/aiTown/agent.ts` — autonomous invite/accept/message/leave policies and timeouts.
- `convex/agent/conversation.ts` — prompt/message production and previous-interaction context.
- `convex/agent/conversation.test.ts` — recalled memories are serialized as untrusted user data rather than privileged system instructions.

Durable state:
- active conversation in world hot state, messages in separate low-latency tables, archived conversations and participated-together history.

Disposition: **B — preserve interaction lifecycle, remove two-person/game-specific assumptions**.

Acceptance gate:
- membership transitions reject illegal states;
- typing/interruption locks expire;
- message transport can be independent of the world tick while authoritative interaction state remains coherent;
- untrusted recalled content cannot elevate itself into privileged instructions.

## 8. Spatial movement, pathfinding and collision

Implementation evidence:
- `convex/aiTown/player.ts` — pathfinding state machine, timeouts, bounded pathfind count, collision backoff and position updates.
- `convex/aiTown/movement.ts` — route finding, collision checks and movement helpers.
- `convex/aiTown/location.ts`, `convex/engine/historicalObject.ts` — location history.
- `convex/util/geometry.ts`, `convex/util/minheap.ts`, `convex/util/types.ts` — spatial/path primitives.
- tests: `convex/util/geometry.test.ts`, `convex/util/minheap.test.ts`, `convex/engine/historicalObject.test.ts`.

Disposition: **B — optional world-space capability**, never mandatory Character semantics.

Important donor limitation:
- collision/path retry and spawn/invite choices use `Math.random()`; authoritative Masanawa stochastic outcomes require recorded decision/seed/provenance where replay/audit matters.

Acceptance gate:
- spatial simulation can be disabled without disabling life-state/world semantics;
- collision/path work is bounded;
- location history replays monotonically;
- authoritative stochastic transitions carry reproducible evidence when policy requires it.

## 9. Historical interpolation

Implementation evidence:
- `convex/engine/historicalObject.ts` + test.
- `convex/aiTown/game.ts` — samples player locations every tick and packs history at step end.
- `src/hooks/useHistoricalTime.ts`, `src/hooks/useHistoricalValue.ts` — client-side replay/interpolation and out-of-order protection.

Disposition: **B — preserve presentation behavior behind projection contracts**.

Canonical owner:
- world owns authoritative location samples/projection identifiers;
- clients/presence own interpolation/rendering.

Acceptance gate:
- stale/out-of-order history is rejected;
- replay cannot mutate canonical world state;
- clients can smooth motion without inventing authoritative future position.

## 10. Hot state versus archival history

Implementation evidence:
- `convex/aiTown/game.ts` archives removed conversations/players/agents.
- `convex/aiTown/schema.ts` distinguishes active world state from archived records and co-participation history.
- `convex/world.ts` retrieves previous nonempty conversations.
- `convex/crons.ts` vacuums old inputs/memory vectors and explicitly warns that replay requires snapshots if old inputs are removed.

Disposition: **A — preserve hot/history separation**, **B — redesign retention/replay under explicit policy**.

Acceptance gate:
- retention cannot silently destroy required audit/recovery evidence;
- replayability claims are only enabled when snapshots/input retention actually support them;
- archival social/world evidence remains distinct from private relationship memory.

## 11. Agent memory and reflection — non-canonical reference

Implementation evidence:
- `convex/agent/memory.ts` — conversation summaries, importance, vector retrieval and reflections.
- `convex/agent/embeddingsCache.ts` — embedding cache.
- `convex/agent/conversation.ts` — retrieval into conversation prompts.

Disposition: **C as world-memory authority; reference-only secondary behavior**.

Reason:
AI Town memory is player-centric and lacks Masanawa's explicit tenant/user-character/character-private/character-shared/world/task authorization model. Memory remains owned solely by `packages/memory`.

Acceptance gate:
- AI Town-style recalled content may only enter through authorized Masanawa retrieval;
- private relationship memory cannot mutate shared world/canon;
- embedding/vector caches remain rebuildable projections.

## 12. LLM providers and retry behavior

Implementation evidence:
- `convex/util/llm.ts` — OpenAI-compatible cloud mode and Ollama/local mode, embedding/chat selection, bounded retry with backoff/jitter, streaming response parsing and client-side stop-word enforcement.
- `convex/agent/*` — calls into the provider utility.

Disposition: **C as provider architecture; reference behavior only** because `packages/providers` is canonical.

Failure semantics:
- retryable failures use bounded backoff/jitter;
- missing local models may trigger pull behavior;
- provider-specific assumptions do not belong in world truth.

Acceptance gate:
- provider failure cannot partially mutate canonical world state;
- retry classification is explicit;
- provider configuration and credentials remain outside `packages/world`.

## 13. Replicate background music integration

Implementation evidence:
- `convex/music.ts` — optional Replicate MusicGen request, asynchronous callback fetch, object storage and current background-music lookup.
- `convex/http.ts` — public `/replicate_webhook`.
- `convex/schema.ts` — music records.

Disposition: **C for world core; optional studio/media integration reference**.

Security/reliability finding:
- callback handling retrieves the prediction by supplied ID but does not verify a webhook signature or bind the callback to a durable locally-created request/idempotency record.
- this is insufficient for Masanawa consequential external callbacks.

Acceptance gate if a similar integration is ever retained:
- verify webhook authenticity;
- correlate to a durable provider request;
- deduplicate callbacks;
- reconcile ambiguous outcomes;
- never let media callback state become canonical world authority.

## 14. Authentication / identity integration

Implementation evidence:
- `package.json` includes Clerk.
- `src/components/ConvexClientProvider.tsx`, `LoginButton.tsx`, `src/App.tsx`, `convex/world.ts` contain optional/commented Clerk/Convex auth paths.

Disposition: **C — do not adopt**.

Reason:
authentication is effectively disabled in the pinned runtime paths and the donor identity model is not Masanawa's tenant/relationship identity system.

Acceptance gate:
- all Masanawa world mutations resolve authenticated tenant/principal/actor context before command admission.

## 15. Client rendering and editor surfaces

Implementation evidence:
- `src/components/Game.tsx`, Pixi rendering components, hooks and editor files under `src/`.
- `src/hooks/useHistoricalTime.ts`, `useHistoricalValue.ts`, `useSendInput.ts`.

Disposition: **C/B per capability**.
- Pixi/game UI itself is reference-only.
- useful behavior such as historical interpolation/input outcome waiting may be redesigned behind Masanawa web/presence clients.

Canonical owner:
- apps/clients for UI; `packages/world` only for world contracts.

## 16. Deployment/runtime infrastructure

Implementation evidence:
- `package.json`, Convex config.
- `fly/README.md`, `fly/backend/fly.toml`, `fly/dashboard/fly.toml`.
- root Vite/Tailwind configuration.

Disposition: **C — reference-only infrastructure**.

Reason:
Masanawa's canonical persistence/runtime is PostgreSQL + its selected service/deployment architecture; Convex/Fly setup cannot become a hidden platform dependency.

## Integration disposition

| Source integration | Donor evidence | Masanawa treatment | Failure / security rule |
|---|---|---|---|
| Convex database/functions/scheduler/vector/storage | engine/world/schema/crons/music | C as runtime dependency; redesign semantics on PostgreSQL/jobs/outbox | no donor DB object becomes source of truth |
| OpenAI-compatible cloud LLM | `convex/util/llm.ts` | provider adapter/reference only | bounded retries; no world write before successful governed transition |
| Ollama | `convex/util/llm.ts` | optional local provider behind `packages/providers` | local model pull/readiness is provider health, not world state |
| Replicate MusicGen | `convex/music.ts`, `http.ts` | optional studio/media provider reference | signed/authenticated webhook + durable request correlation + dedupe required |
| Clerk | commented/optional client/server paths | retire as architecture | Masanawa canonical auth/tenant identity only |

## Test coverage assessment

Direct donor tests found at the pinned revision include:
- `convex/agent/conversation.test.ts` — memory prompt-injection boundary;
- `convex/engine/historicalObject.test.ts` — history packing/round-trip;
- `convex/util/geometry.test.ts` — geometry/path behavior;
- `convex/util/minheap.test.ts`;
- `convex/util/compression.test.ts`;
- `convex/util/types.test.ts`;
- `convex/util/asyncMap.test.ts`.

There is no comparable direct donor test suite proving the consequential engine-generation, transactional commit, liveness or conversation state-machine invariants end to end. Masanawa therefore records these as required parity/acceptance tests rather than treating donor implementation presence as proof.

## Canonical authority map

| AI Town concept | Masanawa owner | Treatment |
|---|---|---|
| engine/input queue/generation | `packages/world` | redesign on canonical world contracts |
| player/agent world presence | `packages/world` | normalize to WorldActorState; never Character identity |
| autonomous reasoning operation | `packages/agents` + `packages/workflows` | world only receives governed outcomes |
| memories/reflections | `packages/memory` | donor memory is non-canonical |
| messages/channel delivery | gateway/channel/presence adapters | transport only |
| LLM/embeddings | `packages/providers` | provider edge |
| media/music generation | studio/provider layer | optional |
| auth/user identity | canonical security/identity | donor auth retired |
| UI/history interpolation | apps/presence clients | projection/render behavior only |

## Closure

Meaningful descendant families in the pinned AI Town source are now accounted for: engine, ordered inputs, generation/conflict control, world commit, liveness, actor loop, conversations, movement/pathfinding, historical interpolation, archival history, memory/reflection, LLM providers, media webhook integration, optional auth, client rendering and deployment/runtime infrastructure.

Unresolved architecture ownership conflicts: **0**.

The Phase 0A decision remains unchanged: AI Town is the primary simulation-mechanics donor, while Masanawa `packages/world` is the only canonical world/life authority and ChatWithStars remains the stronger life/canon/governance donor.

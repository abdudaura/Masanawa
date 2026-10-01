# Golden Journey Acceptance Contracts

Status: Phase 1 canonical draft.

These journeys are platform acceptance contracts, not UI scripts. Each journey must be testable across process restart, duplicate delivery, policy change, and provider ambiguity where relevant.

## Evidence vocabulary

Each journey records:
- canonical IDs involved;
- preconditions;
- happy-path observable outcome;
- privacy/authority assertions;
- recovery/idempotency assertions;
- required evidence.

A journey passes only when all relevant assertions pass.

## GJ-01 — Meet Character -> converse -> remember -> return -> proactive follow-up

Preconditions:
- Tenant/User/Character/active CharacterVersion exist.
- Relationship is created or resolved.
- contact/proactivity permission is explicit.

Flow:
1. User starts a CharacterSession.
2. Conversation produces an eligible relationship-memory candidate.
3. Memory policy/provenance gate writes canonical MemoryRecord in Relationship scope.
4. Session ends/resets.
5. User returns through a new CharacterSession, possibly another channel.
6. authorized retrieval recalls the relevant memory.
7. later permitted proactive trigger references the promise/context without exposing unrelated memory.

Assertions:
- RelationshipId survives session/channel changes.
- Channel/provider session IDs do not become relationship identity.
- User A's memory is unavailable to User B.
- recalled memory carries provenance.
- proactive send rechecks current contact permission/quiet-hours/frequency policy.
- duplicate inbound message does not duplicate durable memory.
- restart between memory write and index projection still allows eventual rebuild/retrieval.

Evidence:
- RelationshipId;
- MemoryRecordId/revision;
- two CharacterSessionIds;
- channel external refs;
- proactive WorkflowRun/OperationId;
- audit/authorization records.

## GJ-02 — Research -> route -> tools -> sourced result -> memory

Preconditions:
- certified research SkillVersion;
- authorized read-only/search tools/providers;
- user request admitted.

Flow:
1. AgentRun selects research skill.
2. skill executes provider-neutral tools.
3. evidence is collected with source/provenance.
4. result is returned with sourced claims.
5. only eligible summary/facts are proposed to memory.

Assertions:
- routing/skill selection does not grant tool authority.
- provider failures/fallbacks are observable.
- read-only retries remain bounded.
- tool outputs do not enter durable memory wholesale.
- source provenance survives summarization.
- memory write occurs only after scope/privacy gate.

Recovery:
- AgentRun restart does not repeat already-settled consequential tools.
- provider timeout is classified accurately.
- partial research may return partial-completion evidence without claiming complete coverage.

## GJ-03 — Live call -> speech/avatar -> interruption -> continuation

Preconditions:
- CharacterSession exists.
- PresenceSession can be created.
- transport/realtime provider/voice/avatar capabilities ready.

Flow:
1. PresenceSession joins live media.
2. User speaks.
3. live turn produces speech/avatar output.
4. user interrupts during playout.
5. active turn generation is cancelled/invalidated.
6. new user turn continues from canonical session context.

Assertions:
- PresenceSession/LiveKit participant IDs do not replace CharacterSession/User identity.
- stale audio/text from interrupted generation cannot commit after newer generation.
- transcript reflects actual committed/played interaction semantics.
- avatar rendering state cannot mutate Character identity.
- presence restart can rejoin without losing durable CharacterSession/Task state.

Recovery:
- network reconnect creates new transport refs while preserving canonical session.
- TTS/realtime provider ambiguity never fabricates a completed user-visible turn.

## GJ-04 — Commerce -> quote -> payment -> execute -> reconcile -> receipt

Preconditions:
- Commerce capability/SkillVersion certified.
- provider credentials healthy.
- user authority and any required approvals available.

Flow:
1. validate product/service request.
2. create immutable Quote with expiry/terms.
3. user confirms.
4. create Payment/Operation.
5. provider payment acceptance is observed.
6. canonical payment state is reconciled.
7. fulfillment Operation executes.
8. provider receipt/reconciliation settles.
9. canonical receipt is returned.

Assertions:
- model never owns amount/payment truth.
- Quote amount cannot change under same QuoteId.
- request-sent != payment-completed.
- payment and fulfillment use stable OperationIds/idempotency.
- changed args invalidate approval.
- financial ledger is append-only/balanced.
- private payment data is not general Character memory.

Crash probes:
- crash after payment provider acceptance before local settlement;
- crash after fulfillment acceptance before receipt persistence;
- duplicate provider webhook;
- client timeout after dispatch.

Expected:
- no duplicate charge/fulfillment;
- same OperationId reconciles;
- ambiguous state becomes needs-attention, not blind retry.

## GJ-05 — World event -> shared consistency without relationship leakage

Preconditions:
- World/Characters exist.
- at least two distinct User relationships exist.

Flow:
1. ordered world input admitted.
2. simulation step reads expected WorldGeneration.
3. transactional step commits WorldEvent/current projection.
4. Character contexts later observe authorized shared fact.

Assertions:
- stale generation commit is rejected.
- shared WorldEvent does not include private relationship memory.
- Character-private/Relationship scopes cannot be read by simulation by default.
- world projection rebuilds from canonical evidence.
- one user learning a private fact cannot silently make it world canon.

## GJ-06 — Web -> WhatsApp -> live call with same relationship/task continuity

Preconditions:
- User external identities linked.
- ChannelAccount mappings configured.
- relationship exists.

Flow:
1. web CharacterSession begins Task.
2. user continues via WhatsApp.
3. canonical route resolves same User/Relationship and appropriate CharacterSession/Task continuity.
4. user starts live call.
5. PresenceSession references same durable context/task.

Assertions:
- external subject mapping is explicit.
- unmatched WhatsApp sender cannot claim existing relationship by display name/phone guess.
- channel binding selects target after admission, not authorization.
- switching channels does not clone memory/task state.
- live call can end without completing/cancelling Task accidentally.

## GJ-07 — Long task -> foreground responsive -> background result returns

Preconditions:
- durable Task/WorkflowVersion exists.
- CharacterSession interactive.

Flow:
1. interactive AgentRun admits long work.
2. Task/WorkflowRun persists.
3. foreground Character responds with accepted status.
4. background workers continue.
5. user can send additional turns meanwhile.
6. result settles and returns through authorized route.

Assertions:
- foreground AgentRun is not durable Task truth.
- worker restart resumes WorkflowRun.
- stale worker fence cannot settle newer attempt.
- user cancellation stops future work but reconciles already-dispatched effects.
- final delivery uses stable OperationId and survives timeout/reconnect.
- another user cannot observe Task result.

## GJ-08 — Cross-character handoff -> bounded context -> completion/return

Preconditions:
- source/destination Characters available.
- handoff policy permits task.
- target skill/capabilities certified.

Flow:
1. source decides handoff is appropriate.
2. deterministic policy validates target.
3. bounded HandoffEnvelope is created.
4. delegated authority is intersected with target/task requirements.
5. destination performs work.
6. result returns to source/user route.

Assertions:
- handoff does not copy full Relationship memory.
- child/target cannot expand authority.
- target Character identity/version remains distinct.
- handoff target must be known/eligible.
- completion is linked to parent Task/Workflow lineage.
- stale target completion cannot settle a replaced/cancelled parent generation.

## GJ-09 — Social draft -> approval -> publish -> receipt/retry

Preconditions:
- social account adapter configured.
- content policy/approval rules defined.

Flow:
1. create SocialContent draft.
2. approval binds exact content/version/destination.
3. Publication Operation is persisted.
4. publish adapter dispatches.
5. provider receipt settles publication.

Assertions:
- private Relationship memory cannot enter draft without explicit authorization.
- content edit after approval invalidates approval.
- timeout after send does not cause duplicate post.
- partial/unknown provider response reconciles same Publication/Operation.
- provider post ID is external receipt, not canonical PublicationId.

## GJ-10 — Studio project -> identity-consistent media -> review -> publish

Preconditions:
- Character appearance/voice references active.
- MediaProject created.
- providers available.

Flow:
1. script/storyboard versions created.
2. shots/jobs reference canonical CharacterVersion/appearance/voice.
3. generated artifacts record provider/model/prompt/provenance.
4. review selects approved artifacts.
5. assembly/lipsync/voice output created.
6. optional social publication follows GJ-09.

Assertions:
- provider job IDs do not become artifact identity.
- Character identity is referenced, not copied into provider-specific truth.
- artifact provenance/versions survive regeneration.
- rejected artifact cannot become published through stale callback.
- studio pipeline remains separate from live PresenceSession state.

## GJ-11 — Device/node perception -> permission -> bounded observation -> safe action

Preconditions:
- Device paired.
- approved command/capability scopes exist.
- local OS permission state available.

Flow:
1. node advertises capabilities.
2. user grants/has required permission.
3. PerceptionEvent captures bounded camera/screen/location/system observation.
4. policy admits it to one CharacterSession/Task.
5. model/skill proposes device action.
6. current authority and approval are checked.
7. device Operation dispatches and reconciles.

Assertions:
- advertised capability is not authorization.
- revoked device/token cannot execute next effect.
- perception without permission never reaches model context.
- sensitive perception does not become long-term memory automatically.
- ambiguous device command after dispatch is not blindly retried.
- symlink/path/network policies still apply to device/file/browser actions.

## GJ-12 — Agent/workflow crash/restart -> durable recovery without duplicate side effects

Preconditions:
- durable WorkflowRun with at least one external side effect and one pending/next step.

Fault matrix:
1. crash before dispatch.
2. crash after durable intent but before dispatch.
3. crash after provider accepts but before local receipt commit.
4. crash after receipt commit but before workflow checkpoint.
5. crash with pending HITL.
6. crash with queued final outbound message.
7. stale worker continues after replacement generation.

Assertions:
- cases 1-2 may retry safely under same OperationId.
- case 3 becomes reconcile/join, never fresh non-idempotent send.
- case 4 restores receipt/operation and advances without repeating effect.
- pending HITL survives restart and remains unresolved until real verdict.
- queued delivery retains Gateway/outbox custody.
- stale worker cannot settle after generation/fence changes.
- checkpoint restore requires compatible WorkflowVersion/signature.
- cancellation/revocation affects future effects without rewriting completed external history.

## Cross-journey security suite

Every journey additionally verifies:
- tenant isolation;
- typed current AuthorityContext;
- secret redaction;
- audit correlation;
- no model output used as permission/financial/provider truth;
- expected error/ambiguity classes are typed;
- observability contains no raw secrets/private content by default.

## Cross-journey restart suite

For every durable journey, test process restart at:
- pre-commit;
- post-commit/pre-outbox dispatch;
- post-dispatch/pre-receipt persistence;
- post-receipt/pre-domain settlement where applicable.

Expected result is either:
- safe continuation exactly once;
- or explicit needs-attention/reconciliation.

Silent loss and duplicate consequential effects are failures.

## Phase 2 implementation mapping

Each journey should become:
- unit tests for domain invariants;
- integration tests for DB/outbox/idempotency;
- contract tests for adapters;
- restart/fault-injection tests;
- Playwright/API end-to-end tests where user-visible;
- security/privacy assertions.

A journey is not complete because its happy path works once.

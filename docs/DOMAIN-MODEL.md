# Masanawa Domain Model

Status: Phase 1 canonical draft. Aggregate ownership changes require ADR review.

This document defines stable Masanawa identities, aggregate boundaries, and the session taxonomy needed to implement the platform without recreating donor runtimes. Donor/provider/channel/native IDs are external references unless explicitly normalized into a canonical Masanawa type.

## Identifier rules

Canonical IDs are opaque, immutable after creation, tenant-owned by record, and type-distinct at compile time.

Recommended physical representation: UUIDv7 or an equivalent sortable opaque 128-bit identifier wrapped in branded TypeScript types.

Canonical IDs must never be derived from mutable names, phone numbers, usernames, email addresses, provider thread IDs, database sequence positions, room IDs, or donor object IDs.

External IDs are stored only as typed references containing their system/provider, namespace, value, provenance, and observed/validity metadata.

## Tenant and human identity

### Tenant

`TenantId` is the top-level isolation boundary.

A Tenant owns:
- users;
- Characters;
- relationships;
- channel accounts;
- devices;
- credentials;
- workflows/tasks;
- commerce/social/studio records;
- operator roles and policy.

Cross-tenant references are forbidden unless a future federation ADR defines them explicitly.

### User

`UserId` is the canonical human/platform identity inside a Tenant.

A User may have many authenticated external identities. WhatsApp JIDs, phone numbers, email addresses, Google subjects, Telegram IDs, device IDs, and other provider identifiers resolve to a User only through explicit canonical identity mapping.

## Character identity

### Character

`CharacterId` is the stable persistent fictional/persona identity.

It survives:
- prompt changes;
- provider/model changes;
- voice changes;
- avatar changes;
- channel changes;
- AgentStrategy changes;
- CharacterVersion publication.

A Character is never an AgentStrategy subclass or provider thread.

### CharacterVersion

`CharacterVersionId` is an immutable version of authored identity/canon/policy-facing configuration.

A version may contain:
- biography/canon;
- personality/boundaries;
- disclosure policy;
- languages;
- voice/appearance references;
- expertise bindings;
- memory/world policy references.

Activation is explicit. A stale or draft version never becomes current by inference.

### UserCharacterRelationship

`RelationshipId` is the stable private relationship between one User and one Character in one Tenant.

Primary uniqueness:
`(tenantId, userId, characterId)` -> at most one active primary relationship.

Relationship truth includes:
- relationship stage/tone;
- user-specific preferences/disclosures;
- private continuity;
- relationship permissions;
- promises/follow-ups;
- private task references;
- relationship memory scope.

RelationshipId survives channel changes and session resets.

Private relationship facts never automatically become shared Character/world facts.

## World identity

### World

`WorldId` owns shared fictional truth.

### WorldGeneration

`WorldGenerationId` is an optimistic-concurrency/simulation generation used to reject stale world commits.

### WorldActor

`WorldActorId` is a world projection of a Character or another allowed actor.

A Character-backed WorldActor references CharacterId; it does not replace Character identity.

### WorldEvent

`WorldEventId` identifies immutable shared-world evidence/events and always carries provenance plus visibility.

## Interaction and session taxonomy

These IDs are intentionally different.

### CharacterSession

`CharacterSessionId` is bounded conversational continuity for a User/Character interaction.

It may bind:
- CharacterVersionId;
- RelationshipId;
- current channel;
- relevant active Tasks/WorkflowRuns;
- permitted context and skill revisions.

Resetting a CharacterSession must not erase Relationship, Memory, Task, Workflow, or World state.

### ChannelSession

`ChannelSessionId` is a transport/channel runtime projection such as a WhatsApp connection/conversation, Telegram topic route, web connection, or provider-native conversation handle.

It may be replaced on reconnect, relink, or provider migration.

It routes into CharacterSessionId but never becomes relationship identity.

### PresenceSession

`PresenceSessionId` is a live realtime lifecycle.

It owns ephemeral/live:
- WebRTC room/transport bindings;
- media generation;
- endpointing/barge-in;
- playout;
- realtime provider handles.

It references CharacterSessionId when appropriate but does not own durable business truth.

### AgentRun

`AgentRunId` identifies one admitted execution of an AgentStrategy.

It carries:
- CharacterId;
- strategy/version;
- CharacterSessionId and/or WorkflowRunId/TaskId;
- delegated AuthorityContext;
- execution lineage.

AgentRun is execution, not identity.

### Task

`TaskId` owns durable useful work that may outlive a conversation or AgentRun.

A Task may reference one or more WorkflowRuns and domain records.

### Workflow / WorkflowVersion / WorkflowRun

`WorkflowId` is the stable definition identity.

`WorkflowVersionId` is an immutable published definition.

`WorkflowRunId` is a durable execution instance owning:
- checkpoint lineage;
- pending HITL;
- transition state;
- side-effect OperationIds;
- restart/recovery state.

WorkflowRun survives process/worker replacement.

## Memory

### MemoryRecord

`MemoryRecordId` is canonical durable memory.

Every record carries:
- tenant;
- relevant Character;
- MemoryType;
- MemoryScope;
- provenance/evidence;
- observedAt;
- createdAt;
- sensitivity;
- lifecycle state;
- supersession/correction links where applicable.

### MemoryRevision

`MemoryRevisionId` identifies immutable revision lineage for curated/edited memory.

### MemoryScope

Closed typed variants:
- `session(CharacterSessionId)`;
- `relationship(RelationshipId)`;
- `characterPrivate(CharacterId)`;
- `characterShared(CharacterId)`;
- `world(WorldId)`;
- `organization(TenantId|OrganizationId)`;
- `task(TaskId|WorkflowRunId)`.

Authorization evaluates scope before retrieval/ranking.

## Skills, tools, providers

### Skill / SkillVersion

`SkillId` is stable logical skill identity.

`SkillVersionId` is immutable certified revision.

Sessions/runs pin exact SkillVersionIds where reproducibility matters.

Imported donor/file-system skills are only candidates until certified.

### Tool / ToolVersion

`ToolId` and `ToolVersionId` identify atomic capability implementations.

ToolVersion declares:
- schemas;
- auth requirements;
- risk;
- side-effect class;
- idempotency;
- retry/reconciliation;
- health/readiness;
- sensitivity.

### Provider

`ProviderId` identifies configured external/local integration.

Remote thread/job/transaction IDs remain external references.

### CredentialRef

`CredentialRefId` points to a vault/secret object. Raw secret values do not live in ordinary domain rows or events.

## Channels and external subjects

### ChannelAccount

`ChannelAccountId` is one configured transport/account connection.

### ExternalSubjectRef

Typed external identity observation containing:
- provider/channel;
- account;
- namespace/domain;
- subject kind;
- external stable ID;
- authentication strength;
- provenance/observed metadata.

ExternalSubjectRef does not authorize itself and does not equal UserId.

### ChannelConversationRef

Typed external transport address containing channel/account/conversation/group/topic/thread identities.

It is routing evidence only.

## Devices

### Device

`DeviceId` is a canonical registered physical/logical node.

It owns:
- pairing state;
- public/device identity;
- capabilities;
- approved command scopes;
- credential generations;
- revocation state.

Device-advertised capabilities are claims intersected with server policy.

### DeviceCredential

`DeviceCredentialId` identifies a credential generation. Bearer material is never ordinary domain content.

## Security identity

### Principal

Closed union:
- `user(UserId)`;
- `operator(UserId)`;
- `service(ServiceId)`;
- `device(DeviceId)`;
- `agentRun(AgentRunId)` with delegated authority;
- explicit system principals.

A model/provider response is never a Principal.

### AuthorityContext

Immutable admission snapshot containing:
- TenantId;
- Principal;
- authenticated evidence;
- granted scopes/capabilities;
- relationship/world/task scope;
- policy revision;
- approval refs;
- delegation chain;
- issuedAt/optional expiry;
- request/correlation identity.

For awaited consequential work, current authority is reasserted immediately before mutation/dispatch. AuthorityContext is evidence, not a substitute for current policy.

## Consequential side effects

### Operation

`OperationId` is the canonical idempotent identity of one consequential external effect.

Examples:
- message send;
- payment/provider mutation;
- data/airtime purchase;
- social publish;
- device command;
- file mutation;
- booking.

Baseline state:
`prepared -> authorized -> dispatched -> accepted|rejected|partial|unknown -> reconciled -> terminal`.

A timeout after dispatch does not create a new OperationId.

### ExternalReceipt

Provider acceptance/transaction evidence bound to OperationId.

### ReconciliationCase

`ReconciliationCaseId` owns ambiguous/unresolved effect recovery.

## Events

`EventId` identifies a canonical event envelope.

`AuditEventId` identifies immutable append-only audit evidence.

`OutboxEventId` identifies transactional publication custody.

These may be causally linked but are distinct identities.

## Commerce

### Quote

`QuoteId` is an immutable priced offer with expiry/terms.

### Payment

`PaymentId` is canonical payment lifecycle identity.

### LedgerEntry

`LedgerEntryId` is immutable financial-ledger evidence.

### Fulfillment

`FulfillmentId` is canonical purchased-service execution identity.

Provider transaction IDs remain ExternalReceipts.

## Social and studio

`SocialContentId` identifies canonical content.

`PublicationId` identifies one durable publication lifecycle.

`MediaProjectId` identifies produced-media work.

`MediaArtifactId` identifies immutable generated/rendered artifacts.

Provider job IDs remain external refs.

## Versioning and concurrency

Every mutable canonical aggregate has:
- tenant ownership;
- lifecycle state;
- revision/optimistic concurrency token;
- createdAt;
- updatedAt.

Unsafe stale writes use compare-and-set/current-revision checks.

Events, ledger entries, revisions, and audit evidence are append-only.

## Deletion and retention

Prefer lifecycle states:
- active;
- disabled/revoked;
- archived;
- tombstoned when replay/dedupe requires it.

Hard deletion is retention/policy driven and must not break:
- audit;
- financial integrity;
- idempotency;
- event causality;
- required security/legal retention.

## Aggregate ownership

| Aggregate | Canonical owner |
|---|---|
| Tenant/User/Character/CharacterVersion/Relationship | packages/identity |
| World/WorldGeneration/WorldEvent | packages/world |
| MemoryRecord/MemoryRevision | packages/memory |
| CharacterSession/AgentRun | packages/agents |
| Skill/SkillVersion | packages/skills |
| Tool/ToolVersion | packages/tools |
| Workflow/WorkflowVersion/WorkflowRun/Task | packages/workflows |
| Provider contracts | packages/providers |
| Credential/authority/approval policy | packages/security |
| PlatformEvent/Outbox/Audit envelope | packages/events |
| Commerce Quote/Payment/Ledger/Fulfillment | packages/commerce |
| PresenceSession | services/presence contract/state |
| Social publication | social domain/service |
| Studio media project/artifact | studio domain/service |

## Character context compilation

Runtime context is a projection, not storage.

A CharacterContext may include only the authorized/relevant portions of:
- active CharacterVersion;
- Relationship;
- scoped memories;
- shared Character/world state;
- current CharacterSession;
- Workflow/Task state;
- AuthorityContext;
- exact certified skills;
- healthy tools/providers.

Context compilation never expands authorization.

## Handoffs

Cross-character handoff carries a bounded envelope:
- source/destination CharacterId;
- UserId/RelationshipId as authorized;
- CharacterSession/Task/Workflow references;
- current request;
- confirmed entities;
- unresolved questions;
- approval/payment status;
- safe relevant memory snippets;
- language/modality;
- reason;
- source/target SkillVersion;
- privacy classification;
- delegated authority ceiling.

It never clones an entire relationship memory space and never expands authority.

## Forbidden identity collapses

These are architectural errors:

- Agent = Character
- CharacterSession = Relationship
- ChannelSession = CharacterSession
- PresenceSession = CharacterSession
- provider thread = CharacterSession
- channel sender ID = UserId
- device = User
- WorldActor = Character
- MemoryRecord = prompt text
- WorkflowRun = chat history
- approval = model intent
- provider receipt = canonical business entity
- plugin ID = tenant/domain authority

Phase 2 architecture-boundary tests and branded schema types must make these collapses difficult or impossible.

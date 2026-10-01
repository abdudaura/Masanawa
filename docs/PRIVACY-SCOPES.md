# Privacy Scopes and Context Compilation

Status: Phase 1 canonical draft.

## Principle

Relevance never grants access.

Authorization/scope filtering runs before retrieval, ranking, context compilation, model calls, handoffs, telemetry export, or proactive use.

## Canonical scopes

### Tenant scope

All operational access begins inside one Tenant.

### Relationship scope

Private to one User-Character relationship.

May contain:
- private conversation continuity;
- preferences/disclosures;
- relationship memories;
- promises/follow-ups;
- relationship task references.

Never shared with:
- another user of the same Character;
- a world simulation;
- a social/public surface;
- another Character;
unless an explicit user-authorized workflow creates a new appropriately scoped fact.

### Character-private scope

Private to the Character/platform operation, not automatically visible to every user relationship.

Examples:
- private planning/state;
- protected internal continuity;
- operator-governed persona notes.

### Character-shared scope

Facts intended to be stable/shared across authorized relationships.

Publication into this scope is a governed transition, not automatic memory promotion.

### World scope

Shared fictional truth for one World.

Requires World provenance/visibility and may affect multiple Characters.

Relationship-private content cannot be copied into World scope merely because a model thinks it is useful.

### Session scope

Ephemeral/bounded CharacterSession continuity.

May be compacted/expired without deleting Relationship memory or Task/Workflow truth.

### Task scope

Facts/evidence needed only for one Task/WorkflowRun.

Completion may promote selected facts to another scope only through explicit policy.

### Organization scope

Tenant/org knowledge shared according to organization policy, independent of private Relationship memory.

## Memory authorization order

For a memory query:

1. authenticate principal;
2. resolve tenant;
3. derive allowed MemoryScopes from current resource/relationship/task/world policy;
4. query canonical metadata for authorized scopes;
5. retrieve/rank from projections only for those canonical candidates/scopes;
6. apply sensitivity/purpose filters;
7. return bounded evidence.

Do not retrieve globally and let the model discard forbidden records.

## Context compiler

Input:
- CharacterId + active CharacterVersion;
- CharacterSession;
- RelationshipId if present;
- AuthorityContext;
- current Task/Workflow references;
- World references;
- requested modality/channel;
- certified SkillVersions;
- tool/provider readiness;
- token/time budget.

Compilation stages:

1. validate current CharacterVersion/Relationship/session binding;
2. derive allowed scopes from AuthorityContext;
3. fetch deterministic identity/policy facts;
4. fetch authorized relevant memory;
5. fetch authorized world/shared state;
6. fetch current Task/Workflow state;
7. select certified skills/tools;
8. apply sensitivity/redaction/disclosure policy;
9. enforce size/budget;
10. produce CharacterContext with provenance map.

CharacterContext is immutable for one admitted turn/run generation.

Long-running work may refresh explicitly at effect/turn boundaries; it does not silently mutate underneath an in-flight deterministic decision.

## Context provenance

Every context item records enough provenance to answer:
- source aggregate/record;
- scope;
- observed/effective time;
- version/revision;
- sensitivity;
- why included.

Provider/model prompts may use a compact rendered form, but internal trace can map rendered blocks back to canonical evidence IDs without exposing raw private data in default telemetry.

## Quoted/history channel context

Trigger authorization and context visibility are separate.

A sender may be allowed to trigger a Character while quoted/history content from other participants remains filtered by configured visibility policy.

Quoted content does not become the authority of its author unless transport evidence supports that author identity.

## Perception privacy

Sensitive PerceptionEvents require permission before model context.

Each admitted PerceptionEvent carries:
- source Device/Channel;
- user/owner;
- permission/capability;
- purpose;
- sensitivity;
- capturedAt;
- expiry/retention;
- allowed recipients/scopes.

Camera/screen/mic/system state cannot be promoted into long-term memory by default. Memory promotion uses explicit memory policy and provenance.

## Proactivity

Before proactive contact:

1. current relationship/contact permission;
2. memory/world/task scope authorization;
3. privacy/sensitivity;
4. relevance;
5. channel availability;
6. quiet hours;
7. frequency budget;
8. persona/disclosure policy;
9. current authority at send.

A stale promise or old channel route cannot bypass current contact permissions.

## Handoff privacy

A handoff constructs a new bounded envelope from source-authorized facts.

Default handoff includes:
- current request;
- confirmed entities;
- task/workflow state;
- minimal relevant memory excerpts;
- reason/language/modality;
- delegated authority ceiling.

It excludes:
- unrelated relationship history;
- full transcript;
- secrets;
- private world/operator notes;
- memories outside target authorization.

Target reauthorizes before use.

## Shared-fact publication

Promotion from private scope to Character-shared/World/Organization requires:
- explicit policy path;
- provenance;
- sensitivity review;
- target scope;
- authorizing principal/system rule;
- optional approval depending on risk.

A model classification can propose publication but cannot authorize it.

## Memory correction/supersession

Correction preserves old evidence/revision and writes a new canonical record/revision or supersession link.

Retrieval defaults to currently effective facts but can expose lineage to authorized audit/reasoning workflows.

Forgetting/privacy deletion can redact payload while preserving minimal structural audit/idempotency evidence where required.

## Social/public content

Public/social publication may draw from:
- public Character identity;
- explicitly public/shared World facts;
- approved studio/social content;
- user-provided content authorized for that publication.

It must not draw from private Relationship memory without explicit user-scoped approval.

## Commerce privacy

Payment/financial information is Task/Commerce scoped and highly sensitive.

It is not general Character memory.

Model context receives only the minimum state needed, such as:
- quote amount/currency;
- payment status;
- fulfillment status;
- receipt reference.

Raw payment credentials, account secrets, and provider tokens never enter prompt memory.

## Telemetry

Default telemetry records operational metadata, IDs where privacy-safe, durations, statuses, error classes, and bounded counters.

Raw:
- prompts;
- chats;
- memory content;
- tool outputs;
- credentials;
- cookies;
- device personal data;

are off by default and require explicit diagnostic/content-capture authority.

## Multi-character interactions

Character-to-Character interaction uses:
- public/shared Character facts;
- World facts;
- explicit Task/Handoff context;
- appropriately scoped shared memory.

One Character never receives another Character's private User Relationship state by default.

## Acceptance tests

Phase 2 must prove:
- User A's relationship memory cannot be retrieved in User B's context for same Character;
- World simulation cannot read private relationship memory;
- relevance/ranking cannot bypass scope;
- private memory is not emitted into social/public generation;
- handoff carries only selected authorized records;
- proactive send rechecks current contact permission;
- perception without permission never reaches context;
- session reset does not erase durable Relationship/Task truth;
- correction/supersession preserves audit lineage without retrieving obsolete fact by default.

# Event, Transaction, Outbox and Side-Effect Contracts

Status: Phase 1 canonical draft.

## Event envelope

Every durable PlatformEvent carries:

- `eventId: EventId`
- `eventType`
- `schemaVersion`
- `tenantId`
- `aggregate: { type, id, revision? }`
- `occurredAt`
- `recordedAt`
- `actor: PrincipalRef | null`
- `authorityRef | null`
- `correlationId`
- `causationId | null`
- `requestId | null`
- `workflowRunId | null`
- `characterSessionId | null`
- `provenance`
- `sensitivity`
- typed payload.

Event payloads must not contain raw secrets.

## Event classes

### DomainEvent

Durable fact that a canonical aggregate committed a state transition.

Published only after the owning transaction commits.

### AuditEvent

Immutable security/operational evidence.

Audit may record attempted/rejected actions as well as successful transitions.

Audit records are not replayed as business commands.

### IntegrationEvent

Durable notification intended for external/adapter processing.

Normally originates from a transactional outbox.

### TelemetryEvent

Ephemeral or sampled operational observation.

Telemetry is never authoritative business state.

## Commands

A Command requests work; an Event reports a committed fact.

Commands carry:
- commandId/requestId;
- tenant;
- principal/AuthorityContext reference;
- idempotency key when applicable;
- expected aggregate revision where applicable;
- payload.

A command handler validates current state/authority and may reject without producing a DomainEvent.

## Transaction rule

For one aggregate/domain mutation:

1. validate input;
2. load canonical current state;
3. authorize;
4. verify expected revision/idempotency;
5. apply deterministic transition;
6. persist canonical mutation;
7. persist required DomainEvent/AuditEvent/outbox rows in the same PostgreSQL transaction;
8. commit;
9. publish/process outbox asynchronously.

Never publish a durable domain event before its canonical mutation commits.

## Cross-domain transaction rule

Do not create broad distributed transactions by default.

If multiple canonical owners must change:
- one domain owns the initiating transaction;
- workflow/outbox coordinates downstream transitions;
- each domain transition is independently idempotent;
- compensation/reconciliation is explicit.

A future same-database atomic multi-domain transaction requires an explicit service/domain contract and must still preserve ownership.

## Idempotency

Consequential commands use an idempotency scope:

`(tenantId, operationKind, idempotencyKey, authorityScope)`.

Stored idempotency record contains:
- OperationId;
- canonical request fingerprint;
- lifecycle state;
- response/receipt locator;
- created/updated timestamps;
- retention window.

Same key + different canonical request fingerprint is a conflict.

Idempotency retention must exceed every provider replay/retry window relevant to the operation.

## Operation lifecycle

Consequential external effects use one `OperationId`.

States:

- `prepared` — canonical intent captured, no dispatch.
- `authorized` — current policy/approval satisfied for this exact operation.
- `dispatching` — durable claim acquired.
- `dispatched` — request may have reached external system.
- `accepted` — provider returned acceptance/receipt; final business outcome may still be pending.
- `rejected` — proven pre-effect or provider rejection.
- `partial` — some externally visible effect occurred before failure.
- `unknown` — effect may have occurred but outcome cannot be proven.
- `reconciling` — status query/receipt/provider callback recovery active.
- `succeeded` / `failed` / domain-specific terminal state.

Do not collapse `accepted` into `succeeded`.

## Dispatch transaction

Before an external consequential call:

1. persist OperationId and exact request fingerprint;
2. bind required approval/current authority;
3. acquire durable attempt/lease;
4. reassert current authority immediately before dispatch when authorization may have changed;
5. dispatch using stable provider idempotency key when supported;
6. persist provider response/receipt;
7. settle domain state only according to deterministic rules.

If process dies after provider acceptance but before local settlement, recovery reconciles the same OperationId.

## Retry rule

Retry automatically only when one of these is true:
- dispatch is proven not to have started;
- provider documents the request as idempotent under the unchanged key;
- reconciliation proves the previous attempt did not create the effect;
- operation is inherently read-only.

Never retry a non-idempotent consequential effect merely because:
- caller timed out;
- connection closed;
- response parsing failed;
- worker crashed;
- local receipt persistence failed.

Those outcomes become `unknown`/reconciliation when dispatch may have happened.

## Attempt fencing

Every worker attempt has:
- attempt number/id;
- lease owner;
- generation/fencing token;
- startedAt;
- deadline;
- heartbeat/renewal when needed.

A stale attempt cannot settle a newer attempt/run generation.

## Outbox

Outbox rows are written transactionally with canonical state.

Fields:
- OutboxEventId;
- tenantId;
- event type/version;
- aggregate ref;
- payload/reference;
- correlation/causation;
- destination/topic class;
- state;
- attempt/fence;
- availableAt;
- createdAt;
- terminal receipt/error.

States:
`pending -> claimed -> dispatched -> acknowledged`
with `retry_scheduled | unknown | dead_letter` as needed.

Outbox consumers are idempotent.

## Inbox/deduplication

Inbound provider/webhook/channel events use durable admission identity.

Where provider redelivery exists:
- durable admission occurs before provider acknowledgement/cursor advance;
- duplicate event identity is rejected by persistent dedupe/tombstone;
- restart resumes one canonical queue/inbox path.

Non-replay transports still use local durable admission where crash recovery is required.

## External receipts

ExternalReceipt records:
- OperationId;
- provider;
- provider operation/message/transaction id;
- acceptedAt/observedAt;
- raw-status digest/reference, not unrestricted secret payload;
- provider status;
- amount/destination where relevant;
- reconciliation cursor/version;
- provenance.

Receipt is evidence, not automatically final business truth.

## Approval binding

Approval binds to:
- exact OperationId;
- tool/action/version;
- canonical arguments/request fingerprint;
- principal/tenant;
- scope/resource;
- policy revision if applicable;
- expiry;
- approval kind (once/session/policy).

Changing any authority-relevant field invalidates the approval.

## Checkpoints

WorkflowCheckpoint persists:
- WorkflowRunId;
- WorkflowVersionId/signature;
- predecessor/lineage;
- deterministic workflow state;
- executor/node state;
- edge/fan-in partial state;
- pending external/HITL requests;
- active OperationIds;
- revision/fence.

Restore requires version/signature compatibility or an explicit migration.

## Cancellation

Cancellation means "stop starting new work and request interruption where supported."

It does not prove already-started external effects were undone.

If dispatch may already have happened, cancellation leaves the Operation in reconciliation/terminal settlement custody.

## Current-authority mutation

Async preparation may capture an AuthorityContext.

Immediately before:
- canonical mutation;
- approval settlement;
- provider/device consequential dispatch;
- session ownership transfer;
- destructive operation;

the owner rechecks current policy/authority when revocation/change is possible.

A stale queued write fails rather than committing under old authority.

## Event ordering

Do not depend on global total ordering.

Guarantees:
- per aggregate, committed revisions establish order;
- per workflow run, checkpoint lineage establishes order;
- per ordered inbox/outbox lane, sequence establishes order;
- causation/correlation connect distributed transitions.

Consumers tolerate duplicate delivery and independent-event reordering.

## Schema evolution

Event types are stable logical names.

Breaking payload change increments `schemaVersion`.

Consumers either:
- support known versions;
- migrate through explicit adapter;
- reject unsupported version visibly.

Never reinterpret historical event bytes under a new schema silently.

## Privacy

Event payloads carry the minimum needed data.

Prefer IDs/references over duplicating private content.

Sensitivity classification controls:
- logging;
- telemetry;
- retention;
- export;
- fan-out.

Raw prompts, tool outputs, credentials, cookies, bearer tokens, and unrelated private memory are not default event metadata.

## Dead letter / needs attention

Retry exhaustion or unsafe ambiguity creates durable operator-visible state:
- reason class;
- OperationId/event;
- last known receipt;
- next allowed action;
- whether replay is safe;
- required authority.

Dead-letter state is not silent failure.

## Acceptance invariants

Phase 2 tests must prove:
- state + outbox atomicity;
- duplicate webhook/event admission is idempotent across restart;
- same idempotency key with changed payload conflicts;
- crash after external acceptance cannot duplicate effect;
- stale worker fence cannot settle current run;
- approval invalidates after request/authority change;
- cancellation does not falsely mark uncertain effect rolled back;
- outbox/inbox recovery survives process restart;
- unsupported event schema fails visibly.

# Event Model

## Purpose

Events decouple observability, learning, workflows and integrations without allowing an event bus to become an untyped second database.

## Four event classes

### Ephemeral telemetry
Examples:
- model token usage;
- latency sample;
- UI/session heartbeat.

May be sampled and does not define business truth.

### Durable domain event
Examples:
- task.transitioned;
- character.identity_activated;
- memory.corrected;
- world.event_committed.

Represents a state transition that matters to the domain.

### Immutable audit event
Examples:
- operator approval;
- credential rotation;
- financial execution authorization;
- identity publication.

Must retain actor, time, target, reason and correlation metadata.

### Integration/outbox event
Examples:
- social.publish_requested;
- message.send_requested;
- provider.purchase_requested.

Written transactionally with state that caused the side effect, claimed by workers, idempotent and reconciled.

## Event envelope

Canonical event fields should include:
- event_id;
- event_type;
- schema_version;
- occurred_at;
- correlation_id;
- causation_id;
- organization/tenant ID when applicable;
- character ID when applicable;
- platform user subject when privacy-safe;
- conversation/session/task/workflow IDs as applicable;
- actor type/ID;
- payload;
- privacy/sensitivity class.

## Rules

- Event schema versions are explicit.
- Consumers must tolerate duplicate delivery where durable delivery is used.
- Side effects use idempotency keys.
- Events do not contain secrets.
- Private user content is minimized.
- Audit events are append-only.
- Replaying an integration event must not duplicate an already-confirmed external side effect.

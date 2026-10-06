# Proactive promises and commitments

Status: Production Task 114 isolated implementation.

## Purpose

A conversational promise such as “I’ll check back tomorrow” must not remain only in model
text. Task 114 provides a canonical Relationship-scoped obligation record that can be
replayed, revised, fulfilled/cancelled and compiled into a Task-113 trigger without
granting execution authority.

## Commitment scope

Every commitment binds to the exact canonical:
- Tenant;
- User;
- Character;
- Relationship.

Each record has a bounded `commitmentKey`, semantic kind (`promise` or `commitment`),
responsible party (`character` or `user`), human-readable statement and revision.

## Due conditions

Three due forms are supported:

- time: exact instant + IANA timezone;
- event: canonical Task-113 event type/scope/filters;
- manual: no automatic trigger.

Time/event due definitions are normalized through the Task-113 trigger validator so they
cannot bypass its timezone/filter bounds.

## Lifecycle

New commitments begin `open` at revision 1.

Open commitments may be revised only through exact expected revision custody.

Resolution is terminal:
- `fulfilled`;
- `cancelled`.

Resolution records `resolvedAt` and an optional bounded note. Exact lost-response replay
must match the durable resolution timestamp/note. A different replay fails closed.

## Follow-up compilation

`compileCommitmentFollowUpTrigger()` creates only a Task-113 trigger:

- time due -> one-shot schedule;
- event due -> event trigger;
- manual due -> no trigger;
- fulfilled/cancelled -> no trigger.

The generated key is `followup.<commitmentKey>`.

The commitment does not contain Tool IDs, Provider IDs, credentials, workflow commands,
callback URLs or arbitrary code. A later runtime still has to admit any action through the
normal Agent/Tool/approval boundaries.

## Integration boundary

Task 115 must apply quiet-hours, frequency and privacy policy before any compiled trigger
can notify or act.
Task 116 may connect World/routine evidence to these commitments without changing their
canonical Relationship scope.

No persistence, scheduler, Gateway, mobile or worker integration is claimed here.

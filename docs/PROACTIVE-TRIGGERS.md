# Proactive trigger contracts

Status: Production Task 113 isolated implementation.

## Scope

This package defines trigger facts only. It does not execute Tools, workflows, payments,
messages, Devices or provider calls.

Every trigger is scoped to the exact canonical:

- Tenant;
- User;
- Character;
- Relationship.

A bounded tenant-scoped `triggerKey` plus monotonic revision identifies trigger state.
No new global ID kind was introduced and `TaskId` is not misused as trigger identity.

## Trigger kinds

### Schedule

Supported schedule shapes:

- one-shot UTC instant;
- bounded interval (minimum 5 minutes, maximum 365 days);
- daily local clock time;
- weekly local clock time + unique weekdays.

Every schedule carries an explicit valid IANA timezone. Local-time forms use strict
24-hour `HH:MM`.

This package does not calculate the next run or own a scheduler; it only validates the
schedule definition.

### Event

Event triggers contain:

- stable bounded event type;
- explicit source scope (Tenant/User/Relationship/Character);
- up to 16 bounded equality-style filter facts.

Filter keys are canonicalized and case-collisions are rejected.

Event filters are data only. They cannot carry code or runtime authority.

### Condition

Condition watches contain:

- stable observation key;
- typed operator;
- scalar expected value;
- evaluation cadence (5 minutes to 24 hours);
- consecutive-match requirement (1–10);
- cooldown (0–7 days).

Numeric comparison operators require numeric values and `contains` requires a string.

The watch contract deliberately contains no callback URL, script, Tool, Provider or
credential reference.

## Lifecycle

`createProactiveTrigger()` creates revision 1 in active state.

`reviseProactiveTrigger()`:
- requires the exact observed revision;
- rejects revision of revoked triggers;
- increments revision;
- preserves canonical scope/trigger identity.

`transitionProactiveTrigger()`:
- supports active/paused/revoked state;
- requires exact revision;
- treats same-state calls as exact replay;
- makes revoked terminal.

These are domain CAS semantics only. Durable storage remains a later integration concern.

## Dependency boundaries

Task 114 can build commitments/follow-ups on this trigger model.
Task 115 owns quiet-hours/frequency/privacy policy.
Task 116 owns routine/world-event integration.
Task 118 owns governed end-to-end acceptance.

No package lockfile, worker, scheduler, Gateway, mobile or persistence integration is
claimed here.

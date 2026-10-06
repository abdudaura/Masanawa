# Device sensor perception contracts

Status: Task 112 isolated implementation.

## Purpose

Task 109 defines the canonical permission-scoped `PerceptionEvent`. Task 111 adds
microphone/camera/screen capture admission. This slice completes the remaining Device
sensor observations required before proactive and presence layers can safely consume them:

- notification summaries;
- Device-state snapshots;
- location samples.

These remain observations only. They do not create DeviceCapability authority, User
identity, memory, proactive permission or workflow execution rights.

## Common Device envelope

Every sensor observation requires:

- canonical DeviceId;
- exact Tenant/User subject scope;
- `device-permission` authority evidence;
- explicit privacy/retention policy;
- stable Device + observation dedupe identity;
- trusted observed/received timestamps.

A caller cannot substitute `user-action`, channel consent or system policy for the Device
permission evidence expected by these sensor contracts.

## Notifications

Notification perception admits bounded:
- application id;
- notification key;
- title/body;
- category;
- ongoing flag.

Title or body must be present. The normalized payload is JSON with bounded metadata. This
contract intentionally does not admit notification actions, remote-input tokens, PendingIntent
handles, authentication tokens or arbitrary extras.

## Device state

Device-state observations may contain:
- battery percentage;
- charging state;
- network class;
- metered status;
- power-save state;
- screen-interactive state.

At least one fact must actually be observed. These values are Device state only: they do
not assert support for telephony/SMS/camera/automation capabilities. DeviceCapability
publication remains the Task-105 authority.

## Location

Location is deliberately stricter:

- privacy scope must be `user-private`;
- retention may be ephemeral/session only;
- memory promotion is always forbidden;
- permission precision is explicit: `coarse` or `precise`;
- latitude/longitude/accuracy bounds are enforced;
- coarse permission refuses suspiciously precise accuracy (<100 m);
- coarse coordinates are reduced to two decimal places;
- altitude and speed are stripped from coarse observations.

This Task-112 contract does not implement background-location schedules, quiet hours,
proactive triggers or memory promotion. Those remain Tasks 113-117.

## Integration

Device/Android owners should create these events only from currently granted OS permission
state. Gateway/perception custody can then dedupe and route normalized events under the
existing Task-109 permission/privacy rules.

No package barrel, workspace manifest, Gateway, Android or persistence composition is
claimed by this slice.

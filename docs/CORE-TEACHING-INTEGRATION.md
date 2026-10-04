# Core Teaching integration contract

Status: stacked integration slice over Core Teaching PR #94.

## Goal

Wire Core Teaching into Masanawa's existing runtime, persistence and presentation
authorities without creating a Teaching-specific Gateway, memory store, workflow engine,
channel protocol or client action system.

The integration owner is `TeachingRuntimeCoordinator` in `@masanawa/skills`. It is a
provider-neutral orchestration seam, not a new durable authority.

## Runtime flow

1. Runtime admits the exact Core Teaching SkillVersion through the existing Character
   assignment/readiness/AgentRun checks.
2. Runtime supplies an exact `TeachingLessonPlan` bound to the active Relationship and
   SkillVersion.
3. `resume()` asks `TeachingProgressPort` for durable progress using only that
   Relationship + SkillVersion key.
4. With no progress, the coordinator projects the first lesson step.
5. With progress, deterministic Teaching continuity chooses continue, reteach, advance
   or sequence-complete.
6. A selectable exercise is projected through `presentExercise()`; client-safe cards
   never contain the answer rubric.
7. A returned selection is evaluated against the server-side rubric.
8. Before feedback is published, `commitSelectionAttempt()` must atomically persist the
   exact selection attempt and resulting progress.
9. The caller-provided canonical `RequestId` is the replay identity. Persistence must
   return `replay` for an identical repeat and reject changed payload under the same ID.
10. Only after persistence succeeds does the coordinator return/publish authoritative
    feedback and the next continuation decision.

## Owner wiring

### PR #89 — Agent runtime/Gateway/mobile controller

Compose the coordinator only after existing Skill admission has established:
- active Character/Relationship/session/run scope;
- exact assigned SkillVersion;
- current readiness/certification;
- current authority and runtime limits.

The runtime owner supplies the durable `TeachingProgressPort` adapter. Its implementation
must write through canonical private Relationship Memory and/or Workflow custody rather
than a new education table unless a later ADR explicitly assigns such storage.

Do not trust client RelationshipId, SkillVersionId, lessonStepKey, exerciseKey or
RequestId without resolving them from the authenticated server session/action binding.

### PR #91 — chat shell/actions

Map `TeachingRuntimeProjection` to the existing server-authored ShellDocument model:
- `lesson-step` -> text/detail/progress content;
- `exercise` -> existing options/form components with opaque authenticated actions;
- `feedback` -> notice/detail/progress plus the next lesson projection.

The answer rubric remains server-side. Never serialize `correctOptionKeys` into the
ShellDocument or native encrypted action journal.

The existing ShellAction idempotency/reconciliation protocol remains canonical. The
Teaching `RequestId` must be derived/bound server-side from that confirmed action and
remain stable across retry/restart.

### PR #92 — WhatsApp and Telegram

Inbound option/button data remains untrusted opaque selection evidence. Gateway/runtime
must resolve it to the authenticated Teaching exercise binding before calling
`submitSelection()`.

WhatsApp/Telegram must not persist channel-local lesson truth. The same Relationship
progress is loaded when the user continues from app, WhatsApp or Telegram after verified
account linking.

Outbound text/audio/options are channel projections of the same Teaching runtime result;
channel delivery receipts are transport evidence, not proof of learner understanding.

## Replay and uncertain outcomes

A network timeout after `commitSelectionAttempt()` may leave the caller uncertain even
though progress was stored. The caller must retry with the same canonical RequestId.
The persistence adapter reconciles it as `replay`; it must never create a second attempt
or advance twice.

Changed selection payload under an already-used RequestId is a conflict and must fail
closed.

## Privacy

Learning progress is Relationship-private. Cross-Relationship resume, rubric submission
or persistence is rejected. Channel identity linking does not upgrade transport evidence
into memory authority.

## Still outside this slice

- actual PostgreSQL/Memory/Workflow adapter implementation in #89-owned paths;
- Gateway route/controller composition;
- ShellDocument renderer/controller binding in #91-owned paths;
- WhatsApp/Telegram outbound delivery or webhook composition in #92-owned paths;
- real app/WhatsApp/Telegram/voice rehearsal evidence;
- deployment.

Those owners received coordination comments from PR #96. This branch does not overwrite
their active work.


## Stable replay fingerprint

`fingerprintTeachingSelectionAttempt()` produces a canonical SHA-256 fingerprint over:
RelationshipId, exact SkillVersionId, lesson step, exercise and the normalized selected
option set. Multi-select order is normalized before hashing.

The durable progress adapter must persist `requestId + payloadHash` together. A retry
with the same RequestId and hash is an exact replay; a different hash under that RequestId
is a conflict. Receipt time is deliberately not part of the fingerprint, so a lost
response may be retried later without turning the same learner action into a second
attempt.

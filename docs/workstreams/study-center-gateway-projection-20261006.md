# Study Center Gateway projection seam

Status: ISOLATED SERVER PROJECTION COMPLETE — shared route/runtime composition remains
Branch: `work/study-center-gateway-projection-20261006`
Base: PR #215 / Core Teaching #96 stack
PR: #220

## Ownership

Changed paths only:
- `services/gateway/src/study_center_room.ts`
- `services/gateway/src/study_center_room.test.ts`
- `docs/workstreams/study-center-gateway-projection-20261006.md`

No edits to Gateway `app.ts`/`main.ts`, mobile router/chat/transport, Teaching domain/runtime
files, Memory adapter files, channels, migrations, production environment or APK paths.

## Completed

- Exact Lane T Study Center mobile wire projection.
- Canonical `normalizeTeachingLessonPlan()` validation before projection.
- Continuation derived through canonical `resolveTeachingContinuation()`, mapped to
  continue/reteach/advance/complete.
- Durable progress/resume presentation using PR #215 `TeachingStoredProgress`.
- Text/voice capability projection from canonical learner preferred modalities.
- Lesson-step projection.
- Feedback projection with bounded positive-progress presentation.
- Teaching artifact projection with Relationship/SkillVersion scope checks and no raw
  artifact reference exposure in the mobile card.
- Bound single-select projection using opaque selection ids only.
- Staged multi-select projection preserving canonical server-held stage revision and
  selected option set for stale-action rejection.
- Free-response projection using a server-held opaque pending-action token.
- Exact visible-option coverage and unique opaque selection-id checks.
- Bound selectable action token must match the Teaching runtime's bound action key.
- No RelationshipId, SkillVersionId, RequestId, rubric or correct-answer data enters the
  returned mobile projection.
- Focused tests cover first lesson, text/voice, reteach/advance, single-select secrecy,
  staged multi-select revision, free response, missing/incomplete action projection and
  feedback privacy.

## Architecture boundary

This module is a presentation adapter over Core Teaching. It does not create lessons,
evaluate answers, persist progress, own pending actions or run evidence Tools. Those remain
with #94/#96/#215 and authenticated runtime/session custody.

## Verification

- Gateway already depends on `@masanawa/skills`.
- PR changed-file audit is exactly the three claimed files.
- Foundation CI run `37451986782`, job `112230464597`, failed before checkout with
  `steps = null`; no code/test verdict is fabricated.
- Types and mapping were manually audited against current PR #96/#215 Teaching contracts
  and exact PR #205 mobile models.

## Remaining shared-owner work

- Shared runtime: compose admitted Core Teaching with PR #215 durable progress.
- Authenticated pending-action owner: retain/free-response and staged multi-select server custody.
- #136: mount Study Center route/navigation and map mobile intents to the exact pending action.
- #92/channel owner: preserve the same action/progress state across WhatsApp/Telegram.
- #136: physical voice/text/device qualification.

**No further isolated implementation remains in this server projection slice.**

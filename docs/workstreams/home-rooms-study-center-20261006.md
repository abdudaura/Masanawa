# Home/Rooms Lane T — Study Center

Status: ISOLATED STUDY CENTER COMPLETE — shared runtime composition only remains
Branch: `work/home-rooms-study-center-20261006`
Base: `work/integration-core-teaching-20261004` (Core Teaching PR #96)
PR: #205

## Ownership

This continuation owns only:
- `apps/mobile/lib/src/rooms/study_center/**`
- `apps/mobile/test/rooms/study_center/**`
- `docs/workstreams/home-rooms-study-center-20261006.md`

It consumes canonical Core Teaching contracts from PRs #94/#96 and does not create another teaching engine or learner-progress authority.

## Completed

- Study Center Room projection with topic, language and server-projected progress.
- Explicit text/voice capability presentation without local TTS authority.
- Continue/reteach/advance/complete progress states.
- Lesson, feedback, artifact, single-select, multi-select and free-response presentation.
- Opaque server-authored action tokens and option selection IDs only.
- Multi-select revision propagation so stale server-held stages can be rejected upstream.
- Free-response input bounded to the same 16,384-character limit defined by Core Teaching integration.
- Typed action intents for select/toggle/commit/free-response/listen/artifact without RelationshipId, SkillVersionId, rubric, RequestId or answer-key authority on the client.
- Loading, unavailable, stale-with-warning and retry states.
- Focused model tests for parsing, impossible progress, presentation capability constraints and action authority boundaries.
- Focused widget tests for opaque selection dispatch, free-response dispatch and retry behavior.

## Canonical Teaching dependencies already satisfied by PR #96

PR #96 already defines:
- exact Relationship + SkillVersion + certified Guide binding;
- planHash continuity;
- continue/reteach/advance/complete runtime behavior;
- replay-safe selectable/free-response attempts;
- single-select and staged multi-select server bindings;
- ShellDocument and channel projection contracts;
- voice/text continuity semantics;
- durable `TeachingProgressPort` and `TeachingMultiSelectStagePort` boundaries.

This lane presents those semantics; it does not duplicate them.

## Remaining shared-owner integration

These are outside this lane's authorized files:
- #89 / shared runtime owner: compose Relationship-private TeachingProgressPort and staged-state custody through canonical Memory/Workflow/Postgres.
- #91 / #136: route Study Center actions into existing server-authored Shell actions/runtime and navigation.
- #92: preserve the same pending Teaching bindings across WhatsApp/Telegram.
- #136: wire Room deep link, production transport, live voice entry and release APK/device acceptance.

No additional isolated Study Center logic is required before those owners compose it.

## Validation

Mobile Build run `37446031449` failed before checkout: its only job exposes `steps = null`. This is hosted runner allocation failure, not a Flutter result.
Foundation CI run `37446031598` was queued at the completion checkpoint; no pass/fail is fabricated.

## Commit trail

- claim: `5b617b303208fbdaeb0d8f3b2e8a0863932f8e6d`
- models: `1265a4f0189819e540e4881d0611da16317690b7`
- screen: `e6362acf5e08ee9a28ee4dcb849968f78c982f1b`
- model tests: `71bb0cdb8b92c26a36ede54ad015390eebba48e4`
- widget tests: `dfba093c8d58b04ad35a0b9e38263e4bafd9f302`

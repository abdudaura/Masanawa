# Home/Rooms Lane T — Study Center

Status: CLAIMED — 2026-10-06
Branch: `work/home-rooms-study-center-20261006`
Base: `work/integration-core-teaching-20261004` (Core Teaching integration PR #96)

## Ownership

This continuation owns only new isolated Study Center presentation paths:
- `apps/mobile/lib/src/rooms/study_center/**`
- `apps/mobile/test/rooms/study_center/**`
- `docs/workstreams/home-rooms-study-center-20261006.md`

It consumes the canonical Core Teaching contracts already defined by PRs #94/#96. It does not create another teaching engine or learner-progress authority.

## Deliverables

- Study Center Room projection model.
- Durable-progress presentation/resume state contract.
- Lesson-step, feedback and artifact presentation.
- Text/voice presentation parity flags.
- Selectable single/multi answer action intents using opaque server-authored action ids.
- Free-response action intent without client-selected learner scope.
- Continue/reteach/advance/complete presentation.
- Loading/error/empty/retry states.
- Focused model/widget tests.

## Explicit exclusions

Do not edit:
- PR #136 shared Gateway/mobile router/chat/transport/APK files;
- PR #89 runtime/Gateway-owned composition;
- PR #91 shared Shell renderer/coordinator files;
- PR #92 channel ingress/outbound files;
- production environment;
- Commerce/Event migrations;
- Teaching learner-progress persistence authority outside the published PR #96 ports.

## Integration dependency rule

The Study Center UI emits only opaque server-owned action references and typed presentation intents. Canonical Teaching runtime, Relationship-private persistence and cross-channel continuity remain authoritative upstream.
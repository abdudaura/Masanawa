# Study Center Gateway projection seam

Status: CLAIMED — 2026-10-06
Branch: `work/study-center-gateway-projection-20261006`
Base: PR #215 / Core Teaching #96 stack

Owned paths only:
- `services/gateway/src/study_center_room.ts`
- `services/gateway/src/study_center_room.test.ts`
- `docs/workstreams/study-center-gateway-projection-20261006.md`

No edits to Gateway `app.ts`/`main.ts`, mobile router/chat/transport, Teaching domain/runtime files, Memory adapter files, channels, migrations, production env or APK paths.

Goal:
- translate canonical Core Teaching lesson/runtime/progress/action state into the exact Lane T mobile Study Center projection;
- preserve text/voice presentation parity;
- expose only opaque action/selection ids;
- map single-select, staged multi-select, free response, lesson, feedback and artifacts;
- derive resume/continuation from canonical Teaching progress/plan;
- never expose RelationshipId, SkillVersionId, RequestId, rubric or correct answers.

The #136/shared owner later mounts routes and resolves returned opaque actions through #96/#215.
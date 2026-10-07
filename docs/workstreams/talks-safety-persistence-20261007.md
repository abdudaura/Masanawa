# Talk safety persistence + HTTP — 2026-10-07

- **Owner/window:** current ChatGPT transformation window
- **Branch:** `work/talks-safety-persistence-20261007`
- **Base SHA:** `157a8f7129a79aac9a2ff4c8449830f4412282ef`
- **Lane:** durable reports, viewer block/mute, platform enforcement + HTTP contracts
- **Lease:** active

Owned:
- `packages/talks/migrations/0009_talk_safety.sql`
- `services/gateway/src/talk_safety/repository.ts`
- `services/gateway/src/talk_safety/service.ts`
- `services/gateway/src/talk_safety/*.test.ts` additions
- `services/gateway/src/talk_safety_routes.ts`
- `services/gateway/src/talk_safety_routes.test.ts`
- this handoff

Not owned:
- shared Gateway app/main composition while Gift/shared integration work is active
- mobile/admin UI
- ranking/search files
- replay/AI Seat/gift internals
- production deployment

Rules:
- Reports are authenticated evidence and idempotent by reporter/client request identity.
- User block/mute remains viewer-local.
- Profile-handle -> subject user resolution is server-side.
- Platform enforcement requires a distinct safety authority, never ordinary customer auth.
- Enforcement is CAS revisioned.
- Global blocked/restricted state can later be hard-filtered by search/ranking/replay/profile projections.
- Replay block integration must still invoke canonical replay `platform_block` when wired.

Status: implementing persistence/service/routes/tests.

# Talk safety composition — 2026-10-07

- **Owner:** current ChatGPT Talks implementation window
- **Branch:** `work/talks-safety-composition-20261007`
- **Base:** `dbd64c530407fe3bd2b6d3c82a03d552d5c528dc`
- **Lane:** register durable Talk safety HTTP routes and compose customer/admin authorities
- **Owned paths:**
  - isolated additions to `services/gateway/src/app.ts`
  - isolated additions to `services/gateway/src/main.ts`
  - `services/gateway/src/talk_safety/platform_authority.ts`
  - `services/gateway/src/talk_safety/replay_bridge.ts`
  - focused composition/authority/replay-bridge/route tests only as needed
  - this workstream
- **Reuses:** merged `talk_safety` policy, repository, service and routes; existing platform customer sessions; existing admin-principal configuration pattern.
- **Not owned:** safety persistence/enforcement SQL, mobile/admin UI, unrelated Talk domains.
- **Rules:** customer auth can report/block/mute only; global enforcement requires distinct admin/platform-safety authority; no admin privilege may be inferred from ordinary customer session alone.
- **Status:** active.

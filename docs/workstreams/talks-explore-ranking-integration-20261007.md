# Talk Explore ranking integration — 2026-10-07

- **Owner/window:** current ChatGPT transformation window
- **Branch:** `work/talks-explore-ranking-integration-20261007`
- **Base SHA:** `2661b402f8a60582059d59736ae35180f35bb261`
- **Lane:** wire canonical Explore ranking into authenticated Talk feed
- **Lease:** active

Owned:
- `services/gateway/src/talks/model.ts`
- `services/gateway/src/talks/service.ts`
- `services/gateway/src/talks/postgres_repository.ts`
- focused Talk service/repository tests
- compatibility update to `services/gateway/src/talk_safety/enforcement_integration.test.ts`
- this handoff

Not owned:
- mobile UI
- search backend
- ranking algorithm module
- shared Gateway app/main composition
- Gift/replay mobile
- safety mutation backend
- migrations/deployment

Rules:
- Platform-safety filtering remains before ranking.
- Repository returns only safe ranking signals.
- Explore uses merged explainable ranking + Host diversity.
- Live feed stays live-only and deterministic; no replay mixing.
- Follow boost derives from canonical `talks.follows` for authenticated viewer.
- Reaction count derives from canonical participation rows, not client input.
- No fake language/relevance personalization: Explore supplies neutral values until real context exists.
- Viewer identity is server-derived from customer session.
- Ranking does not expose scores/reasons in the public mobile contract.

Status: implementing.

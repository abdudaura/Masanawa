# Talk discovery ranking integration — 2026-10-07

- **Owner:** current ChatGPT Talks implementation window
- **Branch:** `work/talks-discovery-ranking-integration-20261007`
- **Base:** `753129ff33c4a5e1021b872180809da206352855`
- **Lane:** integrate deterministic Explore ranking into canonical Talk feed
- **Owned paths:**
  - isolated additions under `services/gateway/src/talks/**`
  - isolated additions under `services/gateway/src/talk_routes.ts` only if required
  - focused ranking-integration tests
  - this workstream
- **Reuses:** merged `talk_ranking/ranking.ts`, existing safety filters, existing follow/profile projections.
- **Rules:** safety filtering remains upstream and cannot be bypassed; Live feed remains operational rather than personalized; no permanent language preference is introduced.
- **Status:** active.

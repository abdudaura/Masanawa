# Talk Explore ranking integration — 2026-10-07

- **Owner/window:** current ChatGPT transformation window
- **Branch:** `work/talks-explore-ranking-integration-main-20261007`
- **Base SHA:** `753129ff33c4a5e1021b872180809da206352855`
- **Original claim branch:** `work/talks-explore-ranking-integration-20261007`
- **Lane:** wire canonical Explore ranking into authenticated Talk feed
- **Lease:** released with implementation handoff

## Owned

- `services/gateway/src/talks/model.ts`
- `services/gateway/src/talks/service.ts`
- `services/gateway/src/talks/postgres_repository.ts`
- `services/gateway/src/talks/service.test.ts`
- `services/gateway/src/talks/postgres_repository.test.ts`
- compatibility updates to:
  - `services/gateway/src/talk_routes.test.ts`
  - `services/gateway/src/talk_safety/enforcement_integration.test.ts`
- this handoff

## Implemented

- Authenticated viewer id now enters the internal Talk feed repository projection.
- Repository projects safe, server-owned ranking signals:
  - listener count;
  - comment count;
  - reaction count from canonical `talks.participation`;
  - followed-Host state from canonical `talks.follows`.
- Platform-safety filtering remains in SQL before any candidate reaches ranking.
- Explore reads up to 150 eligible candidates, applies the merged explainable ranking, applies max-two consecutive Host diversification, then returns the top 50.
- Live feed remains live-only and bypasses Explore ranking/diversification.
- No ranking score/reason leaks into the mobile Talk card contract.
- No synthetic language/relevance personalization is invented: both are neutral until a real request-context signal exists.
- Existing Talk route and safety integration fixtures were updated for viewer-scoped repository reads.

## Tests

- meaningful engagement can beat pure recency;
- followed Host gets a modest boost;
- one Host cannot occupy more than two consecutive Explore slots when alternatives exist;
- Live feed remains live-only;
- repository SQL projects reaction/follow signals with authenticated viewer scope;
- existing Talk route and safety tests remain contract-compatible.

## Handoff

A future contextual-ranking lane may provide real query/current-turn language relevance values, but must not create permanent account language preferences merely to feed ranking.

No mobile UI, search backend, ranking-algorithm module, migration, shared Gateway composition or production deployment was changed.

**Status:** Explore ranking is integrated into the canonical Talk feed.

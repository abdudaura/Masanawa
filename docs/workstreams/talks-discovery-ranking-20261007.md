# Talk discovery ranking policy — 2026-10-07

- **Owner/window:** current ChatGPT transformation window
- **Branch:** `work/talks-discovery-ranking-20261007`
- **Base SHA:** `db68cdc450de891bfa5db7ce9217584870a04190`
- **Lane:** deterministic Explore ranking policy over canonical Talk discovery projections
- **Lease:** released with implementation handoff

## Owned paths

- `services/gateway/src/talk_ranking/ranking.ts`
- `services/gateway/src/talk_ranking/ranking.test.ts`
- `docs/workstreams/talks-discovery-ranking-20261007.md`

## Implemented

- Pure deterministic Explore scorer with no opaque ML dependency.
- State priority: **live > reconnecting > ended/replay**.
- Log-bounded engagement score from listener/comment/reaction counts so a huge Talk cannot grow score without bound.
- Freshness decay that matters without allowing raw recency to dominate an engaged live Talk.
- Bounded topical relevance boost.
- Bounded dynamic language-match boost; there is no hardcoded account language preference.
- Modest followed-Host personalization that can be beaten by a strong unfamiliar Host.
- Deterministic tie-breaking by score, update time, then Talk id.
- Duplicate Talk rejection and bounded signal validation.
- Optional Host-diversification pass preventing long same-Host runs while preserving underlying scores/reasons.
- Explainable reason tags for observability/debugging.

## Safety/privacy boundary

Ranking accepts only safe product-level projections. It does not accept:
- private memory;
- provider/model/Skill internals;
- raw balances/payment history;
- sensitive profile attributes;
- moderation-ineligible content.

Safety eligibility remains a hard upstream filter; ranking cannot rescue blocked content.

## Integration handoff

The feed/search projection owner should enrich each eligible canonical Talk with:
- state;
- listener/comment/reaction counts;
- current started/updated timestamps;
- whether the authenticated viewer follows the Host;
- query/context relevance in [0,1];
- dynamic current-turn/device-content language match in [0,1].

Then call `rankTalksForExplore`; optionally call `diversifyRankedTalks` using canonical Host ids.

Do not infer or persist a permanent language preference merely to feed this algorithm.

**Status:** implementation complete for the isolated ranking policy.

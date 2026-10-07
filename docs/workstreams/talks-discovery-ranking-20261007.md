# Talk discovery ranking policy — 2026-10-07

- **Owner/window:** current ChatGPT transformation window
- **Branch:** `work/talks-discovery-ranking-20261007`
- **Base SHA:** `db68cdc450de891bfa5db7ce9217584870a04190`
- **Claim published:** 2026-10-07 10:42 UTC
- **Lane:** deterministic Explore ranking policy over canonical Talk discovery projections
- **Lease:** 5 minutes from latest repository-visible work

## Owned paths

- `services/gateway/src/talk_ranking/**`
- focused ranking tests
- `docs/workstreams/talks-discovery-ranking-20261007.md`

## Not owned

- shared Gateway composition/routes while other integration lanes are active
- Talk persistence/migrations
- global Search backend
- replay, AI Seat commerce, gifts, moderation
- mobile UI
- Billing/Crypto/channels/deployment

## Product rules

- Live Talks outrank reconnecting and replay/ended Talks.
- Ranking may use only safe product signals already projected by canonical Talk/social data.
- No private memory, model/provider data, Skills, raw financial balance, or hidden sensitive profile attributes.
- Freshness matters, but pure recency must not dominate meaningful live engagement.
- Follows may personalize modestly; they must not permanently lock out unfamiliar Hosts.
- Language is inferred dynamically from content/viewer context where available, never a hardcoded account preference.
- Safety/enforcement eligibility is a hard filter upstream; ranking never rescues an ineligible Talk.
- Deterministic tie-breaking prevents feed jitter.
- Ranking remains explainable and bounded; no opaque ML dependency is introduced at launch.

## Status

Claim active. Implementing pure ranking contract + tests.

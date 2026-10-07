# Global Talk search backend — 2026-10-07

Owner/window: current ChatGPT implementation window
Branch: `work/talks-global-search-backend-20261007`
Base: `ab4029e4d883990e9ceb88714f497413b7af5859`

## Scope

Implement the authenticated tenant-scoped Gateway projection behind the already-merged
mobile global Search surface.

Owned paths:
- new `services/gateway/src/talk_search/**`
- new `services/gateway/src/talk_search_routes.ts`
- focused search tests
- minimal fresh-read composition edits in `services/gateway/src/app.ts` and
  `services/gateway/src/main.ts`
- this handoff

No migration is planned: launch search reads the existing canonical Talk/public-profile/
persona-profile projections. Search-specific indexing can be introduced later from measured
production evidence rather than creating speculative schema now.

Not owned:
- Talk persistence/lifecycle
- social-profile mutation/follows
- AI Seat Commerce
- replay runtime/storage
- mobile Search UI
- production deployment

## Contract

GET `/search?q=<query>&type=all|talks|people|experts|twins&limit=30`

Response:
`{ talks: [], people: [], personas: [] }`

Rules:
- authenticated and tenant-scoped;
- query normalized and bounded;
- literal wildcard characters do not become SQL wildcards;
- only canonical public Talk/profile/persona projections are returned;
- Talk search includes live/reconnecting/published-ended Talks, with live results ranked first;
- People search uses public profiles only;
- Expert/Twin filtering is exact by persona kind;
- no model/provider/Skill/runtime internals can leak;
- deterministic limits and ranking;
- `all` uses a balanced bounded result budget rather than returning limit results per category.

## Implementation checkpoint

Implemented:
- authenticated `GET /search` Gateway route;
- filters: **all · talks · people · experts · twins**;
- normalized 2–120 character queries and bounded 1–50 result limits;
- literal escaping for PostgreSQL `ILIKE` metacharacters `%`, `_`, and `\\`;
- balanced `all` budget so the caller limit is the total result budget rather than
  multiplying by three categories;
- tenant-scoped Talk search over title/topic/summary/Host name;
- Talk ordering prioritizes **live → reconnecting → ended**, then exact/prefix relevance,
  listener count and recency;
- Host avatar projection from the canonical public human profile;
- public People search over handle/display name/bio with live state validated against the
  canonical Talk lifecycle instead of trusting a stale profile pointer;
- persona search over display name/role/bio/topics;
- exact Expert/Twin kind filtering;
- unverified Expert rows excluded from discovery;
- available/verified personas ranked before unavailable/unverified equivalents;
- no migration and no search copy of private Agent/Skill/provider/runtime state;
- focused service, repository and HTTP-route tests;
- production composition through the same platform-session authorizer and PostgreSQL pool
  used by Talks/Profiles/Activity.

No schema migration is required for launch. If measured production search volume later
justifies trigram/FTS indexes, that should be a separate evidence-backed optimization.

Status: implementation complete and ready for merge.

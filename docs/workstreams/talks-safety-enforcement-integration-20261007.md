# Talk safety enforcement integration — 2026-10-07

- **Owner/window:** current ChatGPT transformation window
- **Branch:** `work/talks-safety-enforcement-integration-20261007`
- **Base SHA:** `1ec7c6d74380f83a636f67d76c89641baa9372cf`
- **Lane:** hard-filter restricted/blocked Talk network entities from discovery/access
- **Lease:** active

Owned:
- bounded safety-filter edits in:
  - `services/gateway/src/talks/postgres_repository.ts`
  - `services/gateway/src/talk_search/postgres_repository.ts`
  - `services/gateway/src/talk_profiles/postgres_repository.ts`
  - replay playback repository/access path only
- focused tests
- this handoff

Not owned:
- shared Gateway app/main composition
- safety mutation service/routes
- mobile/admin UI
- Gift lane
- ranking policy
- production deployment

Rules:
- restricted/blocked targets never appear in public discovery/search.
- blocked/restricted public profile/persona is hidden from non-admin customer reads.
- blocked/restricted Talk prevents public detail/comment path unless an explicit private/admin exception exists.
- blocked replay cannot produce a playback URL.
- safety filtering happens before ranking.
- Host ownership/private management may remain accessible where existing service semantics explicitly require it.
- no client-side-only hiding.

Status: implementing server-side enforcement filters + regression tests.

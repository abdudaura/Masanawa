# Talk safety / reporting core — 2026-10-07

- **Owner/window:** current ChatGPT transformation window
- **Branch:** `work/talks-safety-core-20261007`
- **Base SHA:** `112ee591fb8c3589e0577a1ac55d7cb47315474b`
- **Claim published:** 2026-10-07 10:45 UTC
- **Lane:** canonical reporting, block/mute and platform-enforcement policy for Talk network
- **Lease:** 5 minutes from latest repository-visible work

## Owned paths
- `services/gateway/src/talk_safety/**`
- focused safety tests
- `docs/workstreams/talks-safety-core-20261007.md`

## Not owned
- shared Gateway composition/routes
- migrations/persistence
- Host moderation backend
- replay storage
- AI Seat commerce
- gifts
- mobile UI/admin UI
- production deployment

## Product rules
- Host moderation and platform safety are distinct authorities.
- User block/mute affects the viewer's experience and never silently creates platform enforcement.
- Platform enforcement may hide a Talk/replay/comment/profile/persona from discovery/public access.
- Replay enforcement must map to the canonical replay `platform_block` transition during integration.
- Reports are authenticated evidence, not automatic guilt or takedown.
- Duplicate report submission is idempotent by reporter + target + reason + client request identity.
- Safety decisions are revisioned and auditable.
- Ranking/search must hard-filter platform-ineligible entities before scoring.
- No provider/model/Skill internals or private memory enter moderation evidence.

## Status
Claim active. Implementing core policy and focused tests.

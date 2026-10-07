# Talk safety / reporting core — 2026-10-07

- **Owner/window:** current ChatGPT transformation window
- **Branch:** `work/talks-safety-core-20261007`
- **Base SHA:** `112ee591fb8c3589e0577a1ac55d7cb47315474b`
- **Lane:** canonical reporting, block/mute and platform-enforcement policy for Talk network
- **Lease:** released with implementation handoff

## Owned paths
- `services/gateway/src/talk_safety/policy.ts`
- `services/gateway/src/talk_safety/policy.test.ts`
- `docs/workstreams/talks-safety-core-20261007.md`

## Implemented
- Typed report targets: Talk, replay, comment, profile, persona.
- Typed report reasons with bounded optional detail.
- Deterministic report fingerprinting for idempotent persistence.
- Viewer-local user block/mute preference contract.
- Revisioned platform enforcement with `public | restricted | blocked`.
- Hard discovery/public-access removal for platform-restricted/blocked targets.
- Viewer block/mute never silently becomes platform enforcement.
- Public state cannot carry an enforcement reason; restricted/blocked state requires one.
- Revision conflicts reject stale enforcement updates.
- Focused tests cover report normalization/idempotency, viewer-local preferences,
  blocked/restricted visibility, revision custody and malformed inputs.

## Integration handoff
- Persist reports separately from enforcement decisions.
- Require authenticated reporter identity; never accept reporter id from a client body as authority.
- Search/Explore/profile/persona/replay projections must call the enforcement layer before ranking.
- Map replay platform blocking into the canonical replay `platform_block` transition.
- Host moderation remains Talk-local and does not automatically create global platform enforcement.
- Admin safety surfaces should write revisioned enforcement decisions and preserve audit evidence.
- A viewer block/mute should suppress that subject for that viewer without changing global visibility.

No shared Gateway composition/routes, migrations, mobile/admin UI or production deployment were changed.

**Status:** safety/reporting policy core complete.

# Talk safety enforcement integration — 2026-10-07

- **Owner/window:** current ChatGPT transformation window
- **Branch:** `work/talks-safety-enforcement-integration-20261007`
- **Base SHA:** `1ec7c6d74380f83a636f67d76c89641baa9372cf`
- **Lane:** hard-filter restricted/blocked Talk network entities from discovery/access
- **Lease:** released with implementation handoff

## Owned changes

- `services/gateway/src/talks/postgres_repository.ts`
- `services/gateway/src/talk_search/postgres_repository.ts`
- `services/gateway/src/talk_profiles/postgres_repository.ts`
- `services/gateway/src/talk_replay/egress/postgres_media_repository.ts`
- `services/gateway/src/talk_safety/enforcement_integration.test.ts`
- this handoff

## Implemented

- Explore/Live feed SQL excludes Talk targets with platform safety visibility `restricted` or `blocked` before ordering/ranking.
- Global search excludes restricted/blocked:
  - Talks by Talk id;
  - human profiles by handle;
  - Expert/Twin personas by public id.
- Human profile reads hide restricted/blocked profiles.
- Follow target resolution also hides restricted/blocked profiles, so clients cannot create new follows to a hidden profile.
- Persona reads hide restricted/blocked personas.
- Talk detail preserves the pre-existing Host-private management exception while hiding the Talk from ordinary viewers.
- New public comments are rejected for restricted/blocked Talks.
- Replay playback object lookup rejects a signed source if:
  - the Talk target is restricted/blocked; or
  - the replay recording id is restricted/blocked.
- Safety filtering happens in SQL before result ordering or signed URL generation.
- Focused regression tests assert the enforcement guards are present on every surface.

## Target identity

- Talk enforcement target id = canonical `talk_id`.
- Profile enforcement target id = canonical public profile `handle`.
- Persona enforcement target id = canonical persona `public_id`.
- Replay enforcement target id = canonical replay `recording_id`.

## Handoff

- Admin replay blocking should additionally call the canonical replay `platformBlock` transition so replay state and safety evidence remain aligned.
- Viewer-local block/mute filtering remains separate from global platform enforcement and should be applied with authenticated viewer context.
- Ranking receives only already-eligible Talk projections; it must not bypass these repository filters.
- Shared Gateway composition for safety mutation routes remains independent.

No client-only hiding, mobile UI, admin UI, shared app/main composition or production deployment was added.

**Status:** global platform safety now affects public data access surfaces.

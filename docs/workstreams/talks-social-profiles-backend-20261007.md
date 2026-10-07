# Talks social profiles backend — 2026-10-07

- **Owner:** current ChatGPT Talks backend window
- **Branch:** `work/talks-social-profiles-backend-20261007`
- **Stacked base:** PR #337 head `32445d182ae483527be2615afbf822aac6ffa47d`
- **PR:** #342 — Add Talks social profiles and following backend
- **Lane:** human public profiles, idempotent following, Expert/Twin persona projections

## Implemented

- `GET /profiles/:handle`
- `POST /profiles/:handle/follow` with `{ following: boolean }`
- `GET /personas/:publicId`
- durable human public profile projections;
- durable follower relationships with unique/idempotent follow semantics;
- server-authoritative follower/following counts and viewer-specific follow state;
- explicit Expert vs Twin persona identity;
- seat fee/availability, owner attribution, topics and Talk appearance projections;
- safe producer upsert boundaries for human/persona projections;
- self-follow rejection as a client-safe conflict;
- Gateway production composition;
- focused HTTP and PostgreSQL repository tests.

## Security / product invariants

- Viewer identity is always derived from the existing platform customer session.
- Profile, follow and persona queries are tenant scoped.
- Clients cannot submit follower identity.
- Follow toggles are idempotent.
- Profile projection does not expose models, Skills, Tools, Providers or runtime internals.
- No mobile files, AI Seat Commerce, Activity backend, live audio or canonical Twin/Agent identity stores were changed.

## Verification

- PR #342 is mergeable.
- Foundation CI run `37600822394` failed before any workflow step was created, matching the already documented repository baseline runner failure on PR #337/current main.
- Focused tests are committed and ready once the shared runner/service-startup issue is repaired.
- No production migration/deployment executed.

## Producer boundary

Canonical onboarding/Twin/Expert/Talk producers should publish safe public projections through the repository upsert methods. The social API remains a read/follow projection and must not become a second source of truth for Twin/Expert runtime state or Seat pricing authority.

**Implementation status:** complete for the claimed social profiles/following backend slice.  
**Claim status:** handoff-ready through stacked PR #342.

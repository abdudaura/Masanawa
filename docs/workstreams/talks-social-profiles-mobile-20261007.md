# Talk social profiles mobile implementation — 2026-10-07

Owner/window: current ChatGPT implementation window
Branch: `work/talks-social-profiles-mobile-20261007`
Base: `6f3aeb86394a15a26106253cc16b326bcb9a8b03`

## Scope

Implement the new social profile surfaces without editing shared Talk backend persistence,
Commerce, migrations or production deployment.

Owned:
- new mobile social profile models/transport/providers;
- Person Profile screen;
- Expert/Twin Persona Profile screen;
- `/u/:handle` and `/persona/:publicId` mobile routes;
- Activity/profile navigation wiring;
- focused mobile tests;
- this handoff.

## Product rules

- People are the primary social identity.
- Human profile: name/handle/bio, Follow, current Live state, follower/following counts,
  Talk replays/live appearances, Twin preview if one exists.
- Persona profile must clearly label **Masanawa Expert** vs **User Twin**.
- Twin profile exposes owner, topics/personality, Seat fee/availability and Talk appearances.
- Expert profile exposes Masanawa verification, role/topics, Seat fee and Talk appearances.
- Do not expose models, Skills, Tools, Providers or internal runtime terms.
- Talk history/appearances remain one-column vertical cards.
- Simplicity: no dashboard grids.

Status: active.


## Implementation checkpoint

Implemented:
- human Person Profile with handle, bio, follower/following counts and Follow toggle;
- live indicator / Listen live affordance when a live Talk target is present;
- optional Twin preview from the human profile;
- one-column vertical public Talk history;
- shared Expert/Twin Persona Profile with explicit identity labels;
- Masanawa Expert verification presentation;
- Twin owner attribution;
- Seat fee and availability presentation;
- topic chips and vertical Talk appearance history;
- `/u/:handle` and `/persona/:publicId` mobile routes;
- Activity follow events can open human profiles;
- focused widget coverage.

## Mobile-facing backend contract

Human profile:
- `GET /profiles/:handle`
- `POST /profiles/:handle/follow` with `{ following: boolean }`

Human projection:
- `handle, displayName, bio?, avatarUrl?`
- `followerCount, followingCount, isFollowing`
- `isLive, liveTalkId?`
- `twinPublicId?, twinDisplayName?`
- `talks[]` using the existing Talk discovery projection.

Persona profile:
- `GET /personas/:publicId`

Persona projection:
- `publicId, displayName, kind: expert|twin`
- `seatFeeLabel, isAvailable`
- `role?, bio?, avatarUrl?`
- for Twins: `ownerHandle?, ownerDisplayName?`
- `topics[]`
- `appearances[]` using Talk discovery projection
- `isVerified`.

The backend remains authoritative for follow relationship isolation, counts, public
visibility, persona availability and Seat pricing. Follow mutations must be idempotent.

Status: mobile social profile slice implemented; backend projection remains independent work.

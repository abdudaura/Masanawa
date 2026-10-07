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

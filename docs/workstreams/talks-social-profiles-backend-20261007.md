# Talks social profiles backend — 2026-10-07

- Owner: current ChatGPT Talks backend window
- Branch: `work/talks-social-profiles-backend-20261007`
- Stacked base: PR #337 head `32445d182ae483527be2615afbf822aac6ffa47d`
- Lane: human public profiles, following, Expert/Twin persona projections
- Owned paths:
  - `services/gateway/src/talk_profiles/**`
  - `services/gateway/src/talk_profile_routes.ts`
  - focused profile route/repository tests
  - `packages/talks/migrations/0003_talk_profiles.sql`
  - isolated inherited additions to `services/gateway/src/app.ts` and `services/gateway/src/main.ts`
  - this workstream
- Not owned: any mobile files; Activity backend; AI Seat Commerce; Talk live audio; Twin/Agent canonical identity internals.
- Contract:
  - `GET /profiles/:handle`
  - `POST /profiles/:handle/follow` body `{ following }`
  - `GET /personas/:publicId`
- Security: follow mutations derive actor from platform session; counts and visibility remain server authoritative.
- Status: active.

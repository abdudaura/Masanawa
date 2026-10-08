# R18 authenticated public identity editing — 2026-10-08

- Owner: ChatGPT R18 backend lane (following merged R17).
- Branch: `work/r18-self-profile-edit-20261008`.
- Base main: `8100723f26ca32faabbeaf6e07bcaa27144013f9`.
- Exact owned paths: `services/gateway/src/talk_profiles/model.ts`, `services/gateway/src/talk_profiles/service.ts`, `services/gateway/src/talk_profiles/postgres_repository.ts`, `services/gateway/src/talk_profile_routes.ts`, `services/gateway/src/talk_profile_routes.test.ts`, `services/gateway/src/talk_profiles/postgres_repository.test.ts`, `docs/workstreams/profile-self-edit-r18-20261008.md`.
- Scope: atomic authenticated edit of own display name, handle and bio, validated server-side, collision/recovery-safe. Do not permit editing other people's profiles or unverified avatar URLs.
- Dependencies: canonical `talks.public_profiles` table and unique (tenant_id, handle); session authorization. Avatar selection/storage and cross-surface mobile state are subsequent R18 lanes; never claim profile completion from this backend only.
- Current step: claim posted; no implementation yet.
- Tests/build/deployment/device: NOT EXECUTED.

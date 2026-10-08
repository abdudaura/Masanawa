# R18 authenticated public identity editing — 2026-10-08

- Owner: ChatGPT R18 backend lane (following merged R17).
- Branch: `work/r18-self-profile-edit-20261008`.
- Base main: `8100723f26ca32faabbeaf6e07bcaa27144013f9`.
- Exact owned paths: `apps/mobile/lib/src/router/app_router.dart`, `apps/mobile/lib/src/screens/twin/twin_home_shell.dart`, `apps/mobile/lib/src/screens/profile/edit_profile_screen.dart`, `apps/mobile/lib/src/social/self_profile_edit.dart`, `apps/mobile/test/self_profile_edit_test.dart`, `services/gateway/src/talk_profiles/model.ts`, `services/gateway/src/talk_profiles/service.ts`, `services/gateway/src/talk_profiles/postgres_repository.ts`, `services/gateway/src/talk_profile_routes.ts`, `services/gateway/src/talk_profile_routes.test.ts`, `services/gateway/src/talk_profiles/postgres_repository.test.ts`, `docs/workstreams/profile-self-edit-r18-20261008.md`.
- Scope: atomic authenticated edit of own display name, handle and bio, validated server-side, collision/recovery-safe. Do not permit editing other people's profiles or unverified avatar URLs.
- Dependencies: canonical `talks.public_profiles` table and unique (tenant_id, handle); session authorization. Avatar selection/storage and cross-surface mobile state are subsequent R18 lanes; never claim profile completion from this backend only.
- Current step: claim posted; no implementation yet.
- Tests/build/deployment/device: NOT EXECUTED.

- Expanded after inspecting live public profile routes and client: create typed mobile editor transport and a dedicated /profile route. This must persist name/handle/bio through PUT /profiles/me and refresh public profile providers; avatar upload and Settings identity propagation require separate authority work.

- Cross-surface identity: root avatar presentation will watch canonical public profile-by-user provider and fall back to authenticated session name. Do not patch R12 Settings while that lane owns settings_screen.dart.

## Implementation checkpoint — 2026-10-08
- Backend: authenticated `PUT /profiles/me` accepts exactly displayName/handle/bio and uses the caller's trusted PlatformSessionIdentity (tenantId/userId) for a primary-key-scoped Postgres UPSERT. The existing avatar URL, Talk activity metadata and social counts are not overwritten by the edit statement; a concurrent handle collision is mapped from SQLSTATE 23505 to 409.
- Name and bio validation reject invalid/oversized/control-character input; handle uses canonical lowercase public-handle parser. Initial profile creation is supported by INSERT/ON CONFLICT.
- Mobile: typed self-profile edit draft/transport, actual `/profile` route, persisted name/handle/bio UI with explicit busy/error/retry and provider invalidation. Root header avatar/name watches canonical by-user public profile with signed-in-session fallback.
- Tests authored: Gateway profile route cases for auth/unknown client fields/validation/conflict, Postgres scoped-update and avatar preservation case, mobile draft normalization/control policy cases. All tests are source committed, **not executed** in this connector-only environment. No store build, device session or deployment attempted.
- Remaining R18: **secure owned-media upload and crop/replace/remove, storage cleanup, canonical auth-name refresh and Settings screen synchronization, user profile edit end-to-end/restart tests, cross-device acceptance**. Existing general chat presign endpoint is not an authenticated account-avatar attachment contract; do not accept external arbitrary avatar URLs or imply photo edit readiness.
- Integration concerns: R12 #409/#416 edits Settings and account deletion; this PR does not touch Settings. Other current lanes are R09/R10/R11; no overlapping code file observed when this claim was opened.
- Latest implementation file commit before checkpoint: `6e604d650195e4a82c44fd7706381e5f93cdeba1`; tests file commit `9b0604a315ddf2196ea7a6ee04a25cb71c6dcc06`.

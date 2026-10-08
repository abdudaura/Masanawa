# R18 authenticated profile editing — claim and implementation
Owner/window: ChatGPT R18 profile write API window, 2026-10-08
Branch: `work/r18-profile-edit-contract-20261008`; baseline `265f2c5f6db81d076f57ca32dd47db3ff7fb0ad6`
R18 scope: introduce authenticated self-profile read/edit for existing canonical `talks.public_profiles`, name/handle/bio, secure ownership and uniqueness, avatar removal. No cosmetic-only update; no uncontrolled avatar URL writes.
Paths owned: `services/gateway/src/talk_profiles/model.ts`, `services/gateway/src/talk_profiles/service.ts`, `services/gateway/src/talk_profiles/postgres_repository.ts`, `services/gateway/src/talk_profile_routes.ts`, `services/gateway/src/talk_profile_routes.test.ts`, `services/gateway/src/talk_profiles/profile_edit_postgres.test.ts`, `apps/mobile/lib/src/social/own_profile_transport.dart`, `apps/mobile/test/own_profile_transport_test.dart`, `apps/mobile/lib/src/screens/profile/edit_profile_screen.dart`, `apps/mobile/lib/src/router/app_router.dart`, `apps/mobile/test/edit_profile_screen_test.dart`, `docs/workstreams/r18-profile-edit-contract-20261008.md`. Further specific owned paths must be added here before editing.
Shared dependencies: Gateway composition already registers profile routes; no changes to it or migrations/financial surfaces. Existing activity/profile projections are read-only by default.
Step: claim published. Test/deploy/device acceptance pending. Avatar upload requires durable media store + crop/replace handling, not covered by this sublane; do not represent as done.
Last activity: 2026-10-08.

Scope refinement: `/profile` currently maps to SettingsScreen, not a profile editor. This branch owns that route only; R17 shell currently changes `twin_home_shell.dart`, no overlapping path. Implement a protected self profile editor; name/bio and avatar removal are server-owned. Handles remain read-only pending reference-preserving alias/change contract. Avatar upload requires separately qualified persistent media backing, not a data URI or ephemeral file.

## Implemented scope and evidence

1. **Owner route** `GET /profiles/me`: verifies the signed-in customer; no arbitrary user ID input and returns the existing public profile. `PATCH /profiles/me`: name/bio and avatar removal only, with server validation and SQL `WHERE tenant_id=$1 AND user_id=$2`. No client-provided identity or arbitrary URL write. `PUT /profiles/me`: explicit creation for signed-in users without a public-profile row, validates public handle and name; database unique handle and per-user conflict are preserved and translated to meaningful 409 statuses. Existing handles are not implicitly changed.
2. **Durability**: updates run on `talks.public_profiles` instead of client-only state. On success the client invalidates public profile projections by handle/user ID and shows a server-confirmed result. Prior details remain visible on network failure.
3. **Mobile UX**: `/profile` now opens `EditProfileScreen`, not Settings. Users can create first public profile (name/handle/bio), edit public name/bio, and remove an existing avatar with undo prior to save. Validation/disabled state/loading/retry are explicit. `/settings` is unchanged.
4. **Auth/validation tests authored**: gateway HTTP route owner-only/401, new profile, duplicate, bad handle, field injection, text validation; SQL update scoped by tenant+user, initial insert unique semantics; mobile typed GET/PUT/PATCH transport and first-time/edit widget tests.

## Incomplete R18 acceptance — do NOT claim full completion

- **Profile photo upload/crop/replace**: still requires durable public media-object storage, image decoding/sanitization, content caps, consent and provider configuration. No data: URL or ephemeral filesystem shortcut was used. Removal of an existing avatar is implemented; upload is NOT.
- **Handle changes**: existing public handles can be referenced from Talk invites, owner/persona links and safety enforcement. Do not mutate until canonical alias/reference migration is designed and qualified. Initial new handle is supported.
- Public display name is intentionally distinct from account authentication/legal-name field; account identity synchronization needs a separate coordinated identity contract.
- Authenticated public-profile setup persists in `talks.public_profiles`; device, provider, CI and real deployment qualification remain pending. No runtime test or APK build was executed here.

Last repository-visible work: commits through `3cd6929` on this branch. Tests authored, not run. Claim may be reclaimed after five inactive minutes under MULTI-WINDOW-WORK.md.

## Post-review corrections and updated integration checkpoint

Branch regression review found malformed SQL placeholders and a broken Dart handle validator; both were corrected before integration (commits `5a09f83`, `06b73ab`). The SQL test now asserts exact `$3/$4` bound values and the complete Dart widget source was read back with a single Save button and valid regex. Do not use commits before these fixes as a release candidate.

A server timeout cannot prove a write was rejected. The editor now reports unknown save status honestly and offers an explicit server reload. 409 handle collision/conflict and expired authorization get distinct feedback. A signed-in owner can read their own moderation-restricted public record for editing, without widening public discovery visibility (commits `027e711`, `ba18bde`, `b60e7c4`, `86643c9`).

**Integration:** PR #419 remains a mergeable DRAFT against a moving main; main now includes R02/R03/R04/R17/theme/localization/billing/release-signing integrations. The changed-file diff has been inspected; no overlap with the R17 shell file changes. GitHub Actions Foundation CI and Mobile Build report failure with execution jobs showing no steps, so no application test success or failure can be inferred. Tests/build/handset/deployment remain NOT VERIFIED. `main` is still the only source for release APKs.

**Next actionable R18 lane:** build a canonical persistent media service for safe avatar upload/crop/replace (strip metadata, validate size/mime, delete/reconcile orphaned media), then investigate linked handle migrations/account public-name synchronization and provide full device acceptance. Do not claim all R18 complete from this sublane.

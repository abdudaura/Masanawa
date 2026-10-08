# R18 authenticated profile editing — claim and implementation
Owner/window: ChatGPT R18 profile write API window, 2026-10-08
Branch: `work/r18-profile-edit-contract-20261008`; baseline `265f2c5f6db81d076f57ca32dd47db3ff7fb0ad6`
R18 scope: introduce authenticated self-profile read/edit for existing canonical `talks.public_profiles`, name/handle/bio, secure ownership and uniqueness, avatar removal. No cosmetic-only update; no uncontrolled avatar URL writes.
Paths owned: `services/gateway/src/talk_profiles/model.ts`, `services/gateway/src/talk_profiles/service.ts`, `services/gateway/src/talk_profiles/postgres_repository.ts`, `services/gateway/src/talk_profile_routes.ts`, `services/gateway/src/talk_profile_routes.test.ts`, `apps/mobile/lib/src/social/talk_social_profiles.dart`, `apps/mobile/lib/src/social/talk_social_profiles_http_transport.dart`, `apps/mobile/lib/src/screens/profile/person_profile_screen.dart`, `docs/workstreams/r18-profile-edit-contract-20261008.md`. Further specific owned paths must be added here before editing.
Shared dependencies: Gateway composition already registers profile routes; no changes to it or migrations/financial surfaces. Existing activity/profile projections are read-only by default.
Step: claim published. Test/deploy/device acceptance pending. Avatar upload requires durable media store + crop/replace handling, not covered by this sublane; do not represent as done.
Last activity: 2026-10-08.

# Masanawa Twin Transformation — Implementation File Map

Status: planning map, 2026-10-05.
This map is advisory ownership guidance. Current active claims/PRs always win.

## Mobile — existing files to evolve

### Shared integration only
- `apps/mobile/lib/src/router/app_router.dart`
- `apps/mobile/lib/src/screens/chat/ai_chat_screen.dart`
- `apps/mobile/lib/src/agents/masanawa_transport.dart`
- root navigation shell if/when introduced

Only the shared integration lane should make final edits to these after feature contracts
and screens are ready.

### My Twin
Existing:
- `apps/mobile/lib/src/screens/settings/clone_setup_screen.dart`
- `apps/mobile/lib/src/agents/creator_clone.dart`
- active onboarding branch files under:
  - `apps/mobile/lib/src/agents/clone_onboarding.dart`
  - `apps/mobile/lib/src/agents/clone_onboarding_transport.dart`
  - `apps/mobile/lib/src/state/clone_onboarding_controller.dart`

Prefer new:
- `apps/mobile/lib/src/screens/twin/my_twin_screen.dart`
- `apps/mobile/lib/src/state/my_twin_state.dart`
- `apps/mobile/lib/src/agents/twin_profile.dart`
- `apps/mobile/lib/src/agents/twin_profile_transport.dart`

### Explore
Existing to migrate from:
- `apps/mobile/lib/src/screens/chat/masana_list_screen.dart`
- `apps/mobile/lib/src/agents/agent_directory.dart`
- `apps/mobile/lib/src/state/agent_directory_state.dart`

Prefer new:
- `apps/mobile/lib/src/screens/explore/explore_screen.dart`
- `apps/mobile/lib/src/agents/twin_directory.dart`
- `apps/mobile/lib/src/state/twin_directory_state.dart`

### Activity
New:
- `apps/mobile/lib/src/screens/activity/activity_screen.dart`
- `apps/mobile/lib/src/agents/twin_activity.dart`
- `apps/mobile/lib/src/state/twin_activity_state.dart`

### Wallet
Existing inputs:
- `apps/mobile/lib/src/agents/creator_economy.dart`
- `apps/mobile/lib/src/state/creator_economy_state.dart`
- billing/crypto mobile files on their active branches

Prefer new:
- `apps/mobile/lib/src/screens/wallet/wallet_screen.dart`
- `apps/mobile/lib/src/commerce/wallet_models.dart`
- `apps/mobile/lib/src/commerce/wallet_transport.dart`
- `apps/mobile/lib/src/state/wallet_state.dart`
- `apps/mobile/lib/src/screens/wallet/send_credits_sheet.dart`
- `apps/mobile/lib/src/screens/wallet/gift_sheet.dart`

### Paid voice
Prefer isolated new UI:
- `apps/mobile/lib/src/voice/paid_voice_quote.dart`
- `apps/mobile/lib/src/voice/paid_voice_state.dart`
- reusable quote/consent sheet under `screens/chat/components/`

Reuse, do not rewrite:
- `apps/mobile/lib/src/core/live_voice_session.dart`
- `apps/mobile/lib/src/core/live_pcm_audio.dart`

### Request Owner
Prefer new:
- `apps/mobile/lib/src/owner_access/owner_access_models.dart`
- `apps/mobile/lib/src/owner_access/owner_access_transport.dart`
- `apps/mobile/lib/src/state/owner_access_state.dart`
- `apps/mobile/lib/src/screens/chat/components/request_owner_sheet.dart`
- `apps/mobile/lib/src/screens/chat/components/owner_access_status_card.dart`

### Settings
Existing:
- `apps/mobile/lib/src/screens/settings/settings_screen.dart`

Final target:
remove creator economy/Agent Float/ordinary Skill management from Settings after new
Wallet/My Twin screens are available.

## Identity / public twin profile

Existing likely owners:
- `packages/identity/src/**`
- `packages/identity/migrations/**`
- `adapters/storage/postgres/src/identity/**`
- existing clone setup/provisioning contracts on active onboarding branch

Prefer additive files:
- `packages/identity/src/twin-profile.ts`
- `packages/identity/src/twin-profile.test.ts`
- next append-only identity migration
- `adapters/storage/postgres/src/identity/twin_profile.ts`

Gateway feature files:
- `services/gateway/src/twin_profile.ts`
- `services/gateway/src/twin_profile_routes.ts`
- dedicated tests

Shared `app.ts`/`main.ts` composition belongs to integration lane.

## Memory / representation boundary

Existing owner:
- `packages/memory/**`
- `adapters/storage/postgres/src/memory/**`

Prefer additive policy/service files rather than a new memory store:
- `packages/memory/src/representation.ts`
- tests proving private memories cannot enter public-twin context without explicit
  representational admission.

Agent context compiler changes should be narrowly coordinated because runtime branches may
already own those files.

## Commerce — Credit transfers and gifts

Existing:
- `packages/commerce/src/model.ts`
- `packages/commerce/src/repository.ts`
- `packages/commerce/src/funding.ts`
- `packages/commerce/src/settlement.ts`
- `packages/commerce/migrations/0001..0003`
- `adapters/storage/postgres/src/commerce/repository.ts`

Because these are collision-prone, prefer additive files first:
- `packages/commerce/src/transfers.ts`
- `packages/commerce/src/transfers.test.ts`
- `packages/commerce/src/gifts.ts`
- `packages/commerce/src/gifts.test.ts`
- next append-only Commerce migration after reconciling active branches
- adapter repository modules if package exports allow composition without editing one
  giant repository file.

Gateway:
- `services/gateway/src/credit_transfer.ts`
- `services/gateway/src/credit_transfer_routes.ts`
- `services/gateway/src/gifts.ts`
- `services/gateway/src/gift_routes.ts`

## Commerce — attribution / monetization policy

Prefer additive:
- `packages/commerce/src/attribution.ts`
- `packages/commerce/src/monetization-policy.ts`
- tests for self-attribution, expiry, reversal and policy revision

Integration into existing settlement/funding should happen only after active billing
branches are reconciled.

## Paid voice — backend

Prefer additive:
- `packages/commerce/src/voice-product.ts` or equivalent Commerce-owned pricing/settlement
- `services/gateway/src/paid_voice.ts`
- `services/gateway/src/paid_voice_routes.ts`
- presence/voice evidence adapter only if required by canonical metering design

Reuse:
- `services/gateway/src/live_voice_token.ts`
- existing presence/Gemini Live transport

Do not trust client duration as financial truth.

## Owner access — backend

Prefer additive:
- `packages/commerce/src/owner-access.ts`
- `packages/commerce/src/owner-access.test.ts`
- next Commerce migration
- repository port/adapter support
- `services/gateway/src/owner_access.ts`
- `services/gateway/src/owner_access_routes.ts`

If canonical scheduling primitives already exist in Workflows/Proactivity, reference them;
do not create a second scheduler.

## Activity projection

Prefer additive:
- dedicated projection/read-model package location chosen by current architecture owner,
  or Gateway query service over existing events if no durable projection is necessary;
- `services/gateway/src/twin_activity.ts`
- `services/gateway/src/twin_activity_routes.ts`

Do not make Activity the source of financial truth.

## Explore / public directory — backend

Prefer additive:
- Identity/Agents read projection for public twins;
- `services/gateway/src/twin_directory.ts`
- `services/gateway/src/twin_directory_routes.ts`

Current `agent_directory.ts` is an internal/configured Character directory and should not
automatically become the public twin directory without privacy review.

## Shared Gateway integration files

Single-owner:
- `services/gateway/src/app.ts`
- `services/gateway/src/main.ts`
- package imports/exports required by those files
- runtime readiness/environment registration

Feature lanes should expose registrar/service factories that integration can compose.

## Migrations

Rules:
- never edit existing applied migration files;
- inspect active branches immediately before choosing the next number;
- one lane owns a package's migration number at a time;
- preserve checksums already deployed;
- all financial schema changes require restart/replay/idempotency tests.

## Tests to add

### Contracts/unit
- twin public-profile privacy;
- representational memory;
- transfer/gift invariants;
- attribution/reversal;
- voice quote/metering;
- owner-access state machine.

### PostgreSQL integration
- atomic transfer;
- duplicate replay;
- concurrent insufficient balance;
- circular commission prevention;
- gift receipt;
- attribution reversal;
- owner-session hold/settlement/refund.

### E2E
- share -> free twin chat;
- purchase through twin -> commission;
- transfer -> no commission;
- gift;
- paid voice;
- paid owner request;
- crash/retry recovery.

### Mobile
- four-tab navigation;
- deep link to twin;
- free text cannot trigger charge;
- paid voice requires quote;
- send/gift confirmation;
- owner request states;
- Activity privacy;
- Wallet balances/history;
- low-width/accessibility regression.

## Files/features to deprecate only after replacement

Do not eagerly delete:
- current clone onboarding routes/screens;
- creator economy DTO/state;
- existing agent/masana directory;
- existing billing/crypto screens;
- support-agent preference.

First reach functional parity, migrate callers, add compatibility/deprecation evidence,
then remove obsolete surfaces in a dedicated cleanup change.

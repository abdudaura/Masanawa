# Audio-first implementation windows — 2026-10-09

Status: planning allocation; no feature path is claimed by this document. Current local source/APK is unavailable here. Main snapshot: `5e758673ae91082520b21b3153da53791ae2cbf3`. Refresh refs and recover before editing.

## Dispatch override — 2026-10-10

Use [outcome-first delivery](NEXT-WAVE-DELIVERY-20261010.md) and [replacement prompt](REUSABLE-IMPLEMENTATION-PROMPT.md). Existing IDs/paths retain their ownership purpose. PLANNED_UNCLAIMED here is a template value, not permission to repeat active/released PR work. Continue substantive customer milestones; a small guard or structural evidence tool does not complete a lane. Dependency waves limit required contracts; they do not block independent domain implementation until all of AF00 is done.

## Launch in waves

AF00 is the one continuing integrator. First reconcile the owner's local changes and #497 without discarding any source. It can publish narrow contract baselines and ready paths while local-only comparisons remain blocked; other windows may inspect/recover isolated modules, but must not replace unseen local screens.

Wave 1: AF01 money, AF05 audio, AF07 directory, AF08 auth AF13 qualification, AF14 Settings and AF15 storage/operations. Wave 2 starts per dependency, not a calendar: AF02 P2P, AF03 wallet, AF04 Gwani, AF06 messaging, AF09 posts, AF10 Rooms, AF11 Calls. Wave 3: AF12 creators on the ready posting API. Keep roughly 4–6 implementation windows active plus integration; sixteen IDs are accountability slots, not sixteen simultaneous writers.

Contracts and screen states land before dependent UI. Auth/finance unspecified activation rules remain blocked for money activation, not a reason to fabricate prices/backing. Navigation is confirmed: Chats · Rooms · Talks · Gwani · Wallet, Talks centred/default. AF00 updates semantic route/saved-tab compatibility and the user-facing Gwani label in one root-shell implementation.

## Lane allocation

| Lane | Responsibility | Dependencies | Existing recovery inputs |
| --- | --- | --- | --- |
| AF00 | Recovery and integration | None | #497, #461, #552 |
| AF01 | MSN financial authority | AF00 | #576, #454, #444, #438 |
| AF02 | MSN P2P escrow | AF01, AF08 | New slice; inspect for newer source |
| AF03 | Wallet surfaces and receipts | AF01 | #576, #445, #444 |
| AF04 | Gwani service menus | AF01 | #497, #447, #520, #521, #580 |
| AF05 | Audio reliability | AF00 | #534, #456, #497 |
| AF06 | Messaging and chat transfers | AF01, AF05 | #529, #530, #533, #531, #537, #472, #475 |
| AF07 | Masana and Contacts directory | AF00 | #468, #508, #509, #510, #511 |
| AF08 | Authentication and launch polish | AF00 | #497, #539 |
| AF09 | Published audio Talks | AF05 | #497, #548, #503 |
| AF10 | Audio-focused Rooms | AF05, AF06 | #439, #450, #456 |
| AF11 | Calls recovery | AF05, AF07 | #575, #578 |
| AF12 | Masana creators and scheduled publishing | AF09 | #545, #514, #517 |
| AF13 | Acceptance, privacy and operations evidence | AF00 | #527, #518, #559, #561, #554, #567, #570 |
| AF14 | Settings, account and activity surfaces | AF00 | #497, #435, #430 |
| AF15 | Storage and durable operations | AF00 | #497, #430, #518, #561, #570 |

## Exact ownership and acceptance

### AF00 — Recovery and integration

Outcome: Preserve and reconcile local fixes/APK with main and every relevant draft. Publish unique-change/old-lane disposition, canonical imports/migrations, route aliases, dependency integration and final APK/rollback evidence. Update stale shell guards for current decisions; do not drop their security assertions.

Allowed roots/files (claim specific paths, verify current source first):

- `apps/mobile/lib/src/router/**`
- `apps/mobile/lib/src/screens/twin/shell_tab.dart`
- `apps/mobile/lib/src/screens/twin/twin_home_shell.dart`
- `apps/mobile/lib/src/core/mobile_push.dart`
- `apps/mobile/lib/src/core/shell_deep_link.dart`
- `apps/mobile/lib/l10n/**`
- `services/gateway/src/app.ts`
- `services/gateway/src/main.ts`
- `services/gateway/src/migrate.ts`
- `services/worker/src/main.ts`
- `services/ops/src/app.ts`
- `services/ops/src/main.ts`
- `adapters/storage/postgres/src/schema_admin/**`
- `database/migrations/**`

Verification: Combined Flutter analyze/test/build, TypeScript build/unit/contract/DB suites, deep links, account switching, migration rehearsal and qualified final two-device/provider paths.

### AF01 — MSN financial authority

Outcome: Elect existing ledger authority, reconcile #576 and internal crypto transfers, define exact MSN/backing/liquidity rules, implement fiat purchase of MSN, supported crypto deposit/hold/convert/withdraw, transfer/escrow primitives and one receipt/status authority. No spendable fiat/direct fiat cashout or silent Cr migration.

Allowed roots/files (claim specific paths, verify current source first):

- `packages/commerce/src/**`
- `adapters/storage/postgres/src/commerce/**`
- `adapters/crypto/**`
- `services/gateway/src/msn_wallet/**`
- `services/gateway/src/financial_audio_first/**`
- `services/gateway/src/financial_service.ts`
- `services/gateway/src/financial_billing.ts`
- `services/gateway/src/billing_wallet.ts`
- `services/gateway/src/internal_crypto_transfer.ts`
- `services/gateway/src/internal_crypto_transfer_routes.ts`
- `apps/mobile/test/audio_first/af01/**`

Verification: Balanced postings; real DB concurrency; duplicate callbacks/keys; forged events; quote/consent replay; pending funding failure; treasury/liquidity guards and provider reconciliation.

### AF02 — MSN P2P escrow

Outcome: MSN-only offers/order/escrow orchestration and themed Buy/Sell/My orders UI, role-checked dispute console, verified receipt or seller confirmation, frozen paid/disputed orders, reminders and reconciliation. Use AF01 transaction/escrow primitives, never a second ledger.

Allowed roots/files (claim specific paths, verify current source first):

- `services/gateway/src/msn_p2p/**`
- `apps/mobile/lib/src/msn_p2p/**`
- `services/ops/src/msn_p2p/**`
- `apps/mobile/test/audio_first/af02/**`

Verification: Reserve/create atomicity; oversell; paid/expiry races; forged screenshot; buyer/seller/operator IDOR; double-release/refund; restart/offline; qualification per payment method.

### AF03 — Wallet surfaces and receipts

Outcome: MSN-first home, crypto holdings, Add/Send/Convert/P2P handoff, funding/withdraw/conversion reviews, durable status and tappable receipts. Preserve #576 panel and real crypto code, remove consumer Cr/spendable fiat with compatible server contracts.

Allowed roots/files (claim specific paths, verify current source first):

- `apps/mobile/lib/src/screens/wallet/**`
- `apps/mobile/lib/src/finance/**`
- `apps/mobile/lib/src/commerce/**`
- `apps/mobile/lib/src/state/wallet_state.dart`
- `apps/mobile/test/audio_first/af03/**`

Verification: Exact formatting, stale cache/offline, restrictions, recipient/quote reviews, failed/uncertain recovery and account isolation; no null-swallowed failure or inert actions.

### AF04 — Gwani service menus

Outcome: Progressive vertical floating billing choices above composer; same durable draft for menu/text/voice, Back/Change, actual catalog/recipient validation, MSN quote/explicit authorization/receipt/status recovery. Integrate existing tasks rather than duplicate. ai_chat_screen shared hook belongs to AF00 until transfer.

Allowed roots/files (claim specific paths, verify current source first):

- `apps/mobile/lib/src/assistant_workspace/**`
- `apps/mobile/lib/src/assistant_services/**`
- `services/gateway/src/assistant_workspace/**`
- `services/gateway/src/assistant_services/**`
- `services/gateway/src/agent_billing_assistant.ts`
- `services/gateway/src/agent_crypto_assistant.ts`
- `apps/mobile/lib/src/screens/billing/**`
- `apps/mobile/test/audio_first/af04/**`

Verification: Menu→text→voice parity; conversation-only purchase; changed terms invalidate consent; no model approval; uncertain provider lookup before retry; localization and low-literacy tap paths.

### AF05 — Audio reliability

Outcome: Diagnose recorder vs transport/provider/output stages, capture/preview/upload/readback independent of Gemini Live, shared audio focus, lifecycle release, Bluetooth/headphones, explicit permission flow and useful errors. Give AF00 manifest/session/screen hooks; native permission edits require a visible transfer.

Allowed roots/files (claim specific paths, verify current source first):

- `apps/mobile/lib/src/core/app_permissions.dart`
- `apps/mobile/lib/src/core/live_pcm_audio.dart`
- `apps/mobile/lib/src/core/live_voice_session.dart`
- `apps/mobile/lib/src/audio_focus/**`
- `apps/mobile/lib/src/human_media/**`
- `apps/mobile/android/app/src/main/kotlin/com/masanawa/app/MainActivity.kt`
- `apps/mobile/test/audio_first/af05/**`

Verification: Actual handset local recording first, two-device notes, denied/revoked permission, contention, interrupted lifecycle, route switch, live send/receive, Bluetooth and subsequent recording after call.

### AF06 — Messaging and chat transfers

Outcome: Recover canonical DM implementation rather than maintain competing messages/human_messages stacks. WhatsApp-like compact composer, recorder preview/retry, durable outbox/realtime/history and MSN/crypto transfer sheet/card using AF01/AF03 contracts. No private money in public content.

Allowed roots/files (claim specific paths, verify current source first):

- `apps/mobile/lib/src/messages/human_dm_controller.dart`
- `apps/mobile/lib/src/messages/human_dm_outbox.dart`
- `apps/mobile/lib/src/messages/human_dm_screen.dart`
- `apps/mobile/lib/src/messages/human_dm_transport.dart`
- `apps/mobile/lib/src/messages/realtime/**`
- `apps/mobile/lib/src/human_messages/**`
- `apps/mobile/lib/src/chat_transfers/**`
- `services/gateway/src/human_messages/**`
- `services/gateway/src/human_dm_realtime/**`
- `services/gateway/src/chat_transfers/**`
- `apps/mobile/test/audio_first/af06/**`

Verification: Two-device send/readback; restart/idempotent outbox; blocked users; account switch; media retries; chat failure after successful transfer; receipt parity and no duplicate charge.

### AF07 — Masana and Contacts directory

Outcome: New chat opens Masana & Contacts with typed AI/person entries, roles/search/recents/favorites and real accepted people/request lifecycle. Reuse C01/U21; voluntary local phonebook without silent upload or treating an unverified number as identity.

Allowed roots/files (claim specific paths, verify current source first):

- `apps/mobile/lib/src/contact_hub/**`
- `apps/mobile/lib/src/masana_contacts/**`
- `apps/mobile/lib/src/messages/human_contacts_controller.dart`
- `apps/mobile/lib/src/messages/human_contacts_screen.dart`
- `apps/mobile/lib/src/messages/human_contacts_transport.dart`
- `apps/mobile/lib/src/messages/human_new_message_screen.dart`
- `services/gateway/src/human_contacts/**`
- `apps/mobile/test/audio_first/af07/**`

Verification: Correct human/AI route, stable IDs, denied contacts permission, privacy/block/request rules, offline directory, favorite account fencing and return to draft.

### AF08 — Authentication and launch polish

Outcome: Email/phone signup/login selectors preserving working email, numeric-password request with server security and unverified phone status, qualified recovery and wallet step-up; centered accessible icon-only language selector and neutral native/Flutter launch variants. Reconcile authoritative auth, do not bolt on parallel identity.

Allowed roots/files (claim specific paths, verify current source first):

- `apps/mobile/lib/src/screens/onboarding/**`
- `apps/mobile/lib/src/screens/splash/**`
- `apps/mobile/lib/src/state/session_state.dart`
- `apps/mobile/lib/src/auth_audio_first/**`
- `services/gateway/src/customer_auth.ts`
- `services/gateway/src/customer_auth.test.ts`
- `services/gateway/src/auth_audio_first/**`
- `packages/identity/src/auth_audio_first/**`
- `apps/mobile/android/app/src/main/res/drawable/launch_background.xml`
- `apps/mobile/android/app/src/main/res/drawable-v21/launch_background.xml`
- `apps/mobile/android/app/src/main/res/drawable-night/launch_background.xml`
- `apps/mobile/android/app/src/main/res/drawable-night-v21/launch_background.xml`
- `apps/mobile/android/app/src/main/res/values/styles.xml`
- `apps/mobile/android/app/src/main/res/values-night/styles.xml`
- `apps/mobile/android/app/src/main/res/values-v31/styles.xml`
- `apps/mobile/android/app/src/main/res/values-night-v31/styles.xml`
- `apps/mobile/test/audio_first/af08/**`

Verification: Guessing/rate limits, secure credential storage, no enumeration, recovery/session revocation, linked accounts, unverified-number impersonation, launch Android12+/night, small screens/keyboard.

### AF09 — Published audio Talks

Outcome: Audio-post feed, recording/trim/preview/upload/processing/publish, following/discover, engaging waveform cards, likes/comments/play counts/save/share/report. Reuse media/social/replay assets safely; old live IDs remain typed legacy resources, never coerced into new posts.

Allowed roots/files (claim specific paths, verify current source first):

- `apps/mobile/lib/src/audio_posts/**`
- `apps/mobile/lib/src/screens/talks/talk_home_screen.dart`
- `apps/mobile/lib/src/screens/talks/create_audio_post_screen.dart`
- `apps/mobile/lib/src/screens/you/my_talks_screen.dart`
- `apps/mobile/lib/src/screens/you/saved_talks_screen.dart`
- `services/gateway/src/audio_posts/**`
- `packages/talks/audio_posts/**`
- `adapters/storage/postgres/src/audio_posts/**`
- `apps/mobile/test/audio_first/af09/**`

Verification: Two-account publication/playback/follow/comment; publish retry dedup; codec/size limits; one player; played-time counts/dedup; moderation/delete/privacy; low data/offline drafts.

### AF10 — Audio-focused Rooms

Outcome: Persistent groups, membership, roles, invite/join/leave, audio history, moderation and notifications through adapters. Optional live room integration only after qualified session authority; reuse existing live infrastructure without restarting public Talk feed.

Allowed roots/files (claim specific paths, verify current source first):

- `apps/mobile/lib/src/audio_rooms/**`
- `services/gateway/src/audio_rooms/**`
- `packages/talks/audio_rooms/**`
- `adapters/storage/postgres/src/audio_rooms/**`
- `apps/mobile/test/audio_first/af10/**`

Verification: Outsider read/media/join denial, kick/revoke, private invite/block/limits, durable notes, offline/reconnect and independently qualified two-device live audio.

### AF11 — Calls recovery

Outcome: Reconcile existing C09 calling, recent/missed calls, typed directory selection, ringing/connect/mute/output/end/reconnect; Chats Calls filter. AF00 integrates push/deep links/composition; do not duplicate those files from old call branches.

Allowed roots/files (claim specific paths, verify current source first):

- `apps/mobile/lib/src/human_calls/**`
- `services/gateway/src/human_calls/**`
- `apps/mobile/test/audio_first/af11/**`

Verification: Two physical devices, caller/callee authorization, answer/end races, missed call readback, notification/deep link, microphone release and new voice note afterwards; video retained only if already qualified.

### AF12 — Masana creators and scheduled publishing

Outcome: Retain seventeen persona identities, extend distinct editorial profiles, follow/public posts, scripts/sources/AI labels/Gemini delivery, publication scheduler/budget/lease/retry/admin pause and a reviewed sample slate. Reuse scheduler/research workers; no autonomous financial actions or fake personal experiences.

Allowed roots/files (claim specific paths, verify current source first):

- `services/gateway/src/masana_creators/**`
- `services/worker/src/masana_publishing/**`
- `services/ops/src/masana_creators/**`
- `packages/agents/masana_creators/**`
- `apps/mobile/lib/src/masana_creators/**`
- `apps/mobile/lib/src/screens/profile/persona_profile_screen.dart`
- `apps/mobile/test/audio_first/af12/**`

Verification: Listening tests per language/voice/emotion; facts/source attribution; duplicate occurrence/publish, failed/empty audio, budgets/retry/admin pause, block/follow visibility and real generated sample artifacts.

### AF13 — Acceptance, privacy and operations evidence

Outcome: Build executable cross-feature/device/provider/restore qualification, threat/privacy/accessibility/performance matrix and redacted evidence. Inspect every old F gate; update expected semantics while preserving security proof. No runtime/CI/deployment mutation or mock-as-real completion.

Allowed roots/files (claim specific paths, verify current source first):

- `tests/e2e/audio_first/**`
- `tests/security/audio_first/**`
- `tests/recovery/audio_first/**`
- `tools/audio-first-qualification/**`
- `apps/mobile/test/audio_first/af13/**`

Verification: AF acceptance matrix, negative authority, escrow/concurrency/restore, real configured providers/physical devices, low-end/offline, artifact identity/rollback. Run only available dependencies; record precise unavailable checks.


### AF14 — Settings, account and activity surfaces

Outcome: Recover Settings/profile improvements. Implement concise Settings, account-fenced preferences, avatar/profile, notification and audio/data controls, correct app metadata/support, activity and lifecycle status. Consume AF08 credential/session APIs and AF01 financial obligations; preserve real deletion workflow. No auth/ledger replacement; AF00 integrates push, router and locale hooks.

Allowed roots/files (claim specific paths, verify current source first):

- `apps/mobile/lib/src/screens/settings/settings_screen.dart`
- `apps/mobile/lib/src/screens/settings/account_deletion_dialog.dart`
- `apps/mobile/lib/src/screens/profile/edit_profile_screen.dart`
- `apps/mobile/lib/src/screens/you/you_screen.dart`
- `apps/mobile/lib/src/screens/activity/**`
- `apps/mobile/lib/src/account_preferences/**`
- `services/gateway/src/account_preferences/**`
- `adapters/storage/postgres/src/account_preferences/**`
- `apps/mobile/test/audio_first/af14/**`

Verification: SA-A01..08: restart/failed saves/account-switch, profile/avatar readback, blocked-user denial, OS/token notification states, safe scope-confirmed cache clearing, installed metadata/support, server deletion/export with unsettled funds. Never claim request==deletion.


### AF15 — Storage and durable operations

Outcome: Inventory/reuse existing stores/jobs and publish DB/storage/job closure contracts. Implement reusable private media lifecycle, retention/orphan cleanup and durable operational adapters; qualify schema roots, backups/restore/capacity and restart. Domain jobs stay feature-owned, AF13 owns independent evidence, AF00 owns roots/migration registry/deploy config, AF01 money. Existing adapter changes require explicit exact-path transfer, not parallel replacement.

Allowed roots/files (claim specific paths, verify current source first):

- `services/gateway/src/media_lifecycle/**`
- `services/worker/src/durable_operations/**`
- `adapters/storage/postgres/src/media_lifecycle/**`
- `adapters/storage/object_lifecycle/**`
- `tests/integration/audio_first_operations/**`
- `apps/mobile/test/audio_first/af15/**`

Verification: DB-A01..08: actual PG migration/upgrade/concurrency, signed-media access/revocation, coupled DB/object restore, measured capacity, restart/lease/idempotency, settlement-aware deletion. Record unavailable live credentials/devices/providers as NOT_RUN or BLOCKED.

## Shared boundaries and exclusions

The allowed lists are mutually exclusive starting boundaries, not permission to seize active claims. The JSON companion is machine-readable. Each window writes only its own docs/workstreams/AFxx-<scope>-20261009.md handoff in addition to these paths. Shared tests/old tests require a visible bounded transfer or AF00 integration.

AF00 additionally elects ownership for each package.json/index export, pnpm workspace/lock/config, migration directory/manifest, root providers, AndroidManifest/Firebase/signing configuration, existing ai_chat_screen.dart, worker startup, notifications and canonical documentation. No other lane edits these by assumption. AF00 lists each exact additional path in its claim; it does not reserve all repository directories. Financial internals and auth do not transfer to AF00 casually: AF01/AF08 review their composition.

SQL proposals may sit inside owned modules; AF00 assigns names in existing migration directories. AF01 can provide ledger SQL proposals under its owned service module. Never edit existing applied SQL. Do not create parallel packages simply because new planning roots were suggested; adapt existing source with a reviewed ownership expansion where appropriate.

Follow [coordination](MULTI-WINDOW-WORK.md). Before every edit check live five-minute activity and relevant current PR head/touched paths. Expand scope only through published transfer; isolated branches do not make overlapping writes safe.

## Integration and handoff

One branch/PR per coherent workstream, avoid long stacks. AF00 merges dependency-ready tested work promptly into a safe target and republishes ready baseline SHAs. A temporary non-deploying integration branch is allowed for collisions/automatic-production hazards; main stays the canonical completed source.

A handoff gives exact base/head/PR, paths, current contract versions, requirements/journeys, source remaining, executable commands/results, simulated vs real evidence, migration plan, merge target and concrete next action. External blockers do not justify abandoned implementable code or repeated doomed verification.

Recovery inputs above were observed open at this snapshot, not newly claimed and not necessarily latest when a window starts. Use [recovery mapping](AUDIO-FIRST-RECOVERY-20261009.md). No old lane is DONE by allocation.

## Completeness accountability

The [audit](AUDIO-FIRST-COMPLETENESS-AUDIT-20261009.md) names remaining design/implementation/qualification gaps. AF00 maintains dispositions; AF13 measures actual journey evidence. No lane may declare the plan exhaustive or a money/media feature production-ready because a structural check passed. Shared financial/auth/provider policy gaps must be resolved before enabling affected operations.

## Whole-app audit supplement

Read [source findings and Settings](WHOLE-APP-SOURCE-AUDIT-20261009.md) and [database/storage operations](BACKEND-STORAGE-OPERATIONS-20261009.md). AF14/AF15 extend the previous fourteen-slot allocation; no paths are claimed by this planning edit. AF14 owns activity presentation; feature lanes own event production. AF09 owns libraries; AF00 elects exact public search/explore/human-profile/shared-state ownership with AF07/AF09. Legacy Twin/owner-session/gift disposition requires AF00 and AF01 review, not deletion. AF15 publishes reusable contracts early; feature-domain jobs remain AF01/02/09/10/12-owned. Production activation requires their applicable DB-A gates; development need not wait for unavailable live infrastructure. No two lanes receive the same additional file implicitly.

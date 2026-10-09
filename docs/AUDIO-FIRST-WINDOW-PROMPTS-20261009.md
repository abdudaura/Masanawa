# Copyable implementation prompts — 2026-10-09

Use one lane per window. Start dependency-ready waves from [the plan](AUDIO-FIRST-WINDOW-PLAN-20261009.md); do not launch all IDs concurrently. These prompts replace old U/R/C/F launch instructions. Each block is self-contained. No runtime path is claimed until the new window publishes its exact claim.

## AF00 — Recovery and integration

```text
MASANAWA AUDIO-FIRST IMPLEMENTATION — AF00
Repository: https://github.com/Baatiku/masanawa
Software Factory: https://github.com/Baatiku/Software-Factory-starter-kit
Window ID: AF00-<unique-label>

Read current main CONTINUE-HERE.md and AGENTS.md, latest available Factory SKILL.md/AGENTS.md, docs/MULTI-WINDOW-WORK.md, docs/AUDIO-FIRST-PRODUCT-20261009.md, docs/AUDIO-FIRST-SCREEN-SPECS.md, docs/MSN-WALLET-P2P-CONTRACT.md, docs/AUDIO-FIRST-INTEGRATION-CONTRACTS.md, docs/AUDIO-FIRST-RECOVERY-20261009.md and your AF00 section in docs/AUDIO-FIRST-WINDOW-PLAN-20261009.md.

Recover fresh main, local working-tree status, relevant PR heads/changed paths and live claims. Preserve the owner's locally fixed app/APK; AF00 must reconcile its source, which was unavailable to the planning window. Never reset/clean/force-push or rebuild an existing implementation from scratch.

Lane goal: Preserve and reconcile local fixes/APK with main and every relevant draft. Publish unique-change/old-lane disposition, canonical imports/migrations, route aliases, dependency integration and final APK/rollback evidence. Update stale shell guards for current decisions; do not drop their security assertions.
Dependencies: None; establish baseline for others.
Inspect existing PR inputs: #497, #461, #552.
Initial allowed paths:
- apps/mobile/lib/src/router/**
- apps/mobile/lib/src/screens/twin/shell_tab.dart
- apps/mobile/lib/src/screens/twin/twin_home_shell.dart
- apps/mobile/lib/src/core/mobile_push.dart
- apps/mobile/lib/src/core/shell_deep_link.dart
- apps/mobile/lib/l10n/**
- services/gateway/src/app.ts
- services/gateway/src/main.ts
- services/gateway/src/migrate.ts
- services/worker/src/main.ts
- services/ops/src/app.ts
- services/ops/src/main.ts
- adapters/storage/postgres/src/schema_admin/**
- database/migrations/**
Claim only the paths actually needed, including named tests and your docs/workstreams/AF00-<scope>-20261009.md. Check overlap and five-minute activity; publish/read back claim before edits. Shared composition/router/export/migration registries/native manifest/locale files remain AF00 unless explicitly transferred. AF01 owns money authority, AF08 authentication and AF05 allocated audio.

Implement complete connected behavior within your lane: persistence, authorization, API/transport, state/UI, errors, retries/offline, tests and recovery as applicable. Consume published contracts; don't invent a second ledger/task/chat/identity authority. Route/composition changes outside your ownership go to AF00 as exact instructions with tests. New SQL needs AF00 allocation; don't alter applied migrations.

Required verification: Combined Flutter analyze/test/build, TypeScript build/unit/contract/DB suites, deep links, account switching, migration rehearsal and qualified final two-device/provider paths.
Map evidence to current UX/WF acceptance IDs. Distinguish actual real provider/device/DB evidence, simulated tests, blocked/unrun tests and source still missing. Do not label source-only or mock tests VERIFIED_E2E.

Publish committed source/tests and immutable SHA-specific handoff with base/head, PR, owned paths, contract versions, commands/results, source gaps, migrations, dependencies and next merge action. Promptly merge dependency-ready source-tested compatible work through AF00 into a safe target; draft/handoff is interim for unfinished work. Never implicitly deploy, bypass failures or spend on providers. If checks cannot run, preserve work and state the exact blocker; do not stop implementable code or repeatedly retry unavailable dependencies.
```

## AF01 — MSN financial authority

```text
MASANAWA AUDIO-FIRST IMPLEMENTATION — AF01
Repository: https://github.com/Baatiku/masanawa
Software Factory: https://github.com/Baatiku/Software-Factory-starter-kit
Window ID: AF01-<unique-label>

Read current main CONTINUE-HERE.md and AGENTS.md, latest available Factory SKILL.md/AGENTS.md, docs/MULTI-WINDOW-WORK.md, docs/AUDIO-FIRST-PRODUCT-20261009.md, docs/AUDIO-FIRST-SCREEN-SPECS.md, docs/MSN-WALLET-P2P-CONTRACT.md, docs/AUDIO-FIRST-INTEGRATION-CONTRACTS.md, docs/AUDIO-FIRST-RECOVERY-20261009.md and your AF01 section in docs/AUDIO-FIRST-WINDOW-PLAN-20261009.md.

Recover fresh main, local working-tree status, relevant PR heads/changed paths and live claims. Preserve the owner's locally fixed app/APK; AF00 must reconcile its source, which was unavailable to the planning window. Never reset/clean/force-push or rebuild an existing implementation from scratch.

Lane goal: Elect existing ledger authority, reconcile #576 and internal crypto transfers, define exact MSN/backing/liquidity rules, implement fiat purchase of MSN, supported crypto deposit/hold/convert/withdraw, transfer/escrow primitives and one receipt/status authority. No spendable fiat/direct fiat cashout or silent Cr migration.
Dependencies: AF00.
Inspect existing PR inputs: #576, #454, #444, #438.
Initial allowed paths:
- packages/commerce/src/**
- adapters/storage/postgres/src/commerce/**
- adapters/crypto/**
- services/gateway/src/msn_wallet/**
- services/gateway/src/financial_audio_first/**
- services/gateway/src/financial_service.ts
- services/gateway/src/financial_billing.ts
- services/gateway/src/billing_wallet.ts
- services/gateway/src/internal_crypto_transfer.ts
- services/gateway/src/internal_crypto_transfer_routes.ts
- apps/mobile/test/audio_first/af01/**
Claim only the paths actually needed, including named tests and your docs/workstreams/AF01-<scope>-20261009.md. Check overlap and five-minute activity; publish/read back claim before edits. Shared composition/router/export/migration registries/native manifest/locale files remain AF00 unless explicitly transferred. AF01 owns money authority, AF08 authentication and AF05 allocated audio.

Implement complete connected behavior within your lane: persistence, authorization, API/transport, state/UI, errors, retries/offline, tests and recovery as applicable. Consume published contracts; don't invent a second ledger/task/chat/identity authority. Route/composition changes outside your ownership go to AF00 as exact instructions with tests. New SQL needs AF00 allocation; don't alter applied migrations.

Required verification: Balanced postings; real DB concurrency; duplicate callbacks/keys; forged events; quote/consent replay; pending funding failure; treasury/liquidity guards and provider reconciliation.
Map evidence to current UX/WF acceptance IDs. Distinguish actual real provider/device/DB evidence, simulated tests, blocked/unrun tests and source still missing. Do not label source-only or mock tests VERIFIED_E2E.

Publish committed source/tests and immutable SHA-specific handoff with base/head, PR, owned paths, contract versions, commands/results, source gaps, migrations, dependencies and next merge action. Promptly merge dependency-ready source-tested compatible work through AF00 into a safe target; draft/handoff is interim for unfinished work. Never implicitly deploy, bypass failures or spend on providers. If checks cannot run, preserve work and state the exact blocker; do not stop implementable code or repeatedly retry unavailable dependencies.
```

## AF02 — MSN P2P escrow

```text
MASANAWA AUDIO-FIRST IMPLEMENTATION — AF02
Repository: https://github.com/Baatiku/masanawa
Software Factory: https://github.com/Baatiku/Software-Factory-starter-kit
Window ID: AF02-<unique-label>

Read current main CONTINUE-HERE.md and AGENTS.md, latest available Factory SKILL.md/AGENTS.md, docs/MULTI-WINDOW-WORK.md, docs/AUDIO-FIRST-PRODUCT-20261009.md, docs/AUDIO-FIRST-SCREEN-SPECS.md, docs/MSN-WALLET-P2P-CONTRACT.md, docs/AUDIO-FIRST-INTEGRATION-CONTRACTS.md, docs/AUDIO-FIRST-RECOVERY-20261009.md and your AF02 section in docs/AUDIO-FIRST-WINDOW-PLAN-20261009.md.

Recover fresh main, local working-tree status, relevant PR heads/changed paths and live claims. Preserve the owner's locally fixed app/APK; AF00 must reconcile its source, which was unavailable to the planning window. Never reset/clean/force-push or rebuild an existing implementation from scratch.

Lane goal: MSN-only offers/order/escrow orchestration and themed Buy/Sell/My orders UI, role-checked dispute console, verified receipt or seller confirmation, frozen paid/disputed orders, reminders and reconciliation. Use AF01 transaction/escrow primitives, never a second ledger.
Dependencies: AF01, AF08.
Inspect existing PR inputs: check fresh open PRs for new contributions.
Initial allowed paths:
- services/gateway/src/msn_p2p/**
- apps/mobile/lib/src/msn_p2p/**
- services/ops/src/msn_p2p/**
- apps/mobile/test/audio_first/af02/**
Claim only the paths actually needed, including named tests and your docs/workstreams/AF02-<scope>-20261009.md. Check overlap and five-minute activity; publish/read back claim before edits. Shared composition/router/export/migration registries/native manifest/locale files remain AF00 unless explicitly transferred. AF01 owns money authority, AF08 authentication and AF05 allocated audio.

Implement complete connected behavior within your lane: persistence, authorization, API/transport, state/UI, errors, retries/offline, tests and recovery as applicable. Consume published contracts; don't invent a second ledger/task/chat/identity authority. Route/composition changes outside your ownership go to AF00 as exact instructions with tests. New SQL needs AF00 allocation; don't alter applied migrations.

Required verification: Reserve/create atomicity; oversell; paid/expiry races; forged screenshot; buyer/seller/operator IDOR; double-release/refund; restart/offline; qualification per payment method.
Map evidence to current UX/WF acceptance IDs. Distinguish actual real provider/device/DB evidence, simulated tests, blocked/unrun tests and source still missing. Do not label source-only or mock tests VERIFIED_E2E.

Publish committed source/tests and immutable SHA-specific handoff with base/head, PR, owned paths, contract versions, commands/results, source gaps, migrations, dependencies and next merge action. Promptly merge dependency-ready source-tested compatible work through AF00 into a safe target; draft/handoff is interim for unfinished work. Never implicitly deploy, bypass failures or spend on providers. If checks cannot run, preserve work and state the exact blocker; do not stop implementable code or repeatedly retry unavailable dependencies.
```

## AF03 — Wallet surfaces and receipts

```text
MASANAWA AUDIO-FIRST IMPLEMENTATION — AF03
Repository: https://github.com/Baatiku/masanawa
Software Factory: https://github.com/Baatiku/Software-Factory-starter-kit
Window ID: AF03-<unique-label>

Read current main CONTINUE-HERE.md and AGENTS.md, latest available Factory SKILL.md/AGENTS.md, docs/MULTI-WINDOW-WORK.md, docs/AUDIO-FIRST-PRODUCT-20261009.md, docs/AUDIO-FIRST-SCREEN-SPECS.md, docs/MSN-WALLET-P2P-CONTRACT.md, docs/AUDIO-FIRST-INTEGRATION-CONTRACTS.md, docs/AUDIO-FIRST-RECOVERY-20261009.md and your AF03 section in docs/AUDIO-FIRST-WINDOW-PLAN-20261009.md.

Recover fresh main, local working-tree status, relevant PR heads/changed paths and live claims. Preserve the owner's locally fixed app/APK; AF00 must reconcile its source, which was unavailable to the planning window. Never reset/clean/force-push or rebuild an existing implementation from scratch.

Lane goal: MSN-first home, crypto holdings, Add/Send/Convert/P2P handoff, funding/withdraw/conversion reviews, durable status and tappable receipts. Preserve #576 panel and real crypto code, remove consumer Cr/spendable fiat with compatible server contracts.
Dependencies: AF01.
Inspect existing PR inputs: #576, #445, #444.
Initial allowed paths:
- apps/mobile/lib/src/screens/wallet/**
- apps/mobile/lib/src/finance/**
- apps/mobile/lib/src/commerce/**
- apps/mobile/lib/src/state/wallet_state.dart
- apps/mobile/test/audio_first/af03/**
Claim only the paths actually needed, including named tests and your docs/workstreams/AF03-<scope>-20261009.md. Check overlap and five-minute activity; publish/read back claim before edits. Shared composition/router/export/migration registries/native manifest/locale files remain AF00 unless explicitly transferred. AF01 owns money authority, AF08 authentication and AF05 allocated audio.

Implement complete connected behavior within your lane: persistence, authorization, API/transport, state/UI, errors, retries/offline, tests and recovery as applicable. Consume published contracts; don't invent a second ledger/task/chat/identity authority. Route/composition changes outside your ownership go to AF00 as exact instructions with tests. New SQL needs AF00 allocation; don't alter applied migrations.

Required verification: Exact formatting, stale cache/offline, restrictions, recipient/quote reviews, failed/uncertain recovery and account isolation; no null-swallowed failure or inert actions.
Map evidence to current UX/WF acceptance IDs. Distinguish actual real provider/device/DB evidence, simulated tests, blocked/unrun tests and source still missing. Do not label source-only or mock tests VERIFIED_E2E.

Publish committed source/tests and immutable SHA-specific handoff with base/head, PR, owned paths, contract versions, commands/results, source gaps, migrations, dependencies and next merge action. Promptly merge dependency-ready source-tested compatible work through AF00 into a safe target; draft/handoff is interim for unfinished work. Never implicitly deploy, bypass failures or spend on providers. If checks cannot run, preserve work and state the exact blocker; do not stop implementable code or repeatedly retry unavailable dependencies.
```

## AF04 — Assistant service menus

```text
MASANAWA AUDIO-FIRST IMPLEMENTATION — AF04
Repository: https://github.com/Baatiku/masanawa
Software Factory: https://github.com/Baatiku/Software-Factory-starter-kit
Window ID: AF04-<unique-label>

Read current main CONTINUE-HERE.md and AGENTS.md, latest available Factory SKILL.md/AGENTS.md, docs/MULTI-WINDOW-WORK.md, docs/AUDIO-FIRST-PRODUCT-20261009.md, docs/AUDIO-FIRST-SCREEN-SPECS.md, docs/MSN-WALLET-P2P-CONTRACT.md, docs/AUDIO-FIRST-INTEGRATION-CONTRACTS.md, docs/AUDIO-FIRST-RECOVERY-20261009.md and your AF04 section in docs/AUDIO-FIRST-WINDOW-PLAN-20261009.md.

Recover fresh main, local working-tree status, relevant PR heads/changed paths and live claims. Preserve the owner's locally fixed app/APK; AF00 must reconcile its source, which was unavailable to the planning window. Never reset/clean/force-push or rebuild an existing implementation from scratch.

Lane goal: Progressive vertical floating billing choices above composer; same durable draft for menu/text/voice, Back/Change, actual catalog/recipient validation, MSN quote/explicit authorization/receipt/status recovery. Integrate existing tasks rather than duplicate. ai_chat_screen shared hook belongs to AF00 until transfer.
Dependencies: AF01.
Inspect existing PR inputs: #497, #447, #520, #521, #580.
Initial allowed paths:
- apps/mobile/lib/src/assistant_workspace/**
- apps/mobile/lib/src/assistant_services/**
- services/gateway/src/assistant_workspace/**
- services/gateway/src/assistant_services/**
- services/gateway/src/agent_billing_assistant.ts
- services/gateway/src/agent_crypto_assistant.ts
- apps/mobile/lib/src/screens/billing/**
- apps/mobile/test/audio_first/af04/**
Claim only the paths actually needed, including named tests and your docs/workstreams/AF04-<scope>-20261009.md. Check overlap and five-minute activity; publish/read back claim before edits. Shared composition/router/export/migration registries/native manifest/locale files remain AF00 unless explicitly transferred. AF01 owns money authority, AF08 authentication and AF05 allocated audio.

Implement complete connected behavior within your lane: persistence, authorization, API/transport, state/UI, errors, retries/offline, tests and recovery as applicable. Consume published contracts; don't invent a second ledger/task/chat/identity authority. Route/composition changes outside your ownership go to AF00 as exact instructions with tests. New SQL needs AF00 allocation; don't alter applied migrations.

Required verification: Menu→text→voice parity; conversation-only purchase; changed terms invalidate consent; no model approval; uncertain provider lookup before retry; localization and low-literacy tap paths.
Map evidence to current UX/WF acceptance IDs. Distinguish actual real provider/device/DB evidence, simulated tests, blocked/unrun tests and source still missing. Do not label source-only or mock tests VERIFIED_E2E.

Publish committed source/tests and immutable SHA-specific handoff with base/head, PR, owned paths, contract versions, commands/results, source gaps, migrations, dependencies and next merge action. Promptly merge dependency-ready source-tested compatible work through AF00 into a safe target; draft/handoff is interim for unfinished work. Never implicitly deploy, bypass failures or spend on providers. If checks cannot run, preserve work and state the exact blocker; do not stop implementable code or repeatedly retry unavailable dependencies.
```

## AF05 — Audio reliability

```text
MASANAWA AUDIO-FIRST IMPLEMENTATION — AF05
Repository: https://github.com/Baatiku/masanawa
Software Factory: https://github.com/Baatiku/Software-Factory-starter-kit
Window ID: AF05-<unique-label>

Read current main CONTINUE-HERE.md and AGENTS.md, latest available Factory SKILL.md/AGENTS.md, docs/MULTI-WINDOW-WORK.md, docs/AUDIO-FIRST-PRODUCT-20261009.md, docs/AUDIO-FIRST-SCREEN-SPECS.md, docs/MSN-WALLET-P2P-CONTRACT.md, docs/AUDIO-FIRST-INTEGRATION-CONTRACTS.md, docs/AUDIO-FIRST-RECOVERY-20261009.md and your AF05 section in docs/AUDIO-FIRST-WINDOW-PLAN-20261009.md.

Recover fresh main, local working-tree status, relevant PR heads/changed paths and live claims. Preserve the owner's locally fixed app/APK; AF00 must reconcile its source, which was unavailable to the planning window. Never reset/clean/force-push or rebuild an existing implementation from scratch.

Lane goal: Diagnose recorder vs transport/provider/output stages, capture/preview/upload/readback independent of Gemini Live, shared audio focus, lifecycle release, Bluetooth/headphones, explicit permission flow and useful errors. Give AF00 manifest/session/screen hooks; native permission edits require a visible transfer.
Dependencies: AF00.
Inspect existing PR inputs: #534, #456, #497.
Initial allowed paths:
- apps/mobile/lib/src/core/app_permissions.dart
- apps/mobile/lib/src/core/live_pcm_audio.dart
- apps/mobile/lib/src/core/live_voice_session.dart
- apps/mobile/lib/src/audio_focus/**
- apps/mobile/lib/src/human_media/**
- apps/mobile/android/app/src/main/kotlin/com/masanawa/app/MainActivity.kt
- apps/mobile/test/audio_first/af05/**
Claim only the paths actually needed, including named tests and your docs/workstreams/AF05-<scope>-20261009.md. Check overlap and five-minute activity; publish/read back claim before edits. Shared composition/router/export/migration registries/native manifest/locale files remain AF00 unless explicitly transferred. AF01 owns money authority, AF08 authentication and AF05 allocated audio.

Implement complete connected behavior within your lane: persistence, authorization, API/transport, state/UI, errors, retries/offline, tests and recovery as applicable. Consume published contracts; don't invent a second ledger/task/chat/identity authority. Route/composition changes outside your ownership go to AF00 as exact instructions with tests. New SQL needs AF00 allocation; don't alter applied migrations.

Required verification: Actual handset local recording first, two-device notes, denied/revoked permission, contention, interrupted lifecycle, route switch, live send/receive, Bluetooth and subsequent recording after call.
Map evidence to current UX/WF acceptance IDs. Distinguish actual real provider/device/DB evidence, simulated tests, blocked/unrun tests and source still missing. Do not label source-only or mock tests VERIFIED_E2E.

Publish committed source/tests and immutable SHA-specific handoff with base/head, PR, owned paths, contract versions, commands/results, source gaps, migrations, dependencies and next merge action. Promptly merge dependency-ready source-tested compatible work through AF00 into a safe target; draft/handoff is interim for unfinished work. Never implicitly deploy, bypass failures or spend on providers. If checks cannot run, preserve work and state the exact blocker; do not stop implementable code or repeatedly retry unavailable dependencies.
```

## AF06 — Messaging and chat transfers

```text
MASANAWA AUDIO-FIRST IMPLEMENTATION — AF06
Repository: https://github.com/Baatiku/masanawa
Software Factory: https://github.com/Baatiku/Software-Factory-starter-kit
Window ID: AF06-<unique-label>

Read current main CONTINUE-HERE.md and AGENTS.md, latest available Factory SKILL.md/AGENTS.md, docs/MULTI-WINDOW-WORK.md, docs/AUDIO-FIRST-PRODUCT-20261009.md, docs/AUDIO-FIRST-SCREEN-SPECS.md, docs/MSN-WALLET-P2P-CONTRACT.md, docs/AUDIO-FIRST-INTEGRATION-CONTRACTS.md, docs/AUDIO-FIRST-RECOVERY-20261009.md and your AF06 section in docs/AUDIO-FIRST-WINDOW-PLAN-20261009.md.

Recover fresh main, local working-tree status, relevant PR heads/changed paths and live claims. Preserve the owner's locally fixed app/APK; AF00 must reconcile its source, which was unavailable to the planning window. Never reset/clean/force-push or rebuild an existing implementation from scratch.

Lane goal: Recover canonical DM implementation rather than maintain competing messages/human_messages stacks. WhatsApp-like compact composer, recorder preview/retry, durable outbox/realtime/history and MSN/crypto transfer sheet/card using AF01/AF03 contracts. No private money in public content.
Dependencies: AF01, AF05.
Inspect existing PR inputs: #529, #530, #533, #531, #537, #472, #475.
Initial allowed paths:
- apps/mobile/lib/src/messages/human_dm_controller.dart
- apps/mobile/lib/src/messages/human_dm_outbox.dart
- apps/mobile/lib/src/messages/human_dm_screen.dart
- apps/mobile/lib/src/messages/human_dm_transport.dart
- apps/mobile/lib/src/messages/realtime/**
- apps/mobile/lib/src/human_messages/**
- apps/mobile/lib/src/chat_transfers/**
- services/gateway/src/human_messages/**
- services/gateway/src/human_dm_realtime/**
- services/gateway/src/chat_transfers/**
- apps/mobile/test/audio_first/af06/**
Claim only the paths actually needed, including named tests and your docs/workstreams/AF06-<scope>-20261009.md. Check overlap and five-minute activity; publish/read back claim before edits. Shared composition/router/export/migration registries/native manifest/locale files remain AF00 unless explicitly transferred. AF01 owns money authority, AF08 authentication and AF05 allocated audio.

Implement complete connected behavior within your lane: persistence, authorization, API/transport, state/UI, errors, retries/offline, tests and recovery as applicable. Consume published contracts; don't invent a second ledger/task/chat/identity authority. Route/composition changes outside your ownership go to AF00 as exact instructions with tests. New SQL needs AF00 allocation; don't alter applied migrations.

Required verification: Two-device send/readback; restart/idempotent outbox; blocked users; account switch; media retries; chat failure after successful transfer; receipt parity and no duplicate charge.
Map evidence to current UX/WF acceptance IDs. Distinguish actual real provider/device/DB evidence, simulated tests, blocked/unrun tests and source still missing. Do not label source-only or mock tests VERIFIED_E2E.

Publish committed source/tests and immutable SHA-specific handoff with base/head, PR, owned paths, contract versions, commands/results, source gaps, migrations, dependencies and next merge action. Promptly merge dependency-ready source-tested compatible work through AF00 into a safe target; draft/handoff is interim for unfinished work. Never implicitly deploy, bypass failures or spend on providers. If checks cannot run, preserve work and state the exact blocker; do not stop implementable code or repeatedly retry unavailable dependencies.
```

## AF07 — Masana and Contacts directory

```text
MASANAWA AUDIO-FIRST IMPLEMENTATION — AF07
Repository: https://github.com/Baatiku/masanawa
Software Factory: https://github.com/Baatiku/Software-Factory-starter-kit
Window ID: AF07-<unique-label>

Read current main CONTINUE-HERE.md and AGENTS.md, latest available Factory SKILL.md/AGENTS.md, docs/MULTI-WINDOW-WORK.md, docs/AUDIO-FIRST-PRODUCT-20261009.md, docs/AUDIO-FIRST-SCREEN-SPECS.md, docs/MSN-WALLET-P2P-CONTRACT.md, docs/AUDIO-FIRST-INTEGRATION-CONTRACTS.md, docs/AUDIO-FIRST-RECOVERY-20261009.md and your AF07 section in docs/AUDIO-FIRST-WINDOW-PLAN-20261009.md.

Recover fresh main, local working-tree status, relevant PR heads/changed paths and live claims. Preserve the owner's locally fixed app/APK; AF00 must reconcile its source, which was unavailable to the planning window. Never reset/clean/force-push or rebuild an existing implementation from scratch.

Lane goal: New chat opens Masana & Contacts with typed AI/person entries, roles/search/recents/favorites and real accepted people/request lifecycle. Reuse C01/U21; voluntary local phonebook without silent upload or treating an unverified number as identity.
Dependencies: AF00.
Inspect existing PR inputs: #468, #508, #509, #510, #511.
Initial allowed paths:
- apps/mobile/lib/src/contact_hub/**
- apps/mobile/lib/src/masana_contacts/**
- apps/mobile/lib/src/messages/human_contacts_controller.dart
- apps/mobile/lib/src/messages/human_contacts_screen.dart
- apps/mobile/lib/src/messages/human_contacts_transport.dart
- apps/mobile/lib/src/messages/human_new_message_screen.dart
- services/gateway/src/human_contacts/**
- apps/mobile/test/audio_first/af07/**
Claim only the paths actually needed, including named tests and your docs/workstreams/AF07-<scope>-20261009.md. Check overlap and five-minute activity; publish/read back claim before edits. Shared composition/router/export/migration registries/native manifest/locale files remain AF00 unless explicitly transferred. AF01 owns money authority, AF08 authentication and AF05 allocated audio.

Implement complete connected behavior within your lane: persistence, authorization, API/transport, state/UI, errors, retries/offline, tests and recovery as applicable. Consume published contracts; don't invent a second ledger/task/chat/identity authority. Route/composition changes outside your ownership go to AF00 as exact instructions with tests. New SQL needs AF00 allocation; don't alter applied migrations.

Required verification: Correct human/AI route, stable IDs, denied contacts permission, privacy/block/request rules, offline directory, favorite account fencing and return to draft.
Map evidence to current UX/WF acceptance IDs. Distinguish actual real provider/device/DB evidence, simulated tests, blocked/unrun tests and source still missing. Do not label source-only or mock tests VERIFIED_E2E.

Publish committed source/tests and immutable SHA-specific handoff with base/head, PR, owned paths, contract versions, commands/results, source gaps, migrations, dependencies and next merge action. Promptly merge dependency-ready source-tested compatible work through AF00 into a safe target; draft/handoff is interim for unfinished work. Never implicitly deploy, bypass failures or spend on providers. If checks cannot run, preserve work and state the exact blocker; do not stop implementable code or repeatedly retry unavailable dependencies.
```

## AF08 — Authentication and launch polish

```text
MASANAWA AUDIO-FIRST IMPLEMENTATION — AF08
Repository: https://github.com/Baatiku/masanawa
Software Factory: https://github.com/Baatiku/Software-Factory-starter-kit
Window ID: AF08-<unique-label>

Read current main CONTINUE-HERE.md and AGENTS.md, latest available Factory SKILL.md/AGENTS.md, docs/MULTI-WINDOW-WORK.md, docs/AUDIO-FIRST-PRODUCT-20261009.md, docs/AUDIO-FIRST-SCREEN-SPECS.md, docs/MSN-WALLET-P2P-CONTRACT.md, docs/AUDIO-FIRST-INTEGRATION-CONTRACTS.md, docs/AUDIO-FIRST-RECOVERY-20261009.md and your AF08 section in docs/AUDIO-FIRST-WINDOW-PLAN-20261009.md.

Recover fresh main, local working-tree status, relevant PR heads/changed paths and live claims. Preserve the owner's locally fixed app/APK; AF00 must reconcile its source, which was unavailable to the planning window. Never reset/clean/force-push or rebuild an existing implementation from scratch.

Lane goal: Email/phone signup/login selectors preserving working email, numeric-password request with server security and unverified phone status, qualified recovery and wallet step-up; centered accessible icon-only language selector and neutral native/Flutter launch variants. Reconcile authoritative auth, do not bolt on parallel identity.
Dependencies: AF00.
Inspect existing PR inputs: #497, #539.
Initial allowed paths:
- apps/mobile/lib/src/screens/onboarding/**
- apps/mobile/lib/src/screens/splash/**
- apps/mobile/lib/src/state/session_state.dart
- apps/mobile/lib/src/auth_audio_first/**
- services/gateway/src/customer_auth.ts
- services/gateway/src/customer_auth.test.ts
- services/gateway/src/auth_audio_first/**
- packages/identity/src/auth_audio_first/**
- apps/mobile/android/app/src/main/res/drawable/launch_background.xml
- apps/mobile/android/app/src/main/res/drawable-v21/launch_background.xml
- apps/mobile/android/app/src/main/res/drawable-night/launch_background.xml
- apps/mobile/android/app/src/main/res/drawable-night-v21/launch_background.xml
- apps/mobile/android/app/src/main/res/values/styles.xml
- apps/mobile/android/app/src/main/res/values-night/styles.xml
- apps/mobile/android/app/src/main/res/values-v31/styles.xml
- apps/mobile/android/app/src/main/res/values-night-v31/styles.xml
- apps/mobile/test/audio_first/af08/**
Claim only the paths actually needed, including named tests and your docs/workstreams/AF08-<scope>-20261009.md. Check overlap and five-minute activity; publish/read back claim before edits. Shared composition/router/export/migration registries/native manifest/locale files remain AF00 unless explicitly transferred. AF01 owns money authority, AF08 authentication and AF05 allocated audio.

Implement complete connected behavior within your lane: persistence, authorization, API/transport, state/UI, errors, retries/offline, tests and recovery as applicable. Consume published contracts; don't invent a second ledger/task/chat/identity authority. Route/composition changes outside your ownership go to AF00 as exact instructions with tests. New SQL needs AF00 allocation; don't alter applied migrations.

Required verification: Guessing/rate limits, secure credential storage, no enumeration, recovery/session revocation, linked accounts, unverified-number impersonation, launch Android12+/night, small screens/keyboard.
Map evidence to current UX/WF acceptance IDs. Distinguish actual real provider/device/DB evidence, simulated tests, blocked/unrun tests and source still missing. Do not label source-only or mock tests VERIFIED_E2E.

Publish committed source/tests and immutable SHA-specific handoff with base/head, PR, owned paths, contract versions, commands/results, source gaps, migrations, dependencies and next merge action. Promptly merge dependency-ready source-tested compatible work through AF00 into a safe target; draft/handoff is interim for unfinished work. Never implicitly deploy, bypass failures or spend on providers. If checks cannot run, preserve work and state the exact blocker; do not stop implementable code or repeatedly retry unavailable dependencies.
```

## AF09 — Published audio Talks

```text
MASANAWA AUDIO-FIRST IMPLEMENTATION — AF09
Repository: https://github.com/Baatiku/masanawa
Software Factory: https://github.com/Baatiku/Software-Factory-starter-kit
Window ID: AF09-<unique-label>

Read current main CONTINUE-HERE.md and AGENTS.md, latest available Factory SKILL.md/AGENTS.md, docs/MULTI-WINDOW-WORK.md, docs/AUDIO-FIRST-PRODUCT-20261009.md, docs/AUDIO-FIRST-SCREEN-SPECS.md, docs/MSN-WALLET-P2P-CONTRACT.md, docs/AUDIO-FIRST-INTEGRATION-CONTRACTS.md, docs/AUDIO-FIRST-RECOVERY-20261009.md and your AF09 section in docs/AUDIO-FIRST-WINDOW-PLAN-20261009.md.

Recover fresh main, local working-tree status, relevant PR heads/changed paths and live claims. Preserve the owner's locally fixed app/APK; AF00 must reconcile its source, which was unavailable to the planning window. Never reset/clean/force-push or rebuild an existing implementation from scratch.

Lane goal: Audio-post feed, recording/trim/preview/upload/processing/publish, following/discover, engaging waveform cards, likes/comments/play counts/save/share/report. Reuse media/social/replay assets safely; old live IDs remain typed legacy resources, never coerced into new posts.
Dependencies: AF05.
Inspect existing PR inputs: #497, #548, #503.
Initial allowed paths:
- apps/mobile/lib/src/audio_posts/**
- apps/mobile/lib/src/screens/talks/talk_home_screen.dart
- apps/mobile/lib/src/screens/talks/create_audio_post_screen.dart
- services/gateway/src/audio_posts/**
- packages/talks/audio_posts/**
- adapters/storage/postgres/src/audio_posts/**
- apps/mobile/test/audio_first/af09/**
Claim only the paths actually needed, including named tests and your docs/workstreams/AF09-<scope>-20261009.md. Check overlap and five-minute activity; publish/read back claim before edits. Shared composition/router/export/migration registries/native manifest/locale files remain AF00 unless explicitly transferred. AF01 owns money authority, AF08 authentication and AF05 allocated audio.

Implement complete connected behavior within your lane: persistence, authorization, API/transport, state/UI, errors, retries/offline, tests and recovery as applicable. Consume published contracts; don't invent a second ledger/task/chat/identity authority. Route/composition changes outside your ownership go to AF00 as exact instructions with tests. New SQL needs AF00 allocation; don't alter applied migrations.

Required verification: Two-account publication/playback/follow/comment; publish retry dedup; codec/size limits; one player; played-time counts/dedup; moderation/delete/privacy; low data/offline drafts.
Map evidence to current UX/WF acceptance IDs. Distinguish actual real provider/device/DB evidence, simulated tests, blocked/unrun tests and source still missing. Do not label source-only or mock tests VERIFIED_E2E.

Publish committed source/tests and immutable SHA-specific handoff with base/head, PR, owned paths, contract versions, commands/results, source gaps, migrations, dependencies and next merge action. Promptly merge dependency-ready source-tested compatible work through AF00 into a safe target; draft/handoff is interim for unfinished work. Never implicitly deploy, bypass failures or spend on providers. If checks cannot run, preserve work and state the exact blocker; do not stop implementable code or repeatedly retry unavailable dependencies.
```

## AF10 — Audio-focused Rooms

```text
MASANAWA AUDIO-FIRST IMPLEMENTATION — AF10
Repository: https://github.com/Baatiku/masanawa
Software Factory: https://github.com/Baatiku/Software-Factory-starter-kit
Window ID: AF10-<unique-label>

Read current main CONTINUE-HERE.md and AGENTS.md, latest available Factory SKILL.md/AGENTS.md, docs/MULTI-WINDOW-WORK.md, docs/AUDIO-FIRST-PRODUCT-20261009.md, docs/AUDIO-FIRST-SCREEN-SPECS.md, docs/MSN-WALLET-P2P-CONTRACT.md, docs/AUDIO-FIRST-INTEGRATION-CONTRACTS.md, docs/AUDIO-FIRST-RECOVERY-20261009.md and your AF10 section in docs/AUDIO-FIRST-WINDOW-PLAN-20261009.md.

Recover fresh main, local working-tree status, relevant PR heads/changed paths and live claims. Preserve the owner's locally fixed app/APK; AF00 must reconcile its source, which was unavailable to the planning window. Never reset/clean/force-push or rebuild an existing implementation from scratch.

Lane goal: Persistent groups, membership, roles, invite/join/leave, audio history, moderation and notifications through adapters. Optional live room integration only after qualified session authority; reuse existing live infrastructure without restarting public Talk feed.
Dependencies: AF05, AF06.
Inspect existing PR inputs: #439, #450, #456.
Initial allowed paths:
- apps/mobile/lib/src/audio_rooms/**
- services/gateway/src/audio_rooms/**
- packages/talks/audio_rooms/**
- adapters/storage/postgres/src/audio_rooms/**
- apps/mobile/test/audio_first/af10/**
Claim only the paths actually needed, including named tests and your docs/workstreams/AF10-<scope>-20261009.md. Check overlap and five-minute activity; publish/read back claim before edits. Shared composition/router/export/migration registries/native manifest/locale files remain AF00 unless explicitly transferred. AF01 owns money authority, AF08 authentication and AF05 allocated audio.

Implement complete connected behavior within your lane: persistence, authorization, API/transport, state/UI, errors, retries/offline, tests and recovery as applicable. Consume published contracts; don't invent a second ledger/task/chat/identity authority. Route/composition changes outside your ownership go to AF00 as exact instructions with tests. New SQL needs AF00 allocation; don't alter applied migrations.

Required verification: Outsider read/media/join denial, kick/revoke, private invite/block/limits, durable notes, offline/reconnect and independently qualified two-device live audio.
Map evidence to current UX/WF acceptance IDs. Distinguish actual real provider/device/DB evidence, simulated tests, blocked/unrun tests and source still missing. Do not label source-only or mock tests VERIFIED_E2E.

Publish committed source/tests and immutable SHA-specific handoff with base/head, PR, owned paths, contract versions, commands/results, source gaps, migrations, dependencies and next merge action. Promptly merge dependency-ready source-tested compatible work through AF00 into a safe target; draft/handoff is interim for unfinished work. Never implicitly deploy, bypass failures or spend on providers. If checks cannot run, preserve work and state the exact blocker; do not stop implementable code or repeatedly retry unavailable dependencies.
```

## AF11 — Calls recovery

```text
MASANAWA AUDIO-FIRST IMPLEMENTATION — AF11
Repository: https://github.com/Baatiku/masanawa
Software Factory: https://github.com/Baatiku/Software-Factory-starter-kit
Window ID: AF11-<unique-label>

Read current main CONTINUE-HERE.md and AGENTS.md, latest available Factory SKILL.md/AGENTS.md, docs/MULTI-WINDOW-WORK.md, docs/AUDIO-FIRST-PRODUCT-20261009.md, docs/AUDIO-FIRST-SCREEN-SPECS.md, docs/MSN-WALLET-P2P-CONTRACT.md, docs/AUDIO-FIRST-INTEGRATION-CONTRACTS.md, docs/AUDIO-FIRST-RECOVERY-20261009.md and your AF11 section in docs/AUDIO-FIRST-WINDOW-PLAN-20261009.md.

Recover fresh main, local working-tree status, relevant PR heads/changed paths and live claims. Preserve the owner's locally fixed app/APK; AF00 must reconcile its source, which was unavailable to the planning window. Never reset/clean/force-push or rebuild an existing implementation from scratch.

Lane goal: Reconcile existing C09 calling, recent/missed calls, typed directory selection, ringing/connect/mute/output/end/reconnect; proposed Chats Calls filter. AF00 integrates push/deep links/composition; do not duplicate those files from old call branches.
Dependencies: AF05, AF07.
Inspect existing PR inputs: #575, #578.
Initial allowed paths:
- apps/mobile/lib/src/human_calls/**
- services/gateway/src/human_calls/**
- apps/mobile/test/audio_first/af11/**
Claim only the paths actually needed, including named tests and your docs/workstreams/AF11-<scope>-20261009.md. Check overlap and five-minute activity; publish/read back claim before edits. Shared composition/router/export/migration registries/native manifest/locale files remain AF00 unless explicitly transferred. AF01 owns money authority, AF08 authentication and AF05 allocated audio.

Implement complete connected behavior within your lane: persistence, authorization, API/transport, state/UI, errors, retries/offline, tests and recovery as applicable. Consume published contracts; don't invent a second ledger/task/chat/identity authority. Route/composition changes outside your ownership go to AF00 as exact instructions with tests. New SQL needs AF00 allocation; don't alter applied migrations.

Required verification: Two physical devices, caller/callee authorization, answer/end races, missed call readback, notification/deep link, microphone release and new voice note afterwards; video retained only if already qualified.
Map evidence to current UX/WF acceptance IDs. Distinguish actual real provider/device/DB evidence, simulated tests, blocked/unrun tests and source still missing. Do not label source-only or mock tests VERIFIED_E2E.

Publish committed source/tests and immutable SHA-specific handoff with base/head, PR, owned paths, contract versions, commands/results, source gaps, migrations, dependencies and next merge action. Promptly merge dependency-ready source-tested compatible work through AF00 into a safe target; draft/handoff is interim for unfinished work. Never implicitly deploy, bypass failures or spend on providers. If checks cannot run, preserve work and state the exact blocker; do not stop implementable code or repeatedly retry unavailable dependencies.
```

## AF12 — Masana creators and scheduled publishing

```text
MASANAWA AUDIO-FIRST IMPLEMENTATION — AF12
Repository: https://github.com/Baatiku/masanawa
Software Factory: https://github.com/Baatiku/Software-Factory-starter-kit
Window ID: AF12-<unique-label>

Read current main CONTINUE-HERE.md and AGENTS.md, latest available Factory SKILL.md/AGENTS.md, docs/MULTI-WINDOW-WORK.md, docs/AUDIO-FIRST-PRODUCT-20261009.md, docs/AUDIO-FIRST-SCREEN-SPECS.md, docs/MSN-WALLET-P2P-CONTRACT.md, docs/AUDIO-FIRST-INTEGRATION-CONTRACTS.md, docs/AUDIO-FIRST-RECOVERY-20261009.md and your AF12 section in docs/AUDIO-FIRST-WINDOW-PLAN-20261009.md.

Recover fresh main, local working-tree status, relevant PR heads/changed paths and live claims. Preserve the owner's locally fixed app/APK; AF00 must reconcile its source, which was unavailable to the planning window. Never reset/clean/force-push or rebuild an existing implementation from scratch.

Lane goal: Retain seventeen persona identities, extend distinct editorial profiles, follow/public posts, scripts/sources/AI labels/Gemini delivery, publication scheduler/budget/lease/retry/admin pause and a reviewed sample slate. Reuse scheduler/research workers; no autonomous financial actions or fake personal experiences.
Dependencies: AF09.
Inspect existing PR inputs: #545, #514, #517.
Initial allowed paths:
- services/gateway/src/masana_creators/**
- services/worker/src/masana_publishing/**
- services/ops/src/masana_creators/**
- packages/agents/masana_creators/**
- apps/mobile/lib/src/masana_creators/**
- apps/mobile/lib/src/screens/profile/persona_profile_screen.dart
- apps/mobile/test/audio_first/af12/**
Claim only the paths actually needed, including named tests and your docs/workstreams/AF12-<scope>-20261009.md. Check overlap and five-minute activity; publish/read back claim before edits. Shared composition/router/export/migration registries/native manifest/locale files remain AF00 unless explicitly transferred. AF01 owns money authority, AF08 authentication and AF05 allocated audio.

Implement complete connected behavior within your lane: persistence, authorization, API/transport, state/UI, errors, retries/offline, tests and recovery as applicable. Consume published contracts; don't invent a second ledger/task/chat/identity authority. Route/composition changes outside your ownership go to AF00 as exact instructions with tests. New SQL needs AF00 allocation; don't alter applied migrations.

Required verification: Listening tests per language/voice/emotion; facts/source attribution; duplicate occurrence/publish, failed/empty audio, budgets/retry/admin pause, block/follow visibility and real generated sample artifacts.
Map evidence to current UX/WF acceptance IDs. Distinguish actual real provider/device/DB evidence, simulated tests, blocked/unrun tests and source still missing. Do not label source-only or mock tests VERIFIED_E2E.

Publish committed source/tests and immutable SHA-specific handoff with base/head, PR, owned paths, contract versions, commands/results, source gaps, migrations, dependencies and next merge action. Promptly merge dependency-ready source-tested compatible work through AF00 into a safe target; draft/handoff is interim for unfinished work. Never implicitly deploy, bypass failures or spend on providers. If checks cannot run, preserve work and state the exact blocker; do not stop implementable code or repeatedly retry unavailable dependencies.
```

## AF13 — Acceptance, privacy and operations evidence

```text
MASANAWA AUDIO-FIRST IMPLEMENTATION — AF13
Repository: https://github.com/Baatiku/masanawa
Software Factory: https://github.com/Baatiku/Software-Factory-starter-kit
Window ID: AF13-<unique-label>

Read current main CONTINUE-HERE.md and AGENTS.md, latest available Factory SKILL.md/AGENTS.md, docs/MULTI-WINDOW-WORK.md, docs/AUDIO-FIRST-PRODUCT-20261009.md, docs/AUDIO-FIRST-SCREEN-SPECS.md, docs/MSN-WALLET-P2P-CONTRACT.md, docs/AUDIO-FIRST-INTEGRATION-CONTRACTS.md, docs/AUDIO-FIRST-RECOVERY-20261009.md and your AF13 section in docs/AUDIO-FIRST-WINDOW-PLAN-20261009.md.

Recover fresh main, local working-tree status, relevant PR heads/changed paths and live claims. Preserve the owner's locally fixed app/APK; AF00 must reconcile its source, which was unavailable to the planning window. Never reset/clean/force-push or rebuild an existing implementation from scratch.

Lane goal: Build executable cross-feature/device/provider/restore qualification, threat/privacy/accessibility/performance matrix and redacted evidence. Inspect every old F gate; update expected semantics while preserving security proof. No runtime/CI/deployment mutation or mock-as-real completion.
Dependencies: AF00.
Inspect existing PR inputs: #527, #518, #559, #561, #554, #567, #570.
Initial allowed paths:
- tests/e2e/audio_first/**
- tests/security/audio_first/**
- tests/recovery/audio_first/**
- tools/audio-first-qualification/**
- apps/mobile/test/audio_first/af13/**
Claim only the paths actually needed, including named tests and your docs/workstreams/AF13-<scope>-20261009.md. Check overlap and five-minute activity; publish/read back claim before edits. Shared composition/router/export/migration registries/native manifest/locale files remain AF00 unless explicitly transferred. AF01 owns money authority, AF08 authentication and AF05 allocated audio.

Implement complete connected behavior within your lane: persistence, authorization, API/transport, state/UI, errors, retries/offline, tests and recovery as applicable. Consume published contracts; don't invent a second ledger/task/chat/identity authority. Route/composition changes outside your ownership go to AF00 as exact instructions with tests. New SQL needs AF00 allocation; don't alter applied migrations.

Required verification: AF acceptance matrix, negative authority, escrow/concurrency/restore, real configured providers/physical devices, low-end/offline, artifact identity/rollback. Run only available dependencies; record precise unavailable checks.
Map evidence to current UX/WF acceptance IDs. Distinguish actual real provider/device/DB evidence, simulated tests, blocked/unrun tests and source still missing. Do not label source-only or mock tests VERIFIED_E2E.

Publish committed source/tests and immutable SHA-specific handoff with base/head, PR, owned paths, contract versions, commands/results, source gaps, migrations, dependencies and next merge action. Promptly merge dependency-ready source-tested compatible work through AF00 into a safe target; draft/handoff is interim for unfinished work. Never implicitly deploy, bypass failures or spend on providers. If checks cannot run, preserve work and state the exact blocker; do not stop implementable code or repeatedly retry unavailable dependencies.
```


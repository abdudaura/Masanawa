# R17 — Approved mobile root shell (checkpoint 2026-10-08)

## Ownership
- Owner: ChatGPT — R17 isolated implementation lane.
- Branch: `work/r17-root-shell-20261008`, PR #411 (draft).
- Base `main` SHA: `265f2c5f6db81d076f57ca32dd47db3ff7fb0ad6`.
- Latest implementation SHA before this checkpoint: `7fe7bce3b4e3908676c1837151ee946759712e1f`.
- Exact owned paths:
  - `apps/mobile/lib/src/screens/twin/twin_home_shell.dart`
  - `apps/mobile/lib/src/screens/talks/talk_home_screen.dart`
  - `apps/mobile/lib/src/screens/chat/ai_chat_screen.dart`
  - `apps/mobile/lib/src/screens/wallet/wallet_screen.dart`
  - `apps/mobile/lib/src/router/app_router.dart`
  - `apps/mobile/test/twin_home_shell_test.dart`
  - `apps/mobile/test/wallet_service_shortcuts_test.dart`
  - `apps/mobile/test/app_shell_route_compatibility_test.dart`
  - This workstream checkpoint.

## Implementation evidence — PARTIAL, committed
- Root Home / Agents / Wallet / Talk navigation, accessible Activity/Profile header, public Start Talk FAB. Hide FAB with keyboard, Wallet and immersive private Talk. `didUpdateWidget` handles changed initial index.
- Home keeps Explore / Live Talks vertical feeds; tab bar is embedded without duplicate root toolbar or Android status-bar inset.
- Agents has Masanawa Agents / public Twins tabs, compact local roster search (name/role/bio), refresh and truthful loading/error/empty feedback. Server Gateway Twin directory backs public Twins search, pagination, profile and private chat. Existing My Twin editor remains reachable. No invented roster or guessed persona roles.
- Wallet embeds without a duplicate title bar, shows available native balance via existing provider, and links in canonical order to Crypto and server-catalog-qualified Billing categories (data/airtime/electricity/TV). Links only navigate; they do not execute charges or enable the microphone. Inactive Add/Send/Withdraw buttons are hidden rather than stranded. Service entry remains usable if balance loading/errors.
- Talk embeds existing private authenticated Gwani chat without automatically starting the microphone. Chat retains search/call/overflow; embedded overflow reaches Activity/Profile. Leaving Talk disposes the chat session, whose inline audio teardown is already implemented in AiChatScreen.
- Legacy `/home?tab=create|activity|you` targets safely route to actual Create/Activity/You destinations; `/agents`, `/masana`, `/chats` land on the correct modern tabs. `/activity` and `/you` are protected routes.

## Verification evidence — NOT PASSED OR CERTIFIED
- Source patches were published and read back via GitHub. New/updated tests include six shell widget cases, one pure agent-search case, three wallet service cases, and two legacy-route cases.
- Flutter analyzer and widget tests **not executed** locally; no Flutter SDK available in the current connector-only editing workflow.
- Latest observed GitHub workflow runs for `7fe7bce3`: Foundation CI #37711989123, Mobile Build #37711989082 both failed with **zero job steps**. This is runner/CI-allocation evidence, not an application compilation result; rerun when runners function.
- APK, release signing, device, speech audio, bilingual/RTL layout and payment tests: **NOT RUN**. Deployment: **NOT ATTEMPTED**.
- PR mergeable by GitHub metadata but intentionally draft and unmerged.

## Integration and remaining acceptance
- R01 PR #406 owns shared color/theme and separate app-root `main.dart`. R11 PR #407 also edits app root and locale. Preserve both; R17 never wrote either file.
- R03 PR #412 owns agent availability contract; R17 shows server roster but cannot authoritatively classify provider-managed Experts vs owned Twins without a typed provenance field. Do not infer it from text labels.
- R06/R07 must add *durable, voice-first* private service intent, qualified financial cards and exact authoritative confirmation. Current Billing links use existing category selector only; **do not call this full conversational financial acceptance**.
- R18 owns editable avatar/profile persistence; R14 owns real notification unread/push qualification. Current header entry points do not complete those tasks.
- Confirm app flow on Android 320px and normal width, Talk audio stop/resume, Profile/Activity navigation, Agent/Twin discovery, billing eligibility, recovery across restart, and provider caps.
- Before merge: run `cd apps/mobile && flutter analyze`, `flutter test test/twin_home_shell_test.dart test/wallet_service_shortcuts_test.dart test/app_shell_route_compatibility_test.dart`, full mobile suite, and build/handset acceptance. Repair failures and refresh ownership if this 5-minute lease becomes stale.

## 2026-10-08 continuation — reclaimed R17 review
- Latest main remains `265f2c5f6db81d076f57ca32dd47db3ff7fb0ad6`; open PRs #406–#414 checked. R17 PR #411 last repository work predates this continuation by over five minutes; retaining its exact branch and code rather than restarting.
- Existing bounded R17 owned paths remain unchanged; review targets navigation to Activity/You, public Twin chat's agent-detail readiness, and high-value tests. No R01/R11/R03 or financial authority code edits.
- Fresh workstream activity: this checkpoint. Implementation from previous pass is PARTIAL; all actual Flutter tests/build and device qualification remain unverified.

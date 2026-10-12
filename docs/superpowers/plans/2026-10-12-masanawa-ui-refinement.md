# Masanawa UI Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking. Execute in this session; do not dispatch other agents without owner direction.

**Goal:** Deliver the requested cohesive Flutter UI and functional search/Rooms improvements while preserving existing calls, auth and financial behavior.

**Architecture:** Reconcile feature source selectively onto fresh main, then extend existing shared presentation components. Backend identities, media permissions, history, financial execution and membership stay canonical. Presentation and each connected feature receive separate reviewable commits.

**Tech Stack:** Flutter/Dart, Riverpod, GoRouter, Dio; Node 24, pnpm 12.8.2, TypeScript, Vitest, PostgreSQL 18 where backend integration is affected.

**Spec:** [Source audit and design](../specs/2026-10-12-masanawa-ui-audit-design.md).

## Global constraints

- Chats · Status · Wallet · Calls · Rooms; Chats ordinary launch default.
- White light-mode headers, readable green wordmark, neutral typography, restrained bright-green selected icons.
- Preserve main's native/group/incoming Calls, explicit deep links and existing auth/financial/media integrations.
- No fake content, invented aggregate balances, silent Cr-to-MSN rename, unsupported user publishing or user-created Rooms.
- Refresh refs, PRs and exact-path claims before every cross-window source change; AF00 retains shared composition, AF01 money and AF08 auth authority.
- Record actual commands/results and distinguish source, integration, device/provider and deployment evidence.

## Review focus

1. Delayed results after query/account changes must never display another query's or account's private records.
2. Search matches beyond the first call-history page must be found without unbounded fetching.
3. Missing backend route/disabled capability must not be called an empty successful Rooms response.
4. Long localized names, balances and large text must remain readable at 320px with the keyboard open.
5. Presentation changes must retain quote/recipient/network/fee disclosure and uncertain financial status recovery.

## Task 1: Reconcile the actual execution baseline

**Files:** `.factory/leases.json` on factory/claims; existing shell/router, feature and domain paths named in the spec; local audit/plan only until implementation ownership is acquired.

**Interfaces:** Consume exact Git/PR heads and claims; produce one source baseline with preserved working Calls and a file-by-file feature adoption inventory.

- [ ] Refresh main, integration/rebuild, Rooms and Status media refs; record SHAs and live ownership. Inspect any new owner commits before editing.
- [ ] Use an isolated feature branch/worktree from fresh main; preserve all source branches. Acquire exact paths under the relevant lane and shared-owner transfer policy.
- [ ] Compare Status/inbox/Rooms feature source with main by final file content and ancestry. Explicitly retain main `screens/calls/calls_screen.dart`, native/group/incoming controllers and reporter/push bindings.
- [ ] Identify the single shell to ship and its route/API dependencies; do not leave both shells independently active. Reuse Status's connected shell only with main call bindings preserved.
- [ ] Provision compatible Flutter/Dart tools for local verification if available; capture baseline analyzer, focused tests and backend compiler failures before changes. Never count previous handoff results as reruns.
- [ ] Commit the source-reconciliation inventory and relevant composed changes after their focused checks; do not wholesale merge integration/rebuild.

## Task 2: Shared headers, navigation and auth alignment

**Files:** Modify `apps/mobile/lib/src/theme/masanawa_theme.dart`, `ui/components/masanawa_wordmark.dart`, `screens/onboarding/{phone_login,password,otp,name}_screen.dart`; create `ui/components/masanawa_main_header.dart`, `ui/components/conversation_search_field.dart`; modify the selected shell and main screen headers only under acquired claims.

**Interfaces:** Produce `masanawaMainHeader(BuildContext context, {List<Widget> actions = const [], PreferredSizeWidget? bottom}) -> AppBar`; `ConversationSearchField({required TextEditingController controller, required String hintText, required ValueChanged<String> onChanged, required VoidCallback onClear})`.

- [ ] Add widget cases asserting centered LanguagePickerButton geometry on all four routes at 320/390px and RTL; keep accessible icon semantics.
- [ ] Add header/navigation cases for white surface, brandStrong wordmark, 24px target typography, charcoal unselected icons/labels, bright-green selected icons and near-black heavier selected labels. Include narrow/large-text action overflow.
- [ ] Run the focused cases to confirm the current mismatch, then implement shared presentation without altering auth or tab routing.
- [ ] Center each existing language-picker wrapper; use the shared header in main destinations and preserve detail back buttons. Remove Chats' green override and recolor its activity/offline strip consistently.
- [ ] Verify existing `test/onboarding_scaffold_test.dart`, `test/localization/language_picker_button_test.dart`, root-shell compatibility tests and new presentation cases; commit the shared refinements.

## Task 3: Complete Chats search using existing inbox infrastructure

**Files:** Adopt/reconcile integration `apps/mobile/lib/src/features/masana_chat/masana_chats_list_screen.dart` and `masana_chats_list_api.dart` with the selected shell; modify main `screens/chat/chat_list_screen.dart` only if it remains the mounted list. Test `apps/mobile/test/features/masana_chat/masana_chats_list_test.dart` from the existing feature and focused search cases.

**Interfaces:** Consume the existing authenticated `MasanaInboxAccess.load(accountId, query: ...)` and shared ConversationSearchField; preserve existing onOpen/read/pin/cache behavior.

- [ ] Test partial-name/title/available-identifier matching, trimming/case handling, no matches, clear, pins/order, offline projection and actual row-opening callback.
- [ ] Test query A response arriving after typing B but before B debounce starts; invalidate old generation immediately on input and prevent stale updates. Test clear and account switch similarly.
- [ ] Verify which identifiers the server actually supports; extend its existing query within the same authorized inbox reader if needed, without creating a second search service.
- [ ] Reuse shared field and existing 350ms server debounce with immediate safe local filtering; distinguish loading/denied/offline/no conversations/no matches.
- [ ] Run the feature's existing API/widget/backend search cases and analyzer for affected paths, then commit. Do not advertise group messaging search if that resource is unsupported.

## Task 4: Search complete call history without losing Calls functionality

**Files:** Modify `apps/mobile/lib/src/screens/calls/calls_screen.dart`, `apps/mobile/lib/src/calls/call_history.dart`, `services/gateway/src/call_history/service.ts` and `postgres_repository.ts` only after narrow ownership allocation; extend existing call-history tests and `apps/mobile/test/calls_screen_test.dart`.

**Interfaces:** Extend the existing paginated history API with an optional bounded query while retaining backward compatibility; keep actor identity derived from existing authenticated session. The exact cursor format must be extended inside the existing history contract, not invented by a parallel service.

- [ ] Inspect existing cursor codec and route parser before defining query/cursor changes. Add tests for empty query compatibility, name/state/identifier match on later pages, malformed/overlength query, query/cursor mismatch and cross-account denial.
- [ ] Run focused backend cases to show missing behavior, then add parameterized bounded matching and query-scoped pagination in the existing reader.
- [ ] Add shared search field with generation cancellation and account/token fencing, clear, no-results and preserved load-more/retry. Keep native lifecycle reporting, group calls, incoming/missed indicators and existing row navigation.
- [ ] Verify call revision refresh retains the query and stale requests cannot overwrite newer results; run existing Calls/incoming/group test coverage and focused history backend tests.
- [ ] Commit only after focused tests pass; report UI-only loaded-page search as partial if the backend change is blocked.

## Task 5: Replace legacy Status with the connected Masana feed

**Files:** Existing integration `apps/mobile/lib/src/features/home_feed/{feed_screen,feed_api,feed_media_api,feed_media_screen}.dart`, selected shell/router and corresponding feature/shell tests. Existing Gateway home-feed composition stays with AF00/media owner.

**Interfaces:** Reuse per-account `DioFeedApi` and `DioFeedMediaApi`, feed profile/detail/media callbacks and current authorization. No new publisher or Talk resource alias.

- [ ] Verify composed feed route/migration/runtime registration, then qualify authenticated list/detail/media responses against a disposable backend; distinguish source wiring from actual environment availability.
- [ ] Add widget cases for populated/loading/empty/offline/denied feed, compact author/timestamp layout, profile/media/detail opening and account-switch stale-response clearing.
- [ ] Remove old TalkHomeScreen mounting and unsupported New status /talk/create action from the selected shell. Apply shared white header and flat compact update presentation while retaining AI labels, follow/discover and supported interactions.
- [ ] Inspect real read-state support before adding recent/viewed sections; implement honest account-scoped viewed state or omit that section. Do not imply 24-hour expiry or user publishing.
- [ ] Preserve Status-media branch source and permission checks; integrate image binding through its existing owner only. Report unavailable image/audio object configuration distinctly.
- [ ] Run feed, media, shell and authenticated Gateway cases; commit the connected Status refinement.

## Task 6: Connect persistent Rooms and truthful state handling

**Files:** Existing Rooms branch `apps/mobile/lib/src/features/rooms/*`, `packages/rooms`, `adapters/storage/postgres/src/rooms`, `services/gateway/src/modules/rooms`, existing feature tests. Modify selected shell/router/registries only through AF00 transfer.

**Interfaces:** Reuse existing authenticated RoomsClient/membership/subscription/bookmark APIs and canonical Room IDs/entitlements; no legacy Talk-feed substitution.

- [ ] Reproduce main's legacy /talks missing-route-to-empty behavior in a transport test and integration shell's unavailable gate in a widget test; verify runtime backend capability before diagnosing genuine empty data.
- [ ] Recover the feature-local Rooms source and exact membership tests; review dependency/public export/migration order without overwriting unrelated branch fixes.
- [ ] Wire canonical Room discovery/joined/detail flows with account fences; register existing route factories and persistence through the shared integrator. Keep paid access gated by real verification.
- [ ] Add missing/unavailable backend, no published Rooms, no search matches, loading, denied, failure/retry and joined/populated cases. Offer supported Discover/Join; no invented Create or content.
- [ ] Test invite redemption, revocation, account switch, authorization, saved lessons and paid access using existing domain tests and disposable PostgreSQL 18. Preserve financial records and applied SQL.
- [ ] Run `flutter test test/features/rooms` and existing scoped backend suites on the combined SHA; commit connected source and list any unconfigured runtime/Play/live-audio dependencies.

## Task 7: Wallet/Crypto presentation and existing journey consistency

**Files:** `apps/mobile/lib/src/screens/wallet/wallet_screen.dart`, `send_credits_sheet.dart`, `wallet_receipt_sheet.dart`, `finance/crypto_wallet_screen.dart`, relevant billing/receipt presentation, selected shell callbacks; existing wallet/crypto widget tests.

**Interfaces:** Keep existing WalletView/CryptoWalletSnapshot, providers and capability flags unchanged for presentation. Reuse supported quote/review/execute/status operations; no new ledger or unit mapping.

- [ ] Map all mounted wallet callbacks and real provider capabilities. Inspect the existing MSN branch/financial contract with AF01; keep legacy denomination truthful until validated integration, and track missing Send/funding wiring as functional work.
- [ ] Add widget cases for balance unavailable versus zero, long exact amounts, unsupported asset/network/action, error recovery and retained billing/crypto access during balance failure.
- [ ] Replace bordered balance cards/gradient/tile grid with white balance area, compact supported actions, actual asset rows and flat transaction list. Display selected-route balance only unless the server supplies additional holdings/value data.
- [ ] Retain exact recipient/network/amount/fee/quote-expiry and authorization details in existing send/deposit/convert/withdraw/review sheets and receipts. Do not show success before server confirmation; preserve checkout and uncertain-operation status refresh.
- [ ] Check keyboard/large-text/narrow-width layouts and back behavior throughout the journey; include double-tap/in-flight action and quote-expiry tests using existing transports.
- [ ] Run existing `test/crypto_wallet_test.dart`, `test/wallet_receipts_test.dart`, `test/wallet_service_shortcuts_test.dart`, wallet transport/model tests and focused new cases; commit visual changes separately from any AF01-approved financial integration.

## Task 8: Combined verification and implementation report

**Files:** Tests above, existing app/backend suites and one concise final workstream report.

- [ ] Run `flutter analyze`, affected Flutter tests, then `flutter test` on the composed source. Record baseline unrelated failures separately and fix introduced regressions.
- [ ] Run pinned `pnpm install --frozen-lockfile`, affected backend tests, `pnpm typecheck`, `pnpm build` and relevant real PostgreSQL tests when backend/Rooms/Status composition changed. No skipped test counts as pass.
- [ ] Build a development APK using `flutter build apk --debug`; render/review real screens at 320/360/390/430px, large text and RTL. If SDK/render tooling is unavailable, mark those checks blocked explicitly and obtain the toolchain before visual completion claims.
- [ ] Verify tab switching, origin-aware Back, incoming-call/deep links, account changes, search clear/pagination and every supported wallet action under simulated errors and qualified staging services.
- [ ] Re-fetch main/claims before source integration; review conflicts and preserve newer windows' commits. Follow current development merge policy, not superseded integration-only freezes; signed distribution/provider activation remains separately qualified.
- [ ] Report discovered issues, actual changed paths, search semantics, wallet approach, Rooms/wallet dependencies, exact SHA and executed checks. Use PLANNED/PARTIAL_IMPLEMENTATION/IMPLEMENTED_UNVERIFIED/VERIFIED_E2E honestly.

## Plan review performed

All requested areas map to tasks 2–8. Branch conflict/source recovery precedes integration. Additional refinements stay within accessibility, state correctness and existing journey polish. No feature is declared complete by this plan. Task 4 and task 7 deliberately require inspecting existing domain contracts before changing them; code-level financial/cursor decisions cannot be safely fabricated from presentation requirements alone.

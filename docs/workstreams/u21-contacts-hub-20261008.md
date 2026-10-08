# U21 — Contacts Hub / New Message (2026-10-08)

**Status: PARTIAL_IMPLEMENTATION; DRAFT, UNMERGED, NOT DEPLOYED, NOT VERIFIED_E2E.**

## Source identity / claim
- Owner: U21 GPT-6 isolated contacts-presentation window, five-minute exclusive path claim.
- Base `main`: `5e758673ae91082520b21b3153da53791ae2cbf3` (2026-10-08 16:35 UTC).
- Branch: `work/u21-human-contacts-hub-20261008-gpt6`.
- Feature source checkpoint: `a83d3ac3d2907af2263ed6a12acbccd9a712f3a9`; final branch HEAD is recorded in the draft PR (the handoff commit changes it).
- Protected files: `apps/mobile/lib/src/contact_hub/human_contact_hub_screen.dart`, `apps/mobile/lib/src/contact_hub/contact_hub_favorites.dart`, `apps/mobile/test/contact_hub_screen_test.dart`, this handoff.
- Open PR inventory checked: 60 open including contacts C01 #468, DM C02 #472 and competing #475, shell #493, Work #497, Firebase #461. No pre-existing U21 branch was found in targeted branch search at claim time. Do not override newer claims.

## Substantive implementation shipped on this draft branch
- Compact nested Human Contacts screen for the final **Chats → New message → Contacts** flow, never a sixth tab and never Expert/Twin/AI DM.
- Uses **C01's existing HumanContact / HumanContactsController / humanContactsProvider** and server-backed exact-handle find/request, revision-checked accept/decline, withdraw/revoke and refresh. Does **not** implement an alternate contacts REST service or table.
- Accepted contacts shown independently of DM history; sorted sections for Favorites, Masanawa contacts, incoming/sent/previous requests; local filter, accessible labels, loading/error/readback notices, avatar fallback and HTTPS avatar display, pull-to-refresh and truthful limited-result notice.
- **C02's real HumanDmTransport.open(userId)** is used to resolve an authorized conversation; opens at most one in-flight request and hands a canonical conversation ID to the F12 route callback. C02 must independently enforce tenant, membership, blocked contact, privacy on each operation. No phone number or persona ID is ever supplied.
- Favorites: actual `flutter_secure_storage` backed account-specific opaque human ID set, max 500 and bounded decoded format, cleared from view upon logout/account changes; `clear(ownerId)` exists for R12 deletion composition. Never saves phonebook numbers, private messages, AI context or raw contact response.
- Lifecycle fences discard late C02 response after account switch, present an identity-transition placeholder until stale search/handle text is wiped, serialize favorites writes, avoid showing old account favorites, and prevent duplicate navigation for double tap. Lazy sliver row construction; no imagined paginated server responses.
- Added **10 widget tests** for accepted contacts without prior DM, revoked request state, C02 deny/double tap, exact-handle vs local search, favorite persistence/restart, logout, cross-account filter/handle clearing, and late account-switch responses, plus capped-limit assertion with 10k source fixture. These tests are **authored, not run**.

## Required upstream dependencies; why this cannot build as a standalone main checkout yet
- `main` does **not** contain C01's `apps/mobile/lib/src/messages/human_contacts_*.dart` or C02's `apps/mobile/lib/src/human_messages/human_dm_transport.dart`. The new U21 screen imports these **actual draft modules** rather than copying their implementations. They must be composed into an integration checkout before Dart compilation. This U21 draft deliberately does not cherry-pick either entire PR or pretend standalone compilation passes.
- F14/C01 #468: server/admission migration 0016, C01 service and API composition; **its list() has no cursor and caps at 100** (controller currently loads 50). Server-authorized keyset pagination and readback/blocked filtering are required before 10k contacts acceptance; U21 does not fabricate a cursor endpoint or issue unbounded requests.
- F15/C02 #472: migration 0017 after 0016, real C02 open/message routes, auth/data authority. Do not merge competing #475's 0017. A genuine C02 destination screen and secure composition are needed for full K13/K15.
- F12/R17/C08 #493/Work #497: one five-tab root, add **one** Chats New message button and nested `/messages/contacts` route. Pass `GatewayHumanDmTransport(api)` and route callback to `/messages/:conversationId`; preserve old `/chats` AI meaning and back/draft/scroll history. F12 alone owns global router and tab shell.
- F13/R18 #435: current profile/avatar URL refresh/revocation; optional person profile callback after verified profile route. U22/U23: device phonebook consent and share invitations; intentionally not advertised here since unavailable on main. F08/U24: account blocks and request safety integration.
- R12: call `SecureContactHubFavoritesStore.clear(ownerId)` upon actual account deletion; signout hides favorites immediately without destroying the user's saved on-device preference.
- C01 accepted list currently maps `canMessage=false` except exact lookup. U21 uses accepted relationship for presentation while C02 independently reauthorizes the actual open and send. If C01 introduces an explicit denied/blocked row, adapt the U21 safe eligibility rule before merge.

## Executed evidence vs missing evidence
- Completed: read latest repo instructions and source, current open PRs, C01/C02 Flutter API contracts; created branch, exact-path claim, code and regression tests; direct GitHub fetch/update checks only.
- **NOT EXECUTED:** Flutter/Dart analyzer, widget tests, mobile build, Postgres migrations/auth integration, CI, device tests, test A/B accounts, performance trace. Local execution environment had `git`, but **neither Flutter nor Dart SDK**. GitHub hosted CI incident #457 exhausts runner capacity; do not interpret zero-step runs as test failures or success.
- No DB/provider/financial/API schema/Firebase/production/native route modifications made. No credentials used, no release marked DONE. Unverified status remains **PARTIAL_IMPLEMENTATION** because dependency composition, backend pagination and device verification remain unfinished.

## Exact integration/acceptance procedure for ChatGPT Work
1. Fetch HEAD of this branch and compare to latest `main`. Before writing shared files, inspect new five-minute claims and PR SHAs. Choose C01 #468 once and C02 #472 as canonical; preserve unique code from #475 without duplicate migration. Preserve Firebase #461 and Work #497.
2. In an isolated composite checkout, integrate C01, C02 and this U21 module with migration dependency order 0016→0017 and actual Gateway app/main registration; run auth-negative service/route tests with real disposable DB.
3. Under **F12 exclusive router claim**, mount Contacts in Chats New Message without adding a tab. Construct `GatewayHumanDmTransport` from existing `apiClientProvider`, supply navigation callback for typed human thread route; inject no developer token or fake user identity. Test legacy deep links and back-stack/draft preservation.
4. Implement server-backed keyset pagination in F14's canonical C01 API and controller with stable sort/search + current authenticated consent/rate/tenant policy, then update U21 view to request subsequent pages. Do not send 10k all at once. Validate same account vs wrong account, revoked/blocked/hidden/deleted and duplicate taps.
5. With Flutter installed run:
   ```sh
   cd apps/mobile
   flutter pub get
   flutter analyze
   flutter test test/contact_hub_screen_test.dart
   flutter test test/human_contacts_controller_test.dart test/human_contacts_screen_test.dart test/human_contacts_transport_test.dart
   flutter test test/human_messages_thread_test.dart
   ```
   Also run Gateway C01/C02 Vitest and real PostgreSQL migration/service/race suites; physical Android test with users A/B and unauthorized C, restart/account switch, offline/reconnect, 10k paginated list and screen reader/large font. Confirm no phonebook permission prompt is required for K13.
6. Verify C02 open is deterministic and policy-fenced at the server even if contacts list stale, then check eventual send/revoke/blocked readback. Confirm deleted-account favorites local purge through R12. Recheck Firebase, CI #457 and five-tab release gates. **Only genuinely verified, reviewable source may be merged**; no deployment until complete release authorization.

## Remaining U21 acceptance (explicitly NOT done)
- Live keyset pagination, F14 extension + cross-account authoritative revocation.
- Full C02 actual conversation screen, app router and profile actions.
- True device A↔B contact acceptance + messaging, Android low-memory and 10k paginated performance measurements, accessibility/localization/RTL, conflict handling and offline safe-cache policy.
- Authenticated end-to-end negative tests, FCM/blocked media revocation and full K13/K15/K16/K18/K20.

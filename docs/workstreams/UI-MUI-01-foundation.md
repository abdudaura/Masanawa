# MUI-01 — shared main presentation

## Identity and current state

- Lead: AF00; exact-path claim `af00-mui01-presentation-20261012` on `factory/claims` (acquired `e4cc650e9`).
- Base: `0053e8d4e1b0282ed05e407871edff62d365a9c9`.
- Branch: `lane/af00-mui01-presentation-20261012`; delivered source `3076b26056e6c1ad4e3958f1126e193198409b76` (initial implementation `aadd1f180`, reviewed separator correction `3076b2605`).
- Source PR: [#678](https://github.com/weavewellindustrieslimited/masanawa/pull/678). Implementation: **PARTIAL_IMPLEMENTATION — source complete, main integration pending**. Verification: **PASS_SIMULATED** for shared presentation, widgets and rendered layouts; broader failures separately below. Release: **NOT_RELEASED**.
- No live overlapping lease existed. Historical AF00 root claims and integration/Rooms/Status refs were inspected and preserved. Main's Calls source is canonical: the older integration version removes 325 current Calls lines and its theme drops current chat tokens; neither was adopted.
- Changed exact paths:
  - `apps/mobile/lib/src/theme/masanawa_theme.dart`
  - `apps/mobile/lib/src/ui/components/{masanawa_wordmark,masanawa_main_header,conversation_search_field}.dart`
  - `apps/mobile/lib/src/screens/{chat/chat_list_screen,calls/calls_screen,rooms/rooms_screen}.dart`
  - `apps/mobile/lib/src/shell/five_tab_shell.dart`
  - `apps/mobile/test/ui/mui01_presentation_test.dart`
  - This handoff. No router, auth, domain financial, backend, migration, manifest, lockfile, token or CI changes.

## Delivered behavior and acceptance

- **Closed, source/widget/rendered:** white main headers on Chats, Status, Wallet, Calls and Rooms. Status/Wallet use the shell header; Chats/Calls/Rooms mount the shared factory. Detail routes retain their descriptive titles/back behavior. Existing root routes, default Chats, tab order, lazy mounting and callbacks are retained.
- **Closed, source/widget/rendered:** readable `brandStrong` wordmark, 24px/700 with balanced spacing, existing Agents lockup retained; directional suffix spacing. Light-on-brand explicit variants remain supported.
- **Closed, source/widget/rendered:** white bottom navigation, charcoal default icons/labels, bright-green selected icons, near-black selected labels (700 versus 600), 24px icons/12px label target, subtle top separator. Fresh reviewer found the initial separator covered by the bar; a real rendered-pixel test failed on white and passed after foreground painting.
- **Closed, source/widget/rendered:** header secondary actions move into localized Material overflow when room is insufficient; callbacks, tooltip labels and disabled states are retained. Tests cover 320/360/390/430px, both text directions, 2× text, and opening an overflow action. The wordmark scales down only when needed to fit the available toolbar.
- **Closed, component:** compact shared `ConversationSearchField` with 16px side inset, neutral fill, no heavy border/shadow, single-line input, search icon and accessible clear target. Typing, programmatic controller changes and clear are tested. Controller/query/debounce/account fencing remain caller-owned. Optional `clearTooltip` permits contextual localized copy; default uses Material's localized delete tooltip for clearing text. **This is not functioning Chats/Calls search:** mounting and authorized complete-history query acceptance remain MUI-03/MUI-05.
- **Closed, scoped layout:** Chats' activity/offline strip measures scaled wrapping text instead of reserving a fixed 38px; its empty state scrolls at narrow width/large text. A mounted 320px/2× test first reproduced strip and empty-state overflows, then passed after correction.
- **Open, separate integration qualification:** populated/localized whole-app journeys, keyboard/account switching through each domain, qualified live services and installed signed devices belong MUI-09/MUI-10. Shared source and simulated renders do not prove those journeys or release readiness.

Existing native/group/incoming/history/billing Calls, authentication and financial authorization remain intact. Status still mounts the legacy Talk surface and Rooms still reads the legacy live feed: those deficiencies are explicitly **open MUI-04/MUI-06**, not repaired or certified by white headers. The legacy Status composer/Rooms copy is preserved for those owners to remove selectively. No fake domain data or money/unit relabel was added.

## Executed checks

Toolchain provisioned in this window: Flutter 3.47.7 (`abaf9c5237`), Dart 3.13.5. SDK-generated analyzer/solver changes were removed; submitted lockfiles and analysis policy remain unchanged.

Commands below ran on the delivered source tree (doc commits do not change it):

- `flutter test --no-pub test/ui/mui01_presentation_test.dart test/masanawa_light_theme_test.dart test/calls_screen_test.dart test/app_shell_route_compatibility_test.dart test/onboarding_scaffold_test.dart test/localization/language_picker_button_test.dart test/localization/root_shell_localization_test.dart`: **39 passed**, including 13 presentation cases; Calls history/pagination/retry/account fencing and auth locale persistence/accessibility preserved.
- `dart analyze lib/src/ui/components/masanawa_main_header.dart lib/src/ui/components/conversation_search_field.dart lib/src/ui/components/masanawa_wordmark.dart test/ui/mui01_presentation_test.dart`: **PASS, no issues**.
- `flutter analyze --no-pub`: **FAIL, 329 existing diagnostics**, same count as separately executed fresh main; no compiler errors or new diagnostics. Existing warnings include router unnecessary casts, own-profile transport unused import and three test imports/unused parameter. No analyzer rules were disabled.
- `flutter test --no-pub`: **FAIL, 454 passed / 9 failed** on delivered `3076b2605`; all nine failures separately reproduced on fresh main `0053e8d4e`:
  - `agent_directory_readiness_test.dart`: malformed presence does not crash the whole agent directory (expects offline, current authority returns unknown).
  - `agent_recovery_test.dart`: directory keeps roster on transient failure and clears it on 401.
  - `talk_screen_test.dart`: listener opens Sponsor Seat sheet from Add AI; host opens direct Add AI semantics.
  - `wallet_service_shortcuts_test.dart`: service entry survives a wallet balance outage.
  - `edit_profile_screen_test.dart`: missing profile offers real first-time creation; unsaved or invalid updates cannot be submitted; saved public profile survives leaving and reopening editor; failed save keeps previous server state for recovery.
- `flutter test --no-pub /tmp/mui01_render_test.dart`: **PASS** in a temporary Flutter raster harness with real Roboto/Material fonts. Reviewed actual PNGs at 320/360/390/430px (1×/2× text), all five mounted tab headers at 390px and RTL shared search at 390px. Artifacts: `/tmp/mui01-renders/`; test doubles supply signed-out/offline/empty states. These are real rendered widgets, **not live-backend or device evidence**. Some domain-specific text styles in the Wallet fixture retain the test font; only its main header/nav are visual acceptance here.
- `flutter build apk --debug --no-pub`: **BLOCKED — no Android SDK**. No signed artifact, emulator, installed phone or provider was qualified.
- Fresh-context branch review: no Critical/Important findings; only the separator finding, corrected with a red→green pixel regression. Calls changes are limited to its header import/factory. Domain search, Rooms availability and financial review focus remain with their later milestones.
- `git diff --check`: PASS. Source diff, preservation and handoff links reviewed.

Remote CI on initial source: Foundation run `38255985545` fails unchanged `packages/agents/src/talk-replay.test.ts:6` TS2459 (`TalkId` not exported); exact-base main run `38252934521` has the same error. Mobile run `38255985749` fails on existing analyzer diagnostics. Vercel reports a build rate limit. Checks/branch protections remain intact; no admin bypass, rule suppression or deployment claim. Final PR checks remain visible in #678.

## Remaining work and blockers

- **MUI-02 / AF08 next:** center the existing LanguagePickerButton on all supported auth/welcome routes, including the four named phone/password/OTP/name routes; retain locale persistence, accessibility and auth behavior. Confirm exact mounted routes and available ownership before editing.
- **MUI-03…08:** retain all queue acceptance. Existing server-authorized Chats/Calls searches, Status/feed/media and persistent Rooms reconciliation, truthful Wallet/MSN contract wiring and Crypto/receipt journeys remain their respective owners' work. Reuse the shared header/search API; do not treat this component as a search implementation.
- **MUI-09:** combined populated/mobile/large-text/RTL/keyboard/navigation/account switching and real service checks; record the nine baseline failures and analyzer/backend CI failures for their owners. Do not disable tests or require unrelated fixes to block compatible UI delivery.
- **MUI-10 / release owner and AF11:** Android SDK/signing/distribution/device runner needed for exact source→artifact→installed build identity. Native/group/incoming call and real provider qualification remains open alongside the audit.

Ruling: preserve the current shell rather than adopting older integration ancestry, because that would remove Calls and current chat tokens. Cost: Status/Rooms domain corrections remain explicitly queued. The minor separator was fixed because it is part of the supplied design, not an extra cosmetic task. No deferred review finding remains.

## Next continuation prompt

```text
Continue weavewellindustrieslimited/masanawa from fresh origin/main.
Read AGENTS.md, CONTINUE-HERE.md,
docs/workstreams/UI-CONTINUATION-QUEUE-20261012.md and
docs/workstreams/UI-NEXT-WINDOW-PROMPT-20261012.md.
Read predecessor docs/workstreams/UI-MUI-01-foundation.md:
MUI-01 source 3076b26056e6c1ad4e3958f1126e193198409b76, PR #678.
Verify its current merged evidence; do not redo shared presentation.

Prefer MUI-02 / AF08: center the existing language selector across supported
mounted auth/welcome routes at 320/390px and RTL, preserving persistence,
accessible icon labels and authentication. Inspect its handoff if present,
relevant Task 2/design requirements, fresh PR heads and factory/claims.
Claim exact paths; if it is completed/owned, select the next ready unclaimed
milestone from the retained queue. MUI-03 can consume MUI-01's shared search.

Preserve Chats · Status · Wallet · Calls · Rooms, Chats launch default,
Masana-only contacts, and native/group/history/billing/incoming Calls.
Preserve other windows' Status/media, persistent Rooms, auth and financial
source. No historical wholesale shell merge, fake records/valuations,
second ledger, Cr→MSN relabel, unsupported Status publishing or Create Room.

Implement/test/review/commit/push and merge compatible source to main under
current policy, with exact-path ownership and relevant executable checks.
Retain MUI-03…08 search/feed/Rooms/wallet/crypto acceptance, MUI-09 combined
mobile/keyboard/large-text/RTL/account regression and MUI-10 signed installed
app/source identity. Preserve ongoing AF11 signed incoming-call/provider
qualification. Nine baseline Flutter failures, 329 analyzer diagnostics and
backend CI TalkId export failure are documented, not passed or disabled.
Android SDK/device/signing/provider qualification remains open; source,
simulated renders and installed/release evidence must stay separate.

Update docs/workstreams/UI-MUI-02-auth-language.md (or the selected milestone's
own handoff) with base/source/main SHAs, PR, paths, actual commands/results,
all open acceptance and smallest next action. Release ownership and print
the next queue-aware continuation prompt directly for the owner.
```

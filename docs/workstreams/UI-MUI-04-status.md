# MUI-04 / AF00 — mounted authenticated Masana-only Status

## 2026-10-13 implementation and source lineage

Starting main `5eec953bae1b7dacc000fa55fb45c86f7a04d180`, containing merged MUI-06 #697. AF00 bounded composition on branch `lane/af00-mui04-masana-status-20261013`; exact-path claim `af00-mui04-status-composition-20261013` registry `632a76bb0b2dff260bff06310ea88dd1fbd8e53d`. Prior explicitly released Feed/J06, C22/C23/C25 and Status paths moved to history, retaining all source evidence.

Recovered feature-local authenticated Masana Feed, replies, post detail and authorized media components from source tree `d924a42203f06bce354c03aa20983100f77693f1` in #674 at `523b1511ebff58ce10d5e90cb2478680970e0d2b`. Did **not** copy the old five-tab shell or overwrite current native/group/incoming Calls, Chats/Wallet or Rooms. Excluded Saved Library source because its `../videos/video_models.dart` prerequisite is not on main; original C25 preserved in #674. Retained image-only media viewer through server-issued short-lived HTTPS authorization; disabled unqualified audio playback pending AF05 audio focus/media contract. No user Status creation or legacy `/talk/create` FAB.

Mounted `StatusScreen` in the existing `FiveTabShell` Status slot. Status uses the existing signed-in `ApiClient` Dio; account-scoped feed operations fence results/mutations before and after operations, and owner-keyed widget state clears on identity replacement. Media viewer rechecks signed-in account on its route. Backend decides Masana-only publication, visibility, reactions and media grants. Added date rendering from supplied `publishedAt` (not invented viewed/expiry) and distinguished a failed feed from truly empty Status. Preserved following/for-you, like/save/comment, pagination, retries and post detail. Author profile route and reporting remain unmounted until canonical current-route contracts are verified; no dead/guessed action is activated.

**Source is not complete Status acceptance**: #674's Gateway feed/editorial/PostgreSQL registration and media binding remain outside main, requiring AF00 protected backend migration/auth coordination; current Gateway may respond 404. Full Urdu/Arabic/Hausa localization, audio playback/author-profile/report, real account/device/provider authorization, signed APK, and AF08 shared mutable ApiClient 401-refresh request isolation remain OPEN.

## Verification

Recovered existing feed/post detail/media widget tests and authored mounted Status tests: actual tab, no user publish action, timestamp, retry distinction and delayed account-switch response. Flutter/Dart and Android SDK were unavailable in this execution environment: test and analyzer **NOT_RUN**, do not count historical Status #674 tests as passing this SHA. Review diff/imports and run `cd apps/mobile && flutter pub get && flutter test test/status_screen_test.dart test/features/home_feed && dart analyze lib/src/screens/status/status_screen.dart lib/src/features/home_feed test/status_screen_test.dart test/features/home_feed`; validate Gateway/PG18 routes and two-account deny once AF00 routes composed.

## Next queue-aware prompt

```text
Continue weavewellindustrieslimited/masanawa from fresh origin/main,
reading AGENTS.md, CONTINUE-HERE.md, docs/MULTI-WINDOW-WORK.md,
docs/workstreams/UI-CONTINUATION-QUEUE-20261012.md,
docs/workstreams/UI-MUI-04-status.md and UI-MUI-06-rooms.md.
Inspect latest Software Factory rules, open PR heads, exact claims.

Main includes MUI-06 #697 at 5eec953bae1b7dacc000fa55fb45c86f7a04d180;
inspect updated main for exact MUI-04 Status merged SHA from handoff.
Source-first Status recovered authenticated Masana-only feed into current
five-tab shell; old new-status/Talk publish action removed. Flutter tests
authored, not run in connector-only environment. Preserve newer Calls/Rooms
and every other current feature.

Do substantial remaining work: AF00 protected authenticated Gateway/PG
composition from #674 (Status) and #625/#655 (Rooms), and C10 server-wide
Chats inbox from #641 coordinated with AF05 main.ts; or continue disjoint
AF01 MSN financial/wallet integration from #576 with explicit finance
authority. Do not invent financial state/media grants, publish retired
user-Talk content or create parallel auth, ledger or Rooms stores.
Fix introduced bugs, run available focused tests but do not stall merging
compatible source due old 317 analyzer diagnostics / 597-2 Talk tests /
TalkId TS2459 or unavailable Android/provider checks. Claim/review/commit/
merge scoped code to main normally; preserve explicit release gates.
```

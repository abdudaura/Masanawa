# AF00 — owner-confirmed five-tab root / MASANAWA-01

## Claim, branches and immutable source
- Owner/window: **MASANAWA-01 / AF00 root integrator**. Claim ID `masanawa01-af00-root-navigation-20261010-c`. Initial UTC claim `2026-10-10T01:25:37.990Z`; renewed through `factory/claims` at `853e70e3483b67bda8c0bb0411d902db22edc725` and independently read back.
- Canonical baseline: `main@f381f077c485c04261459b77a42c215d3ce3a14b`.
- Branch: `work/af00-root-navigation-20261010-masanawa01-c`.
- **Source/test checkpoint HEAD before this handoff**: `c185bf70e214215c092975c93ac6e16057dcb8c5`.
- PR: **#600** https://github.com/Baatiku/masanawa/pull/600 (draft; no integration merge or deploy).
- Contract authority: `CONTINUE-HERE.md`, `AGENTS.md`, `docs/AUDIO-FIRST-PRODUCT-20261009.md`, `docs/AUDIO-FIRST-SCREEN-SPECS.md`, `docs/AUDIO-FIRST-INTEGRATION-CONTRACTS.md`, `docs/AUDIO-FIRST-RECOVERY-20261009.md`, `docs/AUDIO-FIRST-WINDOW-PLAN-20261009.md`, `docs/MULTI-WINDOW-WORK.md`; current Factory skill v0.4.3.

## Exact owned and changed paths
- `apps/mobile/lib/src/screens/twin/shell_tab.dart`
- `apps/mobile/lib/src/screens/twin/twin_home_shell.dart`
- `apps/mobile/lib/src/router/app_router.dart`
- `apps/mobile/test/app_shell_route_compatibility_test.dart`
- `apps/mobile/test/twin_home_shell_test.dart`
- `apps/mobile/test/audio_first/af00/root_navigation_test.dart` (new)
- `apps/mobile/lib/l10n/app_en.arb`, `app_ha.arb`, `app_ar.arb`, `app_fr.arb`, `app_es.arb`, `app_pt.arb`
- This workstream record. No other paths modified.

## Connected source delivered
1. Root enum is **Chats · Rooms · Talks · Gwani · Wallet**, in that order, with Talks index 2 and `/home` as ordinary authenticated landing. Every explicit destination uses a semantic query key, not a recycled saved numeric index.
2. Historical private `tab=talk` resolves to private Gwani, not the public audio feed; old `home` stays public; `/chats` and `/messages` resolve to Chats. `create`, `activity`, `you`, `agents` retain separately typed destinations. All direct root aliases have registered GoRouter entries; detail `/chat/:id`, `/talk/:id`, `/twin/:publicId`, `/owner-session/:characterId/:requestId` remain intact.
3. Chats mounts the existing canonical-on-main `ChatListScreen`. Old standalone `/agents` uses the existing `AgentListScreen` instead of looping through a non-existent bottom Agents tab. Gwani reuses private agent chat and fails closed with Retry when there is no authorized support agent. Hidden Gwani pages are unmounted on tab switch, retaining microphone isolation.
4. Separate published-audio posts (AF09) and persistent Rooms (AF10) APIs are **absent from main**. Both centre Talks and Rooms show translated, honest unavailable states rather than presenting old live-Talk data as published posts or fake room conversations. Existing legacy live-Talk details and create paths are retained. This is not a completed audio-first experience.
5. EN/HA/AR/FR/ES/PT ARBs contain translated labels and pending states. Flutter localization generation is required before acceptance; generated localization files are not committed.

## Verification / acceptance
- **PASS — static source only:** 20/20 exact-blob GitHub readback + V8 assertions on tab semantics, widget structure, protected domain separation, six parseable translation catalogs; and another 15/15 checks after direct alias registration. These are static assertions, **not Dart analyzer or Flutter test execution**.
- **AUTHORED, NOT_RUN:** existing route + widget regressions rewritten; new AF00 Flutter test (five cases). No Flutter/Dart executable or Android SDK checkout available to this window; local GitHub DNS clone failed. No qualified device, APK, provider, backend or Postgres E2E proof.
- **CI BLOCKED, not code PASS:** GitHub Actions Foundation run `38013671783` and Mobile Build run `38013671820` on source checkpoint both concluded failure; job records expose no executed steps, so cannot establish a source test failure or success. Vercel commit status failed with `build-rate-limit`; no production build evidence.
- Release verification/status: **PARTIAL_IMPLEMENTATION**, not VERIFIED_E2E, not deployed. Maps to AF00 root navigation UX confirmed by owner and acceptance journeys for authenticated launch, tab order, historical route preservation, RTL, compact widths, and private mic isolation. No proof of full-device user journeys yet.

## Recovery/collisions and missing work
- Read open PR input #497 (150-window consolidation), #461 (Firebase), #552 (old five-tab static guard), #586 (AF00 deep-link authority) and previous five-tab #493. Do not overwrite or squash them. #586 owns its own `shell_deep_link.dart`/test, distinct from this claim. #497 contains useful human DM/Assistant implementation not merged; this branch intentionally avoids pretending those APIs are mainline.
- The owner's locally fixed Flutter source and previously built APK remain **unavailable** for comparative reconciliation. AF00 global recovery cannot be closed.
- **AF06** must compose authenticated human DM inbox/outbox and new-chat Masana & Contacts into Chats; **AF07** directory #593 remains draft. **AF09** must mount its real published audio post feed; **AF10** must mount real persistent Rooms; **AF04** supplies progressive Gwani service menus; **AF05/AF08** must qualify native audio and launch. AF00 may then replace pending states with exact-head verified modules after scope/claim coordination.
- No new migration, provider action, financial authority, runtime backend wiring or production deployment performed.

## Executable next gates
```sh
cd apps/mobile
flutter pub get
flutter gen-l10n
flutter analyze
flutter test test/app_shell_route_compatibility_test.dart test/twin_home_shell_test.dart test/audio_first/af00/root_navigation_test.dart
flutter test
flutter build apk --release
```
Then run on real low-end 320dp/RTL Android devices: signed-out login → Talks; old `tab=talk` → Gwani without auto mic; resume preserves selected tab; incoming deep links to person/Twin/AI/owner session retain authorization; nav and tab-switch state; signed-in account change; AF09/AF10 feeds after composition. Check provider/DB independently for dependent features.

Before any merge: inspect exact PR head, Flutter run results, collisions #497/#493/#586, generated locales, and **automatic production deployment triggers** (Foundation/Mobile Actions main pushes and any Vercel/Git integration); use a non-deploying integration branch if production may auto deploy. No source-only merge-to-production or release claims. Remaining work belongs to AF00 integration + respective named lanes. Handoff source anchor: `c185bf70e214215c092975c93ac6e16057dcb8c5`.

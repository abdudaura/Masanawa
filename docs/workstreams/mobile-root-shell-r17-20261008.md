# R17 approved root shell

- Owner: ChatGPT, R17 isolated lane.
- Branch: `work/r17-root-shell-20261008`.
- Base SHA: `265f2c5f6db81d076f57ca32dd47db3ff7fb0ad6`.
- Exact owned paths: `apps/mobile/lib/src/screens/twin/twin_home_shell.dart`, `apps/mobile/lib/src/screens/talks/talk_home_screen.dart`, `apps/mobile/lib/src/screens/wallet/wallet_screen.dart`, `apps/mobile/lib/src/screens/chat/ai_chat_screen.dart`, `apps/mobile/lib/src/router/app_router.dart`, `apps/mobile/test/twin_home_shell_test.dart`, `apps/mobile/test/wallet_service_shortcuts_test.dart`, `docs/workstreams/mobile-root-shell-r17-20261008.md`.
- Tasks: migrate root nav to Home / Agents / Wallet / Talk, move public Create to FAB, keep Activity and You accessible from header; preserve private Gwani and server-provided agent identities.
- Dependencies: R01 app-level theme PR #406, R11 app root localization PR #407. Do not touch main.dart/router or shared token files.
- Current step: new four-tab root shell, Activity/Profile header and public creation FAB implemented; Masanawa Agents list now exposes server roster except entries classified as Twins; Talk tab embeds existing private AiChatScreen for selected support agent and provides loading/retry. Remaining nested-header consolidation, full public Twins directory and voice-first finance handoffs.
- Implementation: PARTIAL at commits 94ac4ef90055ec63d95390330a84de8baab4d558 and 4416a48cff2e548e839cf7b611a2f39cb35e7126; verification: GitHub file readback only, Flutter analyzer/tests NOT RUN; deployed/device: NOT RUN.
- Last update: 2026-10-08.

## Expanded 2026-10-08 implementation boundary
- Latest open PR files checked: #406 Theme + main.dart, #407 Locale + main.dart/splash, #408 audio session, #409 settings/privacy, #410 Android signing, #412 agent directory contract. None modifies this expanded list.
- Correct nested headers in embedded surfaces; keep chat header contextual. Existing `/home?tab=create|activity|you` deep links must continue reaching their former intent without reinterpreting as new root tabs. Add targeted regression tests.
- Never modify PR #412 directory model or default persona provider here; platform/owned-Twin classification must use server-provided authorities, not guesses from role strings.

- Wallet shell surface amendment: expose only wired service shortcuts, using canonical current Billing category selection and ordered Crypto → Data → Airtime → Electricity → TV/Cable. This is route-level intent only; durable conversational task handoff remains dependent on R06/R07 and must not be misreported as delivered.

# R17 approved root shell

- Owner: ChatGPT, R17 isolated lane.
- Branch: `work/r17-root-shell-20261008`.
- Base SHA: `265f2c5f6db81d076f57ca32dd47db3ff7fb0ad6`.
- Exact owned paths: `apps/mobile/lib/src/screens/twin/twin_home_shell.dart`, `docs/workstreams/mobile-root-shell-r17-20261008.md`.
- Tasks: migrate root nav to Home / Agents / Wallet / Talk, move public Create to FAB, keep Activity and You accessible from header; preserve private Gwani and server-provided agent identities.
- Dependencies: R01 app-level theme PR #406, R11 app root localization PR #407. Do not touch main.dart/router or shared token files.
- Current step: new four-tab root shell, Activity/Profile header and public creation FAB implemented; Masanawa Agents list now exposes server roster except entries classified as Twins; Talk tab embeds existing private AiChatScreen for selected support agent and provides loading/retry. Remaining nested-header consolidation, full public Twins directory and voice-first finance handoffs.
- Implementation: PARTIAL at commits 94ac4ef90055ec63d95390330a84de8baab4d558 and 4416a48cff2e548e839cf7b611a2f39cb35e7126; verification: GitHub file readback only, Flutter analyzer/tests NOT RUN; deployed/device: NOT RUN.
- Last update: 2026-10-08.

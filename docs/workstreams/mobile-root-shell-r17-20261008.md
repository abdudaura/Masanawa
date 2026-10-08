# R17 approved root shell

- Owner: ChatGPT, R17 isolated lane.
- Branch: `work/r17-root-shell-20261008`.
- Base SHA: `265f2c5f6db81d076f57ca32dd47db3ff7fb0ad6`.
- Exact owned paths: `apps/mobile/lib/src/screens/twin/twin_home_shell.dart`, `docs/workstreams/mobile-root-shell-r17-20261008.md`.
- Tasks: migrate root nav to Home / Agents / Wallet / Talk, move public Create to FAB, keep Activity and You accessible from header; preserve private Gwani and server-provided agent identities.
- Dependencies: R01 app-level theme PR #406, R11 app root localization PR #407. Do not touch main.dart/router or shared token files.
- Current step: root nav/header/FAB and basic server-backed Masanawa Agent list committed; remaining full Twin directory, Talk voice workspace, header presentation, wallet intent handoff and integration tests.
- Implementation: PARTIAL at commit 94ac4ef90055ec63d95390330a84de8baab4d558; verification: GitHub file readback only, Flutter analyzer/tests NOT RUN; deployed/device: NOT RUN.
- Last update: 2026-10-08.

# Twin mobile production wiring — 2026-10-05

Owner/window: ChatGPT continuation after production/Twin convergence.
Branch: `work/twin-mobile-production-wiring-20261005`
Base: `e204b2e6ee3668e29827aac94f6cf67ac72f109d`

Tasks:
- TWIN-021 / TWIN-030 / TWIN-062 / TWIN-070 / TWIN-071 / TWIN-075 / TWIN-082

Owned paths:
- `apps/mobile/lib/src/state/my_twin_state.dart`
- `apps/mobile/lib/src/state/twin_directory_state.dart`
- `apps/mobile/lib/src/state/twin_activity_state.dart`
- `apps/mobile/lib/src/state/wallet_state.dart`
- `apps/mobile/lib/src/router/app_router.dart`
- `apps/mobile/lib/src/screens/twin/twin_home_shell.dart`
- `apps/mobile/test/twin_home_shell_test.dart`
- this claim file only

Scope:
- bind the already-implemented authenticated Gateway transports into the Twin state providers;
- make the signed-in root experience My Twin · Explore · Activity · Wallet;
- preserve direct chat, billing, crypto and settings routes;
- no Gateway app/main, persistence, migrations, Commerce internals, billing/crypto runtime or chat-screen edits.

Acceptance:
- signed-in legacy /home, /chats and /agents entry points land on the Twin-first shell;
- the four root tabs are reachable without reconstructing runtime internals;
- My Twin/Explore/Activity/Wallet use the production ApiClient rather than Unavailable transports;
- Wallet keeps Bills and Crypto as capabilities;
- Settings remains accessible from My Twin.

Implemented:
- My Twin, Explore, Activity and Wallet providers now use the authenticated production ApiClient transports;
- signed-in /home is the four-tab Twin shell;
- legacy /chats, /agents and /masana entry points converge on /home;
- direct /chat/:id, /billing, /crypto, /settings and /clone routes remain available;
- Wallet exposes Bills/Crypto and Send Credits without resurfacing Agent Float;
- focused widget coverage asserts the four-tab product model and absence of legacy runtime labels.

Verification pending:
- full Flutter compile/test on the external Android builder;
- backend Twin routes still require production Gateway composition before the screens return live data.

Status: implementation checkpoint complete pending integration.

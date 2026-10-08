# R03 — Default support agent preference authorization / readback
Updated UTC: 2026-10-08 11:55; owner: this window
Status: PARTIAL_IMPLEMENTATION (claim checkpoint; not release evidence).
Base main: 1d6a67ea3c182455b55a7d1d07eacdb4311682e3
Branch: work/r03-support-preference-authorization-20261008
Claimed paths: services/gateway/src/agent_directory.ts, services/gateway/src/agent_directory.test.ts; apps/mobile/lib/src/state/agent_directory_state.dart, apps/mobile/lib/src/screens/settings/settings_screen.dart, new corresponding tests and this handoff.
Scope: existing authenticated tenant-scoped default support agent selection and authoritative readback, no new persona seed or paid seat admission. Inspecting existing R03 bootstrap draft #441: it owns platform_agent_bootstrap*, main.ts, not these paths. Do not edit #441. Do not change shared root router, financial authority, migrations or CI. Five-minute repository-visible ownership lease with renewal via subsequent commits; stale claim is not right to overwrite committed source.
Required tests: TypeScript unit + Gateway route, Flutter state/widget, auth/tenant/hidden selection/response/readback/restart/account change. CI incident #457 blocks executable validation; to be recorded honestly at checkpoint.
Reference: R03, A09, N05, J06/J07; CONTINUE-HERE and FINAL-WINDOW-CONSOLIDATION-HANDOFF apply.

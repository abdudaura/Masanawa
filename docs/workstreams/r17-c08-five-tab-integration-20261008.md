# R17/C08 — five-tab shell integration claim and handoff

Status: PARTIAL_IMPLEMENTATION; OWNER: ChatGPT GPT-6, 2026-10-08; five-minute lease.
Base main: `1d6a67ea3c182455b55a7d1d07eacdb4311682e3`
Branch: `work/r17-c08-five-tab-shell-20261008-gpt6`
PR: pending first claim (draft only).

## Exact owned paths
- `apps/mobile/lib/src/screens/twin/shell_tab.dart`
- `apps/mobile/lib/src/screens/twin/twin_home_shell.dart`
- `apps/mobile/lib/src/router/app_router.dart`
- `apps/mobile/lib/src/core/shell_deep_link.dart`
- `apps/mobile/test/app_shell_route_compatibility_test.dart`
- `apps/mobile/test/twin_home_shell_test.dart`
- This handoff only.

## Dependencies and collision guard
R17/C08 owns shared root navigation. Existing #426 localization and #445 legacy R17 wallet routes are stale, not permission to overwrite their unrelated work. C07 #480 contains an **unmerged** standalone Assistant; C02 #472/#475 and C05 #474/#476 are conflicting unmerged DMs/cache, C01 #468 admission is unmerged; R18 #435 Gateway avatar changes are unmerged. The five-tab shell must never route a person DM through legacy AI `/chats` or fabricate messages. Shared Gateway, financial ledgers, DB migrations and CI #457 are excluded from this claim; prerequisite owners/final Work integrator must reconcile before activation.

## Requirement trace
N01–N08, M01/M02/M03/M08, A01/A02, W03, Q01/Q05, J01/J03/J04/J07/J08/J10/J11.

## Next
Implement target shell without mock financial/message state, add navigational regression tests and safe compatibility; if unmerged C02/C07 prevent a wired tab, mark missing code explicitly. No E2E claims before Flutter/Android and real API checks.

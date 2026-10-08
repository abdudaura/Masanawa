# Work integration and verification — 2026-10-08

Owner: current ChatGPT Work window, explicitly assigned by repository owner.
Base main: 1d6a67ea3c182455b55a7d1d07eacdb4311682e3
Branch: work/work-lane-consolidation-20261008
Status: PARTIAL_IMPLEMENTATION / verification recovery in progress; no merge or release acceptance.

Scope: recover immutable source into runnable terminal, execute backend verification, reconcile per-lane dependencies and duplicate branches, then qualify incremental integration. This claim initially owns only this coordination file; it does not reserve active feature files. Exact source paths must be freshly claimed before repairs. Existing feature branches and main are preserved. Five-minute leases apply; blocked CI does not keep another claim active.

## Snapshot and priority
1. Shared CI #457 / #460: recorded 2000/2000 hosted minutes, zero paid budget. No spending/settings changes authorized or made. Direct Git clone cannot obtain credentials. Connector source recovery underway. Node 24 available; Flutter absent. npm network probe succeeded; dependency installation being tested.
2. C01 #468 + R18 #435: contact identity/admission and avatar Gateway composition; 0015 then 0016 migration semantic review. C01 latest handoff reports its corrupted Dart transport repaired at 12:00 UTC; older #493 warning is stale until executable review proves otherwise.
3. C02 #472/#475, historical closed #477: elect one schema/API and transplant useful tests; no competing 0017 migrations applied.
4. C03 #473 -> #483 -> #486 are continuation/stacked work, not three independent implementations. C04 #478; C05 #474/#476 need a single reconciled cache/outbox.
5. C07 #480 then R17/C08 #493. Shell embeds #475 Flutter source and #480 adapter; selection must reconcile those identities and real server registration. #493 handoff at inspected SHA still says PR pending; incomplete checkpoint.
6. C06 #487/#490: choose one 0110 and financial authority; risk-policy, transaction-specific consent, recipient privacy, deletion and DM/Assistant integration remain open. No enablement or live money.
7. R15 persona reports #489/#491: #489 yields; #491 incorporated secure UUID and adds protected crash journal. Preserve unique tests, verify before disposition.

## Other current readiness PRs
R01 #442; R02 #439/#448/#449/#456; R03 #441/#495; R04 #433; R05 #440; R06 #438; R07 #447; R08 #444/#454; R09 #452/#459; R10 #471/#484; R11 #426/#482; R12 #430; R13 #453; R14 #436/#461; R15 #443/#446/#450/#451/#488/#494 plus reporting pair; R16 #455/#479/#485/#492; R17 #445/#493; R18 #435; R19 shares #448 and persona/live acceptance. These are inventory references, not claims of full lane coverage or verification. Exact source handoffs and current heads still need per-lane audit before closure.

## Evidence rules
No tests have passed in this Work window yet. Existing source is not DONE. No production data, provider credentials, deployment, billing or branch protection changes. Keep unverified PRs draft. Verification must record immutable source SHA, command/environment/result and unexecuted device/provider/DB gates. Completion means full applicable entry/action/auth/persistence/readback/recovery evidence, not PR closure.

## Next concrete action
Recover main backend/packages/config by immutable blob SHAs through the authenticated connector; install frozen dependencies; overlay C01 head in a separate source view and run targeted checks. Publish actual logs and narrowly scoped repairs, then proceed through the queue. Do not retry exhausted hosted CI.


## Executed verification and scoped baseline repair reuse — 2026-10-08T12:28:00Z
Recovered 835 immutable backend/workspace source files from main 1d6a67ea3c182455b55a7d1d07eacdb4311682e3, plus actual workflow/config/contract fixture files required by architecture tests. Node24.19.0 / pnpm12.8.2 frozen install succeeded. C01 9b63401 head plus scoped repair commits ending ee4e737: 21 Vitest tests passed, 3 PostgreSQL tests skipped; repaired routes/test assertions on #468. Main and repaired C01 Gateway typecheck both report the same 74 pre-existing errors, zero additional C01 errors. Initial baseline full Vitest 1177 passed,22 failed,143 skipped; 2 suite failures and 2 test failures came from missing recovered fixture files and are NOT repository regressions. Those fixture files have now been recovered.

Native embedded PostgreSQL18 binaries installed successfully, but this sandbox rejects chown (Invalid argument) and runuser (Operation not permitted); no DB server initialized or DB test pass. Flutter3.47.6 official checkout completed; SDK bootstrap in progress.

PR #460 has existing recoverable baseline repairs. Latest activity 07:31 UTC is stale; reuse its exact source patches rather than duplicate. Narrow additional claimed paths on THIS integration branch:
- `adapters/storage/postgres/src/identity/account-deletion-access.integration.test.ts`
- `packages/agents/src/talk-replay.test.ts`
- `packages/identity/src/account-deletion.test.ts`
- `services/gateway/src/customer_channel_twin_routing.test.ts`
- `services/gateway/src/main.test.ts`
- `services/gateway/src/strict_request_body.ts`
- `services/gateway/src/talk_gift_routes.ts`
- `services/gateway/src/talk_profile_routes.test.ts`
- `services/gateway/src/talk_profile_routes.ts`
- `services/gateway/src/talk_profiles/postgres_repository.test.ts`
- `services/gateway/src/talk_ranking/ranking.test.ts`
- `services/gateway/src/talk_safety/enforcement_integration.test.ts`
- `services/gateway/src/talk_safety/replay_bridge.test.ts`
All patches pass git apply --check against recovered current main. Existing feature owners' app.ts/main.ts, mobile, migrations, finance and domain repos remain untouched. This is recovery of #460's strict request validation and obsolete test fixtures, not a competing feature authority. Next execute affected suites, publish preserved patches/evidence, and leave draft while remaining baseline/Flutter/DB/provider gates are unresolved.

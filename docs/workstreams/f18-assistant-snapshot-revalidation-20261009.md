# F18 / C07 recovery: consistent Assistant history on role changes

**Status: PARTIAL_IMPLEMENTATION — draft PR #480, not merged/deployed, no end-to-end qualification.**

## Repository ownership and baselines

- F18/C07 continued on original PR [#480](https://github.com/Baatiku/masanawa/pull/480), branch `work/c07-assistant-workspace-20261008`, rather than creating another implementation of Gwani/Gwana workspace.
- Read `CONTINUE-HERE.md`, the 2026-10-08 U/F and re-audit instructions, `docs/MULTI-WINDOW-WORK.md`, `docs/contracts/ASSISTANT-WORKSPACE-C07.md` and previous F18 role-integrity handoff.
- Latest `main` inspected: `5e758673ae91082520b21b3153da53791ae2cbf3`. Existing #480 before the continuation: `45d699c51714f76c51eae0a46aa1b190b0a63605`. Source/test checkpoint for this continuation: `ba9bc55ed97fbb18e17d9826cbf5fb3f816bbbbb`.
- Fresh five-minute issue claim: [#573](https://github.com/Baatiku/masanawa/issues/573), later expanded in an issue comment to Flutter controller and test; each commit refreshes the time-limited claim. Exact owned paths:
  - `services/gateway/src/assistant_workspace/service.ts`
  - `services/gateway/src/assistant_workspace/service.test.ts`
  - `apps/mobile/lib/src/assistant_workspace/assistant_workspace_controller.dart`
  - `apps/mobile/test/assistant_workspace_controller_test.dart`
  - this handoff.
- Did **not** touch main, shared Gateway `app.ts`/`main.ts`, Flutter root shell/router, schema/migration registry, native Firebase, finance, production, branch deletion or merging.

## Actual defect and implementation

A slow combined history read could continue after a cross-device support persona switch, Character reassignment, or version change. A response could then attribute previously fetched history to stale role metadata. The Flutter controller had a related bug: it fetched IDs from one `roster` and after awaits labeled rows using the *current mutable* `roster`; overlapping refresh and persona switch increased this risk.

- Gateway `snapshot` now rereads the authenticated tenant/user-scoped directory **after** both canonical history calls and before materializing response rows. Rejects changed Gwani/Gwana Character IDs, Character version IDs, or selected role with a typed `assistant.workspace_changed` conflict. Removal/missing role and credential revocation are still denied by canonical `roles()`. This is a response-consistency check, not a serializable transaction or a cross-persona durable task claim.
- Flutter takes a frozen role→Character source before reads and uses *that same source* for labels, with an epoch fencing concurrent refresh/switch/logout. Rereads actual authenticated directory and checks both Character/version pairs and preferred role before publishing results. Confirmed invalid/revoked support mapping clears stale in-memory history, active selection and session bindings. Ordinary directory transport failure retains earlier history for retry without pretending it refreshed.
- Flutter now refuses a Gwani display name with a contradictory Sulafat voice (and vice versa), matching the earlier Gateway F18 identity guard, instead of silently assigning a conflicting persona.
- Existing protected request journal, canonical status/idempotency, account boundary, and server-supported role choices are untouched. No AI tool is granted authority to send DMs, settle gifts or approve money.

## Tests and evidence

| Check | Status | Evidence/limits |
|---|---|---|
| Actual source-extracted Gateway `snapshot` body executed in isolated JS against mocked `roles()` and `shell.history()` | **6/6 PASS_SIMULATED** | unchanged directory accepted; selected role changed, reassigned Character and version changed rejected; revoked role and expired authorization propagated. The transformed method removed only TypeScript's `as const` annotation. Not Vitest/Fastify/Postgres. |
| Gateway Vitest regression source | **AUTHORED / NOT RUN** | `service.test.ts` now has three `it.each` race cases and explicit directory-revocation negative case; fixture uses stable synthetic version IDs and switches roster after history starts |
| Flutter controller regression source | **AUTHORED / NOT RUN** | delayed history + Character remap, confirmed revocation vs offline retaining authorized cache, crossed name/voice, and in-flight refresh vs role switch. Changes reside in existing `assistant_workspace_controller_test.dart`. |
| `pnpm exec vitest run services/gateway/src/assistant_workspace/service.test.ts` | **NOT RUN** | No GitHub DNS checkout/dependency-resolved workspace available in local container |
| Flutter analyze/unit/widget on branch | **NOT RUN** | Flutter/Dart SDK unavailable in isolated tool container |
| Real Gateway/Postgres, provider, two devices, voice, CI | **NOT RUN** | No composed route, disposable DB/service credentials, connected devices; existing #457 Actions quota incident |

Source-body tests and static source review are **not** compiled Flutter/Vitest/real API evidence. No public response or device test is claimed.

## Integration/release work still required

1. F03 must provide stable, administrator-controlled role codes; mutable name and voice cannot be the permanent identity authority. Reconcile official support directory versions, valid preferences, and account switch before deployment.
2. Single shared Gateway integrator must register C07 `routes.ts` through existing authenticated dependency wiring after collisions with R18/C01 are reconciled. Current routes are not live. Single F12 owner wires the actual centered Assistant tab into **Talks · Chats · Assistant · Wallet · Agents** (human DMs remain separate).
3. Run `pnpm install --frozen-lockfile`, `pnpm exec vitest run services/gateway/src/assistant_workspace/service.test.ts`, `pnpm typecheck`, `pnpm test`. Then `cd apps/mobile && flutter pub get && flutter analyze lib/src/assistant_workspace test/assistant_workspace_controller_test.dart && flutter test test/assistant_workspace_controller_test.dart && flutter test test/assistant_workspace_screen_test.dart`. Record exact outputs, fix compilation if required.
4. Repeat against real authenticated A/B sessions and migrated PostgreSQL: changing support identity **during** blocked history read, revoked account/Character, concurrency across devices, lost-response and restart journal, denied mic and offline, no private history to another user, and compatibility with U01/U02 task approvals, U09 Live voice and financial authority. No production mutation in this PR.
5. F18 overall still lacks the server-owned durable cross-persona task/consent pointer and validated U01–U09 action composition. Existing C07 #480 remains **PARTIAL_IMPLEMENTATION** and **draft/unmerged**; this bounded consistency fix is not a feature signoff.

Trace: F18/C07, C01/C02 authorization dependencies, R03/F03 identity, R17/F12 shell, M08–M09, N08, Q05/Q08/Q09/Q10, J02/J07/J11.

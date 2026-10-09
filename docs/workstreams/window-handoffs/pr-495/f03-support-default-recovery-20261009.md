# F03 — authorized support default recovery

Owner: autonomous Work window /root, 2026-10-09.
Branch: work/r03-support-preference-authorization-20261008; existing draft PR #495.
Observed main: 5e758673ae91082520b21b3153da53791ae2cbf3; resumed head: d2dc8982330ce2c7f2a5913ceda1bee51b6feb0f.
Claim: 2026-10-08T23:47:17.264Z; RELEASED after committed implementation and verification checkpoint.

Scope: complete safe directory default read resolution when the saved preference is hidden, revoked, non-support or unavailable; preserve saved preference and select only a unique currently visible authorized platform default. Sanitize preference readback failures and revalidate returned tenant/user/character authority. Continue #495, no parallel preference schema.

Exact owned paths:
- services/gateway/src/agent_directory.ts
- services/gateway/src/agent_directory.test.ts
- services/gateway/src/agent_support_default_recovery.test.ts (new)
- docs/workstreams/f03-support-default-recovery-20261009.md

No shared Gateway composition, Flutter Settings, root router, migrations, native Firebase, voice runtime or financial changes. Existing #495 Flutter transport/state/settings consumers already use defaultPlatformAgent from this projection. Preserve all existing #495 source.

Inspection: main continuation, U/F reconciliation and 20-window workbook, live 70 open PR heads, #495 source/files and #441 atomic-bootstrap handoff. U01-U20 reserved; U21-U30 implemented drafts; F01 visual decision blocked; F02 requires shared native/runtime/device ownership; F03 independent directory recovery is safe. #495 last visible update 2026-10-08T12:02:32Z, stale >5 minutes; #497 owns shared composition only. Full F03 remains PARTIAL_IMPLEMENTATION.

## Implementation and publication

Source/test commit: **7bbe97a960697f1d04187327820e59a15133d2f0**. Existing draft PR: https://github.com/Baatiku/masanawa/pull/495.
Final branch HEAD (including this handoff) is recorded in the PR body and its immutable handoff link; source/tests are unchanged after the source SHA above.
No rebase or merge was performed: latest main was inspected but this preserves and continues the existing #495 lineage. Final integrator must reconcile it with latest main.

- Current visible, authorized support-agent preference wins over the platform default.
- Hidden, missing, audience-revoked or now non-support saved preference falls back ONLY to a single explicit visible/authorized platform default. Zero/two defaults produce no selection. Never choose by list order or manufacture availability.
- Reads never mutate the saved choice, so restoring eligibility restores the user's chosen persona.
- Presentations and profiles are validated against authorized tenant, visibility and exact Character. Cross-user/tenant preference results fail closed.
- Read failures, including post-write readback, return a sanitized 503 with no SQL/connection details. Unknown responses require authorized GET reconciliation; they never imply rollback or trigger a new financial/agent operation.
- Corrected existing preference-test fixtures from UUIDv4 to required UUIDv7. Production ID parsing is unchanged.
- Existing #495 Flutter directory transport/controller/Settings already consumes this service's defaultPlatformAgent projection. No new UI, DTO, migration, shadow preference store or alternate assistant was necessary. New voice or paid-Seat readiness is not implied.

Actual changed paths: agent_directory.ts; agent_support_preference.test.ts; new agent_support_default_recovery.test.ts; this handoff. agent_directory.test.ts was executed unchanged.

## Executed verification — exact source commit above

Environment: Node **24.19.0**, Vitest **5.0.3**, TypeScript **6.0.2**, uuid **14.0.2**.
Private git clone authentication was unavailable; files were reconstructed from immutable connector reads in a scratch test workspace. Npm package installation succeeded. Tests import actual agent_directory.ts and actual canonical contracts including UUIDv7 generation/parsing; only repository persistence/activity/auth interfaces are unit fakes.

1. `npx vitest run services/gateway/src/agent_directory.test.ts services/gateway/src/agent_support_preference.test.ts services/gateway/src/agent_support_default_recovery.test.ts`: **3 files, 32 tests PASS**, exit 0 (3 unchanged directory cases + 8 existing preference cases + 21 new recovery/security cases).
2. Regression sensitivity: the new 21-case suite against the prior #495 service `d2dc8982330ce2c7f2a5913ceda1bee51b6feb0f` gives **15 failed / 6 passed**, exit 1. Restored modified source; all 32 cases pass again. This demonstrates behavioral regressions, not only source-pattern assertions.
3. `npx tsc -p tsconfig.focused.json`: **PASS**, exit 0. Strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes. Scoped compilation uses real contracts sources plus real agents configuration.ts/mobile-shell.ts exports, and the changed service/three test files. This is NOT full Gateway/workspace typecheck. The ephemeral config/alias wrappers were not committed or proposed as replacements for repository configs.
4. Immutable GitHub readback confirms all three source/test contents exactly match the locally tested files: source blob `69e2df717832bd4bc97f22893f0e65d47c4ab44a`, preference test `b53739316bb46280d368905b5a20d664112f6be3`, new test `25cbe36af6861f18a7391d9077cd61a9bb6c8a0f`.
5. Final open-PR changed-file inspection (including new #518): only this #495 touches the three owned source/test paths. Latest main remains `5e758673ae91082520b21b3153da53791ae2cbf3`. No stale branch was overwritten, forced, merged, deleted or deployed.

## Unexecuted checks / integration requirements

**NOT RUN:** full Gateway/workspace typecheck/build, Gateway HTTP app tests, real PostgreSQL/CAS/migration concurrency, Flutter analyzer/widget suite, Android APK, two devices, customer auth session and real configured API readback. CI issue #457 remains separate; no Actions quota/runners/settings were changed. No Firebase, LiveKit/Gemini/provider or production state was exercised.

Single final integrator:
1. Preserve #495 original preference UI/controller, #482 locale Settings, #499 secure offline roster, #441 atomic bootstrap, #493/#497 five-tab composition and #461 Firebase. Reconcile #495 with current main semantically; do not replace any shared files from this older branch.
2. In a complete supported clone run `pnpm --filter @masanawa/gateway-service typecheck`, then focused Vitest for `agent_directory.test.ts agent_support_preference.test.ts agent_support_default_recovery.test.ts agent_support_preference_route.test.ts agent_directory_route.test.ts` using repository scripts/config. The existing HTTP extra-field case and full app composition are NOT certified by isolated service tests.
3. On disposable PostgreSQL with canonical migrations, authenticate separate tenants/users, PUT a real visible support preference, GET readback, restart; hide/revoke/demote chosen agent, ensure only authorized unique configured fallback, restore eligibility and confirm saved preference returns. Race default changes and verify no cross-account success or raw errors.
4. Run existing #495 Flutter preference recovery and Settings tests, secure cache #499 tests, analyzer and two-device Settings/Assistant restart tests. Offline cached selection must remain unverified; a 503 read cannot look like a newly confirmed default.
5. Domain execution must continue to authorize current character/capability independently; this directory fallback never grants an agent permission, starts a task, switches an active private voice session, spends money or admits a paid public Seat.

## Security, remaining scope and disposition

No DDL/database mutations, credentials, financial permissions, Firebase native files, root navigation or production modifications. Authorizer-derived tenant/user and current audience constrain projection. No action approval crosses personas. Existing preference remains durable; GET recovery is read-only. Snapshot visibility can change after response, so existing downstream domain authorization is still required.

Narrow support-default recovery: **source implemented, isolated service tests and strict scoped types verified**. Integration: existing #495 source flow, **draft/unmerged**, not deployed. Evidence: **UNIT VERIFIED, NOT E2E**.
Whole **F03/R03/R19 remains PARTIAL_IMPLEMENTATION**: 15 additional Experts, full persona/voice readiness and device/runtime qualification remain open. This checkpoint does not mark the full foundation DONE.

Trace: F03/R03, N05 and persona/default-support A requirements; J06/J07/J11. Lease RELEASED for subsequent safe continuation. Next window resumes #495 source commit above and current head; no duplicate preference schema/PR.


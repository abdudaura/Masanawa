# F14/C01 — fail-closed ambiguous contact writes and Contacts retry (2026-10-09)

## Status, ownership and immutable checkpoints

**PARTIAL_IMPLEMENTATION — DRAFT / UNMERGED / NOT E2E VERIFIED / NOT DEPLOYED.** This is a bounded recovery on canonical C01 draft [PR #468](https://github.com/Baatiku/masanawa/pull/468), not a second contact implementation or any claim that all F14/K13–K20 acceptance is met.

- Current `main` checked: `5e758673ae91082520b21b3153da53791ae2cbf3`.
- Continued branch: `work/c01-private-contact-admission-20261008`, inherited exact HEAD `d77fd63ad3c2dbe4657233c6640be9ce0d431689` (last branch commit 2026-10-09T04:02:07Z).
- Fresh repository-visible [five-minute issue claim #572](https://github.com/Baatiku/masanawa/issues/572) published **before** any code modifications and scope refinement was also commented before editing the screen/test paths. Existing source and prior F14 handoffs were inspected and retained. No force push, branch reset, merge or production write.
- Implemented source/test checkpoint: `a55acb07fb3327ecb05411f4051cb4ac264a9151` (four additive commits from inherited HEAD). This handoff is a separate subsequent commit; consult this branch HEAD for its exact final SHA.
- F14 is still blocked on C01/ R18 Gateway composer #435, final Work integration #497, C02/F15 #472/#475, U21 #508, U24 #510 stacked screen privacy changes, F12 five-tab navigation and Firebase #461. Preserve all these branches and follow the migration sequence 0015→0016→0017.

## Real source change and bounded authority

Source scope: the existing authenticated, human-only Flutter C01 contacts interface/controller. C01 Postgres consent model, authenticated Gateway endpoints, roster identity, financial services, root navigation and production databases are **unchanged**.

1. `apps/mobile/lib/src/messages/human_contacts_controller.dart`
   - Previously, a failed contact request/response/revoke left the old contact list and cursor visible, although the server may already have committed before the connection failed. It now hides those rows and continuation cursor on uncertain writes until the user refreshes authoritative state.
   - Even when mutation **succeeds**, old rows are discarded **before** the post-write `refresh()`. If that readback fails, stale accepted/incoming/outgoing entries cannot reappear from the previous list. The confirmed mutation notice remains distinct from failed readback.
   - When updating owner preferences fails ambiguously, hide the old owner-policy projection instead of presenting a potentially obsolete policy; successful readback restores it. Existing account/session epoch fencing, suspended reads while busy, login authority and mutation acknowledgement behavior are preserved.
2. `apps/mobile/lib/src/messages/human_contacts_screen.dart`
   - The visible error banner previously offered Retry only **while** `loading == true`, an inverted condition that left an ordinary failed request with no clickable retry. Retry now calls the existing authoritative refresh once not loading/busy; no new backend path or route.
3. `apps/mobile/test/human_contacts_controller_test.dart`
   - Three new regression tests for uncertainty/fail-closed contacts, acknowledged write with failed readback, and uncertain privacy preference refresh. Test fake can simulate contact-read failure.
4. `apps/mobile/test/human_contacts_screen_test.dart`
   - Existing request-failure widget test extended to tap Retry and establish that error clears after the real fake transport read; no fabricated send confirmation.

**Privacy and UX limits:** Error messaging currently uses the existing C01 `_errorText` mapping. A timeout does not prove a write failed, so the UI must not auto-retry non-idempotent decisions. Retry **reads**, not retransmits the previous write. If server remains unavailable, list/policy remain hidden and an error is displayed. C02 still independently reauthorizes DM sends: a UI projection never grants access. This fix does not pretend C01/DM is integrated into current `main`.

## Evidence: performed versus not performed

- **Performed:** GitHub connector write/readback of all four modified source/test paths. Programmatic source checks: **8/8 PASS** for controller invalidation/readback, privacy clearing, retry wiring and regression case presence. Compare `d77fd63...a55acb07`: ahead four/behind zero, **exactly four scoped file changes**. These are structural checks and immutable source evidence, not executable Flutter widget evidence.
- **Environment blocker:** `git ls-remote https://github.com/Baatiku/masanawa.git HEAD` failed with `Could not resolve host: github.com` in the local runner; repository checkout unavailable. Node `v22.16.0` exists, but local `pnpm`, `flutter` and `psql` are unavailable. A connected GitHub source read is not an executable test run.
- **NOT RUN:** `cd apps/mobile && flutter test test/human_contacts_controller_test.dart test/human_contacts_screen_test.dart`; `flutter analyze` relevant files; whole Flutter suite and Android APK; disposable C01 Postgres and authenticated two-device K13–K20; all Gateway/finance/device/provider regression; shared CI #457 still reports exhausted Actions capacity and no validated execution for this SHA.
- **No positive claim:** `IMPLEMENTED_UNVERIFIED`, `VERIFIED_E2E`, `DEPLOYED_VERIFIED`, restored backup, signed APK, database integration and app release are **not** claimed.

## Exact follow-up for integration owner

1. Semantically reconcile this small C01 Flutter fix with U24 #510's stacked controller/screen and U21 #508's Contacts Hub; preserve the fail-closed state and working Retry control in the final screen.
2. Integrate existing C01 #468 via F14/R18 shared composer and migrations, and canonical C02/F15 DM opening and send policy. Do not duplicate contacts databases or change the five-tab root outside F12.
3. Execute the two authored tests, broader C01 Flutter/Gateway tests, typechecking, disposable PG identity/revision/race tests and signed low-end Android two-user journeys. Exercise ambiguous POST/DELETE ACK loss (server commit then TCP drop), restart/retry, user switching, blocked/hidden/deactivated contacts and offline state. Confirm Retry only re-reads, never repeats a mutating request.
4. Resolve shared Actions #457 and record SHA-specific executable logs; obtain explicit separate release approval. **Do not merge or deploy** until actual integrated evidence exists.

No production systems, tokens, Firebase native assets, financial authority, root router, migration registry, CI workflow or existing feature branches were modified.

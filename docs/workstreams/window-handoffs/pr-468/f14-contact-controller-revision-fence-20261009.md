# F14 / C01 — Contact controller read/write revision fencing (2026-10-09)

**Status: PARTIAL_IMPLEMENTATION · existing draft PR #468 · UNMERGED · NOT RUN on Flutter/device · NOT DEPLOYED.** This is a mobile race/security continuation of existing C01, not a new Contacts service or competing U21 Contacts Hub.

## Authority, exact ownership and SHAs

- Current baseline `main` inspected: `5e758673ae91082520b21b3153da53791ae2cbf3`.
- Canonical branch: `work/c01-private-contact-admission-20261008`; original PR: https://github.com/Baatiku/masanawa/pull/468.
- Inherited C01 draft head: `3a51a88820ba483db25152777414d1be786c9ca1` (preserved).
- Before-source five-minute exact-path claim: https://github.com/Baatiku/masanawa/pull/468#issuecomment-6073980178. Heartbeat: https://github.com/Baatiku/masanawa/pull/468#issuecomment-6073993404. Earlier F14 owner released its previous different-path claim: #6073492822.
- Production-controller source checkpoint: `e6cbc0d66879b84bc470d6f2736e1abae9589b3f`.
- Four-regression-test source checkpoint: `0575cb38ef0c342b9c7bf33b1a6abe3bf810ff2d`; subsequent no-behavior-change test-fixture await clarification: `67091d394105d73acb592b5cee4a21182434e0e9`.
- Exact isolated paths owned and changed: `apps/mobile/lib/src/messages/human_contacts_controller.dart`, `apps/mobile/test/human_contacts_controller_test.dart`, and **this new** `docs/workstreams/f14-contact-controller-revision-fence-20261009.md`. There are **no** edits to `app.ts`, `main.ts`, migrations, Flutter root/router, U21 `contact_hub/**`, provider, native Firebase, CI configuration, or finance.
- At initial source checkpoint, GitHub compare against inherited head: **ahead 2 / behind 0**; exactly two Dart paths. The final fixture-only amendment and handoff add commits, without expanding the owned Dart paths. This handoff is an additional documentation-only commit; its own SHA must be taken from GitHub's final branch head.

## Verified gap, actual behavior and owned scope

Prior C01 `HumanContactsController._mutate` set `busy` but did not invalidate a running `refresh` or `loadMore`; a slower pre-write contacts/preferences response could overwrite the user's latest confirmed preference or contact state. It invalidated an old handle lookup **after** mutation success, rather than as the write started. A new refresh or lookup could also begin in the middle of an uncertain contact-consent write.

**Implementation** (actual client state logic, not mocked production behavior):

1. Increment both `_readEpoch` and `_searchEpoch` synchronously at the **start** of any authenticated contact request/response/revoke/privacy mutation, before launching the network write. Already-dispatched list, pagination, preferences and lookup responses can no longer replace later state.
2. Clear stale lookup/eligibility, release old loading/searching/pagination indicators, and expose the existing explicit busy state while the write is unresolved.
3. Defer `refresh` and handle discovery attempts while `busy` is true; a successful mutating write continues to call a fresh authenticated server readback as before. No write is retried automatically on failure.
4. Preserve the existing signed-in account fence, successful server response requirement, pagination cursor checks, C01 DTOs, old C01 screen and failure notices. No new client-side admission decisions, cached private data or unrelated navigation introduced.

**Regression tests authored:** stale initial preferences/list refresh versus completed discoverability change; stale in-flight exact-handle lookup versus privacy change; attempted new reads during unresolved request with real post-ack refresh; stale paginated response versus revoke and post-revoke refresh. Deferred tests require Flutter SDK; code inspection is not Flutter execution.

## Evidence / checks (do not overstate)

| Gate | Status | Evidence |
| --- | --- | --- |
| Claim before code | **PASS (GitHub)** | C01 PR comment #6073980178 precedes the two committed Dart files |
| Existing draft continuity | **PASS (GitHub)** | Inherited `3a51a888`; source checkpoint `0575cb38`, fixture clarity `67091d39`; readback confirmed only owned source/test paths |
| Pushed source readback and structural guards | **PASS (static only)** | Connector fetched and inspected committed Dart controller and tests; 4 test declarations present; guards and epoch increment present |
| Flutter unit/widget tests | **BLOCKED / NOT RUN** | No `dart` or `flutter` installed in available container, and no GitHub DNS/checkout |
| Full Flutter analyzer and Android app | **BLOCKED / NOT RUN** | No Flutter SDK or real Android handset bound to this session |
| C01 Gateway auth + disposable PostgreSQL | **NOT RUN** | Shared C01 backend unmodified here; no `pnpm`, `psql`, private checkout or authenticated disposable DB |
| Integrated C01 + C02 + U21/U24 two accounts/device | **NOT RUN** | C01 draft, U21/U24/C02/F12 shared compose still unmerged; do not claim cross-device acceptance |
| GitHub Actions, Firebase, money/provider, live rollout | **NOT RUN** | Issue #457 budget/zero-step CI, no production changes authorized |

Required local integration checks after code checkout and dependency restoration:

```bash
cd apps/mobile
flutter pub get
flutter test test/human_contacts_controller_test.dart
flutter test test/human_contacts_transport_test.dart test/human_contacts_screen_test.dart
flutter analyze lib/src/messages/human_contacts_controller.dart test/human_contacts_controller_test.dart
```

Then verify on the **integrated commit SHA** with two authenticated accounts: A requests B, B accepts, one device refreshes and pages contacts, A revokes or changes discoverability while an older offline/slow response is pending, and both devices read the authoritative contact/DM eligibility again after relaunch and account switching. Confirm a 401/revocation does not leak a private result. Run C01 + C02 SQL/API negative consent tests with fresh disposable PostgreSQL, not production or old demo bootstrap.

## Dependencies / ownership boundary / remaining work

- Preserve canonical C01 SQL/privacy/migration in PR #468; U21 #508 may consume this controller but owns `contact_hub/**` only. U24 request controls and F15/C02 send-time authorization remain separate.
- F12 is the **sole** five-tab Flutter root integrator; F11 handles CI/release evidence. Keep `Talks · Chats · Assistant · Wallet · Agents` untouched.
- Future integrator: reconcile this PR over latest main and Work #497 without overwriting U21/U24; run the deferred tests and real device scenarios; ensure stale invalidated read operations do not leave frozen spinners on the composed Chats screen. Complete backend composition, migrations and notification/readback evidence separately.
- Original C01 is **not** production-complete from this source checkpoint. No merge, branch deletion, production DB/API or financial operations performed.

# U22 — Optional local phonebook and invitation consent: SHA-specific handoff

**Status: PARTIAL_IMPLEMENTATION · UNVERIFIED · DRAFT ONLY · NEVER MERGE OR DEPLOY AS READY.**
This feature has substantive mobile code and focused tests but lacks native app permission registration, integrated Chats route and executed device/build checks. No backend/API/migration is implemented because the owner has **not** approved uploading or matching phonebook numbers to accounts; server access would be a privacy regression, not an end-to-end requirement for v1.

## Ownership and branch

- **Assigned lane:** U22, optional on-device phonebook, no phonebook upload.
- **Base:** latest inspected `main` `5e758673ae91082520b21b3153da53791ae2cbf3` on 2026-10-08.
- **Branch:** `work/u22-local-phonebook-20261008-gpt6`.
- **Code checkpoint SHA before this handoff:** `40b22231bade96d8ac85c4c6b2c1f8c50319a594` (original implementation checkpoint `cea4174308a0eadd0f53594867a62e8a1ad43b15`); the full final handoff commit SHA is recorded in the draft PR head metadata.
- **Exclusive claim:** `apps/mobile/lib/src/device_contacts/**`, `apps/mobile/test/device_contacts_controller_test.dart`, this file. Only shared change: additive `fast_contacts: ^5.0.1` in `apps/mobile/pubspec.yaml`, which needs the native release owner's explicit review.
- **Potential competing work:** U21 had an active branch `work/u21-human-contacts-hub-20261008-gpt6` and repository claim; this U22 source does not touch its files. C01 #468 and C02 #472 are not copied. F12/Work #493/#497 owns the five-tab Flutter router; F10/Firebase #461 owns native integration. R15/R12 owns deletion/safety. No financial, provider, migration, auth or Gateway files touched.

## Exact files and behavior

1. `apps/mobile/lib/src/device_contacts/device_contacts_model.dart` — immutable local-only contact DTOs, OS access/invite ports, duplicate removal within each OS entry, only confidently explicit international number canonicalization. Local numbers are **never** assumed E.164 or verified platform identity; no guessing region or country.
2. `apps/mobile/lib/src/device_contacts/device_contacts_controller.dart` — no read without signed-in account + explicit opt-in, permission denial/restricted/limited states, state resnapshot on resume, request/refresh/retry, immediate purge on opt-out/account switch/dispose, epoch fences for late async reads, busy and unsafe invite guards, local-only search, no persistence of names/numbers; only a secure per-account boolean opt-in preference.
3. `apps/mobile/lib/src/device_contacts/device_contacts_consent_store.dart` — secure storage for the per-account boolean consent choice only. Restoration displays prior consent but intentionally does **not** read OS contacts until another visible user tap; failed writes do not initiate OS access.
4. `apps/mobile/lib/src/device_contacts/device_contacts_native.dart` — permission_handler read-only authorization; fast_contacts retrieves only name and phone; share_plus opens OS share with **only public** `https://masanawa.com` homepage. It never passes names, phone numbers, user IDs, friend IDs or tokens to the share payload. This static URL is **not** a proven signup/deep-link landing.
5. `apps/mobile/lib/src/device_contacts/device_contacts_screen.dart` — nested Chats opt-in screen, explicit rationale before OS prompt, busy/offline/denied/settings/empty states, virtualized scrolling, local search, masked number endings, multiple-number invite selection, app-resume permission check, scoped account key. No source claims these phonebook users are on Masanawa.
6. `apps/mobile/test/device_contacts_controller_test.dart` — unit scenarios for local normalization, deduplication, denied/limited/granted permission, OS revocation, late-read/account-switch races, sharing authorization, secure boolean preference/no auto-read/fail-closed storage and 10,000 entries.
7. `apps/mobile/pubspec.yaml` — adds compatible-major `fast_contacts`; existing `permission_handler` and `share_plus` reused.

**Not done / scope gaps:**

- Native **AndroidManifest** `android.permission.READ_CONTACTS` and iOS **Info.plist** `NSContactsUsageDescription` must be added by **F10/native release owner**, reviewed with store declarations, dependency lockfile and signed binary. None are implicitly done by this PR. `WRITE_CONTACTS` is not needed.
- F12 must wire the new screen under **Chats → Contacts → Find phone contacts**, not a sixth root tab, and add Back/deeplink tests. U21 must continue to work when OS permission is denied.
- The boolean opt-in preference is persisted in secure storage per account, but raw contacts are **never** persisted. Even a previously opted-in user must explicitly tap again before reading the phonebook on a new screen/session. Verify this UX with the owner in acceptance testing.
- Low-end phone profiling, 10k native OS scan timing, iOS limited-permission behavior, OS settings return, signed binary checks, actual invite share targets and correct iOS privacy prompts are **not verified**. No screenshots/analytics/logs may expose raw phonebook numbers.
- The public invite homepage can only be upgraded to an actual universal-link registration flow by U23/F12 once its tested web fallback and abuse policy exist.
- No server-side phone matching, unsalted hash upload, automatic background sync, agent memory ingestion, financial recipient inference, or unconsented third-party messaging is approved.
- No native permissions were changed here deliberately because Firebase/Android/iOS integration currently has a separate active owner.

## Execution evidence

- **Code changes:** pushed via GitHub branch commits; no local Android project clone was possible from this runtime.
- **Flutter analyze/tests:** **NOT RUN**. This runtime has no `flutter` or `dart` executable or dependencies; GitHub Actions #457 is under quota/runner constraint. These facts are blockers, *not a pass*. Do not repeatedly retry CI until capacity is restored.
- **Postgres/API/provider testing:** NOT APPLICABLE for device-only v1; backend C01/C02 onboarding/authorization remains delegated and unverified.
- **Physical Android/iOS device:** NOT RUN. Must test grant, deny, permanently deny, limited contacts (iOS), revoke while open, revoke on settings change, multi-number selection, unicode/10k entries, share consent, signout while permission dialog/open read, background/resume, and no phone numbers in logs/network.

## Work/native integrator checklist (in order)

1. Recheck `main`, this branch/PR and other owners' fresh claims; preserve Firebase #461 and F12 five-tab shell.
2. Review `fast_contacts` v5 major plugin compatibility for current Flutter toolchain and lockfile; `cd apps/mobile && flutter pub get` then `flutter analyze` and `flutter test test/device_contacts_controller_test.dart`. Add device/widget tests for permission and renderer as needed; fix real findings.
3. Native owner adds only READ_CONTACTS to Android release/debug merged manifest, minimal iOS Contacts usage string, required permission_handler platform configuration, privacy/store disclosures and signed rebuild. Do **not** claim Shorebird Dart patch can add native permissions.
4. On real Android + iPhone run opt-in, deny, settings, limited, revoked, 10k/multi-SIM/Unicode, account-switch, low-memory, empty/offline and system share flows. Confirm no unsolicited OS permission before tap; no raw numbers/log leakage, no Gateway traffic, no platform person identity inferred.
5. F12 connects nested route and entry only **after** the dependency and native permission are qualified; U21 keeps accepted in-app contacts usable even if device address book permission is off.
6. Verify secure per-account opt-in persistence and explicit re-tap/no auto-scan on screen re-entry, with account-switch and revocation testing. Document real achieved acceptance and E2E evidence before making PR reviewable/merging.

**Canonical architecture preserved:** Talks · Chats · Assistant · Wallet · Agents. No financial data or provider secrets touched. No DONE claim.

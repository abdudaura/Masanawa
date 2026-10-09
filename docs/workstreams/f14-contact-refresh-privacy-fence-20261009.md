# F14/C01 — Fail-closed contact reload privacy fence (2026-10-09)

## Status / immutable provenance

**PARTIAL_IMPLEMENTATION for the complete C01/F14 scope.** Existing canonical [draft PR #468](https://github.com/Baatiku/masanawa/pull/468) remains **UNMERGED, NOT DEPLOYED, NOT VERIFIED E2E**. This patch is an isolated Flutter client recovery on the existing PR; it is not a new contact backend/migration or an additional root tab.

- Main inspected at claim: `5e758673ae91082520b21b3153da53791ae2cbf3`.
- Existing C01 draft branch inherited HEAD: `b0e3b842aaf79ed58e16a516cd765920ff4f3a35`.
- Exact-path registry claim **before editing**: `gpt6-f14-contacts-reload-privacy-20261009` on `factory/claims`, claim commit `8cf411ba4c45b6dd2b04fff60bebc582a80fbf6d`, at 2026-10-09T04:32:03Z (five-minute lease). Three exact paths listed below; registry release is required after final PR handoff.
- Source change commit: `048e17b4048264d5baa9a835e559e34d149b47fb`.
- Regression test commit and source checkpoint: `9fd496dbaffff02d583a0a7a0b8af77757756f27`.
- Read-back immutable Git blobs: controller `4a8ba4290179b8234aa1751c3c2eaaeb067ef7fe`; tests `553f0374322ee09da2960e8d4ae0e6ac0c4bd688`.
- This handoff's commit SHA must be taken from the final branch head, not assumed by this text.

## Defect and actual scoped change

An already loaded C01 Contacts view could keep showing old contacts, request permissions, privacy preferences and a previous exact-handle result when the user triggered a new full `refresh()` and its server request failed. Because another account may have blocked/revoked or moderated the relationship since the last read, presenting the old result as currently authorized is unsafe; the existing Flutter UI has actions based on those statuses. A concurrently running older handle lookup could also complete after a newer full reload and revive the old Message eligibility.

`apps/mobile/lib/src/messages/human_contacts_controller.dart`
- At the beginning of **every full authoritative reload**, synchronously clear contact entries, page cursor, previously fetched privacy preferences and previous lookup/notice.
- Increment the lookup generation as well as the list read generation, so older in-flight searches cannot publish stale eligibility after refresh.
- Keep already-existing mutation fencing, session-owner checks, explicit loading/error handling and retry path. A failed read displays its error with no stale admission state; a subsequent successful retry restores only authoritative data.
- No locally persisted offline contact cache exists here; a future intentional offline directory needs explicitly non-sendable stale state instead of inheriting server admission rights.

`apps/mobile/test/human_contacts_controller_test.dart`
- Regression: load contacts/lookup and preferences, fail a new full directory request, verify immediate clearing, error without stale permission, and recovery on subsequent successful retry.
- Regression: delay old exact-handle lookup, complete a new full directory reload first, then resolve the old lookup; check that its result never appears.
- Existing auth/account-switch, pagination, mutation and uncertain-write tests retained.

`docs/workstreams/f14-contact-refresh-privacy-fence-20261009.md`
- This SHA-specific owner/integration handoff.

## Evidence, honest execution status

- **PASS (source-only structural/readback, NOT Dart execution):** GitHub returned the exact committed blobs; nine structural invariants were checked across source and test text, including existing mutation protections and continued draft status.
- **NOT RUN:** `flutter test apps/mobile/test/human_contacts_controller_test.dart`, `flutter test apps/mobile/test/human_contacts_screen_test.dart`, `flutter test apps/mobile/test/human_contacts_transport_test.dart`, `flutter analyze`, Android APK/install, two real accounts/devices, authenticated Gateway/DB replay and CI qualification.
- Available local shell: Node 22.16.0 and git; **Dart, Flutter, pnpm, psql and authenticated repo checkout unavailable**. The Actions zero-step failure reported in issue #457 is a separate external runner limitation and is not a passing build.
- Risk: Clearing contacts on reload is intentionally conservative and may show a brief empty/loading screen on slow networks; full device UX still needs validation. UI cannot guarantee send authorization; actual C02 sends must always reauthorize consent and block status at server-side write time.

## Integration dependencies and exact next checks

- Preserve **C01 #468** original admission SQL/API, **R18 #435** Gateway composition, **U21 #508** Contacts Hub, **U24 #510** inbox, **F12 #493** five-tab routes, **Work #497**, **Firebase #461**, **F15 C02 #472/#475**, **C03/C05** and **CI #457**. This work changes no shared Gateway composer, DB schema/migration registry, financial ledger, Android native/Firebase, or root navigation.
- Recent C01 work [issue #572](https://github.com/Baatiku/masanawa/issues/572) and its handoff at `b0e3b842...` were inspected before edits; this patch preserves its uncertain-write and Retry UI work rather than rewriting it.
- On a checkout with Flutter: `cd apps/mobile && flutter pub get && flutter test test/human_contacts_controller_test.dart test/human_contacts_screen_test.dart test/human_contacts_transport_test.dart && flutter analyze`.
- Then compose accepted vs revoked/blocked transitions against disposable PostgreSQL and real authenticated two-device sessions; simulate network failure during refresh and verify no old Contact **Message** control remains actionable; reauthorize actual C02 message send on Gateway regardless of UI.
- Re-check full test device size, offline/reconnect, account switch, request revisions, locale/accessibility, 0015→0016→0017 migration order, release signing/FCM and build SHA. Keep draft until externally executed evidence supports integration.

**No merge, branch deletion, production mutation, phonebook upload, release or provider/finance action.**

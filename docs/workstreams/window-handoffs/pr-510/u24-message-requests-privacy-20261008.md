# U24 — Message requests and privacy: Work handoff

**2026-10-08 · Source status: PARTIAL_IMPLEMENTATION / UNVERIFIED. DRAFT / UNMERGED. NOT DONE.**

## Ownership and exact immutable references

- Scope U24 (P0) contact requests and privacy **presentation**. F14 owns C01 DB and authenticated Gateway API. F08/R15 own person report/block/mute and enforcement. F12 owns the final five-tab global router.
- Repository Baatiku/masanawa. At claim, latest main was 5e758673ae91082520b21b3153da53791ae2cbf3.
- C01 dependency: draft PR #468, branch work/c01-private-contact-admission-20261008, base HEAD f8c5973437090e3aec38fd7bd4ac4376ae050f42. Its required source is not on main.
- U24 branch work/u24-message-requests-privacy-20261008-gpt6, **code and tests checkpoint SHA b1fbb48d316e75693cbaa41991e1ff78ea27c537**. The stacked PR head records the later handoff-only SHA.
- Review this as a stacked PR targeting the C01 branch, NOT directly main. Once #468 is verified/merged, reapply only U24's delta to the accepted C01 source. No new C01 table/migration or alternative backend.
- Five-minute ownership check: U21 and U22 branches already existed but U24 was not claimed. C01 last PR update was 12:51:20Z, more than five minutes old. U21 contact_hub, U22 device_contacts, F12 router, F14 Gateway/schema and R15 safety draft code were left untouched.
- Contracts reviewed: CONTINUE-HERE.md, UNFINISHED-SCOPE-RECONCILIATION-20261008.md, ADDITIONAL-U21-U30-AND-FOUNDATION-F01-F18-20261008.md, CONTACTS-AND-ADDRESS-BOOK-EXPERIENCE-20261008.md.

## Implemented and committed source

1. apps/mobile/lib/src/messages/human_request_privacy_screen.dart: private request inbox driven by canonical C01 HumanContactsViewState, incoming/sent sections, truthful per-page counts, revision-guarded Accept/Decline, confirmed Decline/Withdraw, privacy visibility and contact policy controls, loading/error/retry/refresh, disabled mutations while busy and same-account requirement after confirmation dialogs. No duplicate contact store and no client-assumed send permission.
2. apps/mobile/lib/src/messages/human_contacts_screen.dart: an actual authenticated nested-screen entry from C01 Contacts; original C01 search/request screen remains intact. F12 later attaches Contacts to Chats.
3. apps/mobile/lib/src/messages/human_contacts_controller.dart: invalidates old in-flight reads when a mutation starts; after request/respond/revoke, performs authenticated list readback before showing success. A failed readback yields an explicit uncertainty message, not a success banner. Policy/discoverability changes additionally fetch and compare the authoritative server GET before claiming saved.
4. apps/mobile/test/human_request_privacy_screen_test.dart: seven focused widget tests for grouping, no agent/human conflation, requested action and revision, distinct cancel/decline, disabled busy/revisionless actions, settings controls and failed-state retry.
5. apps/mobile/test/human_contact_privacy_readback_test.dart: six focused controller tests for successful readback, uncertain post-write refresh, stale revision denial, preference mismatch, discoverability readback and account switch during an in-flight write.
6. No backend, migrations, authorization changes, shared app router, Firebase, crypto/billing ledger, phonebook permission or build pipeline changes. Existing authenticated C01 endpoints are the sole contact authority.

## Verification: authored but NOT executed

No Flutter or Dart SDK binaries were found in this environment (command -v checked once). GitHub Actions issue #457 documents quota exhaustion; a zero-step workflow is neither test success nor code failure, and no CI rerun was attempted. Therefore **no Flutter tests, analyzer, real PostgreSQL, Android, multi-account or provider integrations have been executed for U24**. Do not claim passed tests or DONE.

Run in a Flutter-enabled Work checkout after composing the C01 parent:

    cd apps/mobile
    flutter pub get
    flutter test test/human_request_privacy_screen_test.dart test/human_contact_privacy_readback_test.dart test/human_contacts_controller_test.dart test/human_contacts_screen_test.dart test/human_contacts_transport_test.dart
    flutter analyze lib/src/messages/human_request_privacy_screen.dart lib/src/messages/human_contacts_controller.dart lib/src/messages/human_contacts_screen.dart
    flutter test

Also run C01 Fastify service/route unit tests, real PostgreSQL integration around contact migration 0016 + approved profile/DM migrations, and final compiled Flutter/Android smoke tests. Fix any failure; do not substitute documentation for execution.

## Not finished, blockers and owners

- C01 list currently has an unpaginated limit of 100, and controller loads 50. U24 honestly labels counts "on this page", **not actual inbox totals**. F14 must implement secure cursor pagination, full request totals and revision-safe sync for large (>10,000) contacts. U21 will consume this authoritative DTO.
- Block/mute/report and blocked-user management: R15 existing draft #494 implements real human profile preference readback; #496 implements human profile report workflow. They were intentionally not copied into U24. F08/F14 must compose one safety identity graph and supply the typed UX hooks before these actions can appear in the U24/Chats UI. Revoking contact is **not** blocking or reporting; there are no fake enabled buttons.
- C01 revoke does not currently take an expected request revision. U24 checks current client state after confirmation, but server cancel-vs-accept concurrency needs an atomic F14 contract and cross-account evidence. R15 and C02 must enforce blocks at send, search, media, notification and deep-link access, including stale local state.
- C01 #468 is unmerged. F12 root Contacts navigation, C02 conversation creation/send, C03 realtime, R18 profile avatar, R15 human safety and U21 contact hub are distinct unmerged dependencies. U24 alone is not usable as production functionality.
- Mandatory unexecuted acceptance: two real signed-in accounts A/B request, accept, cancel, stale response and cross-device history; third-party/tenant access denied; block vs request races; hidden account non-enumeration; signout and account switching during API/dialog; DB restart/migration; 10k list scalability, Android low-RAM, 320dp, RTL and large-text accessibility.

## Final ChatGPT Work integration steps

1. Refresh main, claims and all C01/F14/R15/U21/F12 PR heads. Review this branch versus its precise C01 base; preserve canonical identity/consent schema. Resolve any upstream C01 changes semantically.
2. Run and fix Dart focused tests/analyzer, then integrate isolated request/privacy widget and controller readback into the accepted C01 source.
3. F14 completes safe pagination and revision-aware cancel semantics; replace per-page labels with total counters only after server can prove totals. 
4. F08 composes existing R15 #494/#496 block/mute/report source and proves C02/C03/FCM media restrictions. Reuse the actual services; do not rebuild them.
5. F12 integrates U21 Contacts into exactly Talks, Chats, Assistant, Wallet, Agents, with no sixth tab or redirect of old AI chats to human DMs. Preserve Firebase #461/Work #497 and all money safeguards.
6. Execute two-account real DB/API, low-end physical Android/device, full integration and CI evidence. **Leave this branch draft and unmerged until those gates are genuinely green.**

## Risk statement

The U24 UI never uploads a phonebook, searches arbitrary phone numbers, grants Wallet/AI permissions or treats a human contact list as authority to send. Interrupted post-write readback is deliberately uncertain to discourage duplicate actions. Server-enforced request/block/DM permissions remain the ultimate release gate.

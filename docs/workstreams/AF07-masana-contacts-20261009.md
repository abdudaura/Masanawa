# AF07 Masana & Contacts — ownership and execution handoff

**Owner/window:** MASANAWA-01 / AF07-masana-contacts-20261009
**Claimed at (UTC):** 2026-10-09T21:42:40Z
**Most recent concrete work:** fresh main and open-PR/branch inspection, source and cross-slice contract comparison at claim time.
**Branch:** `work/af07-masana-contacts-20261009-masanawa01`
**Fresh main/base SHA:** `f381f077c485c04261459b77a42c215d3ce3a14b`
**Status:** PLANNED, no application source edited at claim time.

## Exclusive exact paths (one writer)
- `apps/mobile/lib/src/masana_contacts/masana_contacts_screen.dart`
- `apps/mobile/lib/src/masana_contacts/masana_directory_controller.dart`
- `apps/mobile/test/audio_first/af07/masana_contacts_screen_test.dart`
- `docs/workstreams/AF07-masana-contacts-20261009.md`

**Explicit exclusions:** AF00 owns root router/composition/deep links; AF07 does not edit `apps/mobile/lib/src/router/**`, pre-existing `apps/mobile/lib/src/contact_hub/**`, `apps/mobile/lib/src/messages/**` or current `apps/mobile/lib/src/state/twin_directory_state.dart`. AF08 owns auth; this slice consumes caller-provided signed-in session identity and existing public Twin transport; no new identity backend. Existing PRs #468 and #508–#511 remain untouched and authoritative recovery inputs.

**Dependencies/contract:** AF00 stable root integration pending; reuse `TwinDirectoryTransport` public persona IDs and C01/C02 human Contacts interface from #468/#508. `docs/AUDIO-FIRST-INTEGRATION-CONTRACTS.md` AF v1. New chat uses **Masana & Contacts** as a nested destination, with human and AI tagged/typed routes, not extra bottom tabs.

**Scope:** Implement a bounded reusable directory screen with Masana/Contacts switcher, server-backed search, refresh, safe persona resolve before navigation, denial/loading/offline/retry and account-switch fences. Consume real human contacts UI as an injected widget (not a duplicate transport or contact authority). Add widget tests. Give AF00 an exact mount/handoff; do not silently own composition.

**Acceptance:** UI-09 / UX-A04. Claims only source/testing outcomes actually observed. Local owner APK and physical-device/provider checks are unavailable, preserve existing source.

**Next action:** publish/read-back this exact claim via a visible PR, then edit owned source; update this handoff with immutable SHAs/results and integration instructions.

## Implementation checkpoint — AF07 owned paths

**PR:** https://github.com/Baatiku/masanawa/pull/593 (draft while root integration and Flutter execution are outstanding).
**Source/test checkpoint SHA:** `ba9fe4ff82285b308c895c9b8edeebb5eea3a686` (based on main `f381f077c485c04261459b77a42c215d3ce3a14b`).
**Actual source state:** PARTIAL_IMPLEMENTATION, because AF00 has not mounted the screen, C01/#468 + U21/#508 are not reconciled into main, and true Dart/Flutter/device tests have not executed.

### Code written

- `masana_directory_controller.dart`: real existing `TwinDirectoryTransport.search/resolve` calls; server-resolved public persona before opening the correct AI identity; UI-disabled double opens; failed load/verify/route copy; search debounce; bounded search; deduplication and cursor check; request generation, account and tab-switch fencing. Old responses cannot reopen a switched-out session.
- `masana_contacts_screen.dart`: accessible nested Masana/Contacts segments, search/clear, public AI badge/bio, manual refresh/retry, loading/empty/offline feedback, bounded load-more and server-verified AI open callback. Human content is injected, not rebuilt as a parallel human DM backend. UI is nested under Chats, not a bottom tab.
- `masana_contacts_screen_test.dart`: eight Flutter widget cases covering human/AI separation, public resolve before route, rejected changed/deleted identity, error/retry, stale search suppression, account-switch race, signed-out refusal, duplicate selection, and tab-switch cancellation.

### Actually executed verification

- **PASS_STRUCTURAL_ONLY:** fetched/read back all three committed files from the branch; checked balanced Dart source delimiters (three files), imports against present `twin_directory.dart`, page/resolve contract, owner-path diff and presence of account/generation/selection guards. This is NOT a Dart compiler or Flutter unit-test pass.
- `git compare` API: branch ahead by five commits at earlier checkpoint, no conflicts with main and only the four claimed files touched; recheck final SHA.
- **BLOCKED:** `cd apps/mobile && flutter analyze && flutter test test/audio_first/af07/masana_contacts_screen_test.dart` and `flutter build apk`: no Flutter or Dart executable in current runner; no Android device or owner's local APK/source accessible here.
- **CI INFRA FAILURE (not verified code failure):** GitHub Foundation CI run 37995335188 and Mobile Build run 37995335233 on source commit 904b8798 each returned failure with **zero job steps**. Commit status also contains a Vercel build-rate-limit upgrade failure. Neither substitutes for executed source checks.
- **NOT_RUN:** existing real C01/C02 server/session/account and /agent/twins provider integration; signed APK/two-device UX-A04. No provider, database, production or auto-deploy change made.

### AF00 exact integration handoff (UI-09, UX-A04)

1. Reconcile #468 human C01 admission/authorization and #508 human Contacts UI. Their existing `HumanContactHubScreen` is itself a Scaffold; supply **its content body** to the new `contactsBuilder` or make a bounded AF00-approved view adapter, avoiding double AppBars. Keep the existing C01/C02 request, block, identity, DM-open and protected favorite contracts; do not duplicate.
2. Mount `MasanaContactsScreen` as the authenticated **Chats → New chat** nested destination. Supply `transport: ref.watch(twinDirectoryTransportProvider)` from existing `state/twin_directory_state.dart`, `accountId` from signed-in session, and `isCurrentAccount` that reads the latest session at call time (not an old captured bool). The supplied human Contacts builder must also key/cache-fence by session.
3. `onOpenMasana` receives the fresh server-verified **public persona** with `publicId` and `characterId`. Route it through the existing **AI conversation** path with its correct identity, never through `/messages/:conversationId` or a fabricated human ID. Preserve the correct typed public-profile path where profile rather than conversation is requested.
4. Confirm actual public persona/17-platform-Masana eligibility from AF07/AF12: `/agent/twins` is a current public-twin projection, **not proof** that all planned editorial personas are provisioned. Reconcile canonical persona source before declaring the full Masana directory complete.
5. Run focused Flutter widget cases, analyzer/full smoke, actual C01/C02 and AI open on two signed-in accounts, denied/blocked/changed identity, low-end/offline and deep-link/Back journeys. Main-deploy wiring is strictly AF00-owned and must be audited separately. No migration or deployment is needed for this PR alone.

### Known open integration gaps / safe merge target

Source PR #593 remains a **reviewable AF07 component**, not a working new-chat route until AF00 composition and C01/C02 dependencies are integrated. Review and executable-check the exact latest branch SHA, then merge to a non-deploying integration branch if main auto-deploy is still live. Do not declare VERIFIED_E2E or ship an APK from this handoff. If a current AF00 writer transfers exact composition paths, land them in that integrator's branch and rerun integrated tests. No local-source recovery was performed: preserve the owner's unavailable local changes.

**Ownership handoff:** AF07 exact files above may be reclaimed under the five-minute protocol after reviewing this checkpoint; no shared paths were edited.

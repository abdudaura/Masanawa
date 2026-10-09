# U21 Contacts Hub — typed row compilation recovery + canonical C01 cursor pagination

**2026-10-09. Status: PARTIAL_IMPLEMENTATION · DRAFT / UNMERGED · NOT DEPLOYED · NOT VERIFIED_E2E.** This is a continuation of the **existing [U21 PR #508](https://github.com/Baatiku/masanawa/pull/508)**, not a new implementation or a competing schema/API. Five-minute exact-path ownership: [issue #562](https://github.com/Baatiku/masanawa/issues/562), obtained before code edits. Original U21 scope and dependencies remain documented in [u21-contacts-hub-20261008.md](u21-contacts-hub-20261008.md).

## SHA-specific evidence and protected paths

- Baseline GitHub `main`: `5e758673ae91082520b21b3153da53791ae2cbf3` (rechecked after code commits).
- Continued branch: `work/u21-human-contacts-hub-20261008-gpt6`; previous HEAD: `3e2e78061f1b95eaaa8151f02bd3b74fee82053a`.
- Source compilation repair commit: `de1266b4be5d64230d04f01dadf7fe723b6c8dd7`.
- Row identity widget regression commit: `313e4533be752bec70e190d4444a3a4203402658`.
- Cursor pagination source commit: `57ca2fb44a85e865762f894c1944408eb6057760`.
- Pagination success/recovery regression commit: `ca50b6eb46b0ce0705a708cb9be840b727b000b2` (**source/test checkpoint HEAD before this handoff**).
- Verified GitHub blob SHAs at that checkpoint: `apps/mobile/lib/src/contact_hub/human_contact_hub_screen.dart` = `871037dbf0271b4b283eeff441c13b29597ce85a`; `apps/mobile/test/contact_hub_screen_test.dart` = `90745313fe33c1eaf48e4005bc443ebfa0a0caef`.
- Exact changed paths: the two files above and this additive handoff file. All shared Gateway app/main, C01/C02 controllers, migration registry, wallet/ledger, Firebase, R17/C08 root shell, native release, provider credentials, production and CI files untouched.

## Actual code improvement

1. **Dart type failure fixed:** original screen constructed `final entries = <_HubEntry>[]` and appended Flutter `Padding` / `_PersonRow` widgets to that typed list. It could not compile. Now the list holds only `_HubEntry` metadata (heading, optional human contact, star flag) and `SliverList.builder` creates actual widgets lazily.
2. **Stable per-section identity:** actual `ValueKey('${entry.heading}_${person.userId}')` interpolation replaces the accidentally escaped runtime literal that would collide between every row. The same accepted person may appear separately in Favorites and Masanawa contacts.
3. **Real, already-existing C01 pagination contract:** inspected [C01 #468](https://github.com/Baatiku/masanawa/pull/468) branch `work/c01-private-contact-admission-20261008`, whose `HumanContactsController` already exposes `nextCursor`, `loadingMore`, and `loadMore()`, and whose `GatewayHumanContactsTransport` requests the canonical `/messages/contacts/page` endpoint. U21 now calls that controller under its existing auth/session/cursor/revision fencing. There is **no duplicate Gateway endpoint, SQL table or transport**, and no unbounded page fetch. A manual accessible `Load more contacts` button offers low-data, user-driven paging, disabled during busy/loading/open flows.
4. **Honest loading and error states:** initial contact rows remain visible on a page failure; the same nextCursor can be retried. Empty local-filter results indicate when further server pages may exist. A legacy non-page-aware C01 adapter hitting the 50-contact cap still shows a truncation warning; successful paginated final pages do not incorrectly claim missing results.

## Authored tests and executed checks

- **Three additional Flutter widget tests authored** to the original ten: section/person keys when an accepted contact is present in both favorites and primary section; C01 cursor page 1→page 2 and exhausted cursor; failed page preserving previously loaded contacts then retrying the same cursor. In-process fakes only model C01 transport behavior; they are not production API/DB integration evidence.
- **Executed:** fresh GitHub blob readback and ten structural contract assertions at `2026-10-09T02:58:49Z`: **10/10 PASS** (typed entry metadata, no widget insertion, actual interpolated row keys, cursor action, legacy truncation, existing pagination interface, three added cases, preserved original 10k-cap fixture). This is **source readback/static verification**, **not** Dart parser, Flutter execution, device E2E or runtime behavior.
- **NOT RUN / BLOCKED:** `flutter analyze` and `flutter test test/contact_hub_screen_test.dart`: no Flutter or Dart SDK available in the execution environment. Private GitHub repository checkout via terminal DNS cannot resolve `github.com`. CI #457 has exhausted/pre-step blocked hosted runs; **do not interpret a zero-step run as test failure or pass**. Real Postgres migrations, C01 auth API, C02 send, two-device consent/revocation, 10k paginated throughput, Android/iOS release builds, Firebase/notifications, offline/network qualification, WCAG/RTL, providers and production are unverified.
- No tokens/secrets or real account data used. No production, payment, crypto, media, WhatsApp/Telegram or device interactions performed.

## Integration dependency and executable next gates

1. Preserve canonical **F14/C01 #468** schema 0016 and its paginated authenticated `/messages/contacts/page` endpoint/controller, reconcile migration and server route composition in Work #497. Validate its cursor membership, blocked/revoked visibility and concurrent page mutation with disposable PostgreSQL and negative cross-tenant cases. Do not reimplement C01 from U21.
2. Preserve **F15/C02 #472** canonical migration 0017 and authorized human conversation open/send. Do not import duplicate #475 schema. Continue F12/R17+C08 #493/Work #497 exclusive owner for the **Talks · Chats · Assistant · Wallet · Agents** navigation and Contacts nested `/messages/contacts` route. Preserve Firebase #461.
3. In an actual composite checkout with Flutter/Dart, execute `cd apps/mobile && flutter pub get && flutter analyze && flutter test test/contact_hub_screen_test.dart`, followed by C01/C02 Flutter/Gateway tests and disposable PG. Inspect the reported compiler error resolution and all **13 authored widget tests**, fix anything real compilation/runtime exposes; do not presume green from static checks.
4. Real A/B/C authenticated handsets: accepted people before DM, one authorized C02 thread, per-account favorites, 10k paginated row list, empty/offline/page retry, account switch/logout stale response rejection, revoked/blocked send denial, restart/notification/permission and accessibility; document actual readback and Android low-memory results. Review final shipping gate and rollback with one integration owner.
5. Keep U21 draft/unmerged until integration/CI/device/provider gates are genuinely green. Recheck **all live claims and branch SHAs** before any integrator writes. In particular do not overwrite U24 request UX, F14 relationship authority, C03/C05 history/outbox or shared F12 navigation.

**Remaining source/integration gaps:** U21 still depends on C01/C02 composition into a single build and global F12 route. It does not implement full 10k server search/indexing or consented phonebook (U22); source completeness of upstream authorities, platform compilation and end-to-end behavior are unresolved. Overall **PARTIAL_IMPLEMENTATION** despite the bounded repair.

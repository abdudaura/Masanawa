# F14 / C01 continuation — cursor-paginated real human contacts (2026-10-08)

**STATUS: PARTIAL_IMPLEMENTATION · SOURCE/TARGET UNVERIFIED · DRAFT/UNMERGED · NOT DEPLOYED.** Do **not** label C01 or U21 DONE. This is a continuation of **existing C01 PR #468**: https://github.com/Baatiku/masanawa/pull/468, not an independent contacts schema or a new conflicting PR.

## Ownership / immutable repository checkpoint

- Scope: **F14**, canonical **C01** contact identity/admission/readback, plus backward-compatible C01 Flutter presentation; U21 retains owner role for production Contacts Hub UX, F12 owns five-tab root, F15 owns C02 messaging, F08 owns safety graph. The five-minute C01 historical claim was stale before re-claim; our fresh claim was pushed at `f56531d56570b786f6e7041be466073188d80bbc`.
- Current `main` inspected at claim: `5e758673ae91082520b21b3153da53791ae2cbf3` (2026-10-08); original existing C01 branch source prior to this window: `f8c5973437090e3aec38fd7bd4ac4376ae050f42`.
- Branch `work/c01-private-contact-admission-20261008`; source implementation/test checkpoint before this handoff: `9033ea59742e60532c63feef60529587cc2b6fba`. Handoff commit's final branch HEAD is recorded in the PR body (SHA cannot self-reference).
- Only these files have been changed by this continuation: `services/gateway/src/human_contacts/model.ts`, `service.ts`, `routes.ts`, `postgres_repository.ts`, the four matching `{service,routes,postgres_repository,postgres_integration}.test.ts` files; `apps/mobile/lib/src/messages/human_contacts_{transport,controller,screen}.dart`; the three corresponding `apps/mobile/test/human_contacts_{transport,controller,screen}_test.dart` files; and this handoff. **No edits** to shared Gateway `app.ts/main.ts`, schema migrations, central Flutter router, Firebase, native assets, CI, production credentials, financial ledgers or human DM storage.

## Actual authored implementation (source evidence, not execution)

1. **PostgreSQL**: reuse existing C01 `talks.human_dm_contact_requests`, public profiles, active identity, reciprocal block and profile-moderation checks; page by canonical `(updated_at DESC, other.user_id ASC)` keyset, rather than OFFSET and without second schema/migration. Return `limit+1` projection to determine whether next page exists; serialize UTC six-digit microseconds via SQL `to_char` to prevent missing rows with sub-millisecond timestamps. Preserve current C01 legacy `list` method.
2. **Gateway model/service**: additive `listPage` repository method and `HumanContactPage`; `GET /messages/contacts/page?limit=1..100&cursor=...` in existing authorized C01 routes. Strict optional canonical base64url cursor, bounds, exact tenant+actor match on every authenticated request. Cursors indicate a position **only**, never a permission to see a person; all active/visibility/block rules reevaluate on every read. Reject invalid/other-account cursors; preserve original `GET /messages/contacts` response without modification.
3. **Flutter**: additive typed `HumanContactsPaginationTransport` without breaking existing C01/U21 `HumanContactsTransport` adapters; bearer-authorized pages with strict DTO parsing and bounded cursor/limit. Existing C01 controller now performs paged refresh/load-more with owner and read-epoch fencing, deduplicated user IDs, and no invented success on retry/format failure. Existing nested C01 screen has visible server-backed **Load more contacts**. No phonebook upload, no new root tab, and no DM authorization or financial action changed.
4. **Regression tests authored**: unit HTTP/malformed/foreign-cursor checks, SQL exact-tie and microsecond ordering, tenant and reciprocal-block predicate assertions, opt-in *real disposable PostgreSQL* paginated multiple contacts and negative block/tenant case, Flutter DTO bearer/invalid-response tests, controller logout/race/retry tests and screen's load-more interaction.

## Verification executed versus remaining

- **Executed source-level checks only:** GitHub successfully accepted commit writes and fresh `fetch_file` readback of modified server/Flutter files, including confirmation repaired Flutter transport contains exactly one Gateway transport class and original legacy methods. This establishes source presence **only**, not compile, test or integration pass.
- **Not executed in this session:** pnpm install/typecheck/Vitest; PostgreSQL migrations or real DB tests; Flutter analyzer/widget tests; APK/device; network/auth integration with real A/B/C users; account switch, physical restart, permission and 10,000-person low-memory qualification. CI #457 Actions runner/quota still unresolved. **All executable test results = NOT RUN, not PASS.**
- Work should run after restoring a full checkout with dependencies:
  ```bash
  pnpm exec vitest run services/gateway/src/human_contacts/service.test.ts services/gateway/src/human_contacts/routes.test.ts services/gateway/src/human_contacts/postgres_repository.test.ts
  pnpm -r typecheck
  MASANAWA_C01_ENABLE_DB_TESTS=yes MASANAWA_C01_TEST_DATABASE_URL=postgresql://<disposable-user>:<password>@127.0.0.1:5432/masanawa_c01_test pnpm exec vitest run services/gateway/src/human_contacts/postgres_integration.test.ts
  cd apps/mobile
  flutter pub get
  flutter analyze
  flutter test test/human_contacts_transport_test.dart test/human_contacts_controller_test.dart test/human_contacts_screen_test.dart
  ```
  Use **only** local disposable `*_test` PG database; preserve the environment guard. Never run migrations against live/production data in qualification. Run complete Gateway/Flutter regression after source integration, and Android 320dp low-RAM Contacts scroll, app process kill/restart and 10k-contact fixture tests.

## Known source/integration limitations and Work's exact next steps

- **C01 itself is unmerged** with real Gateway composition changes; canonical migration `0016` must be applied in correct ordering after R18 `0015`, then canonical C02 `0017`, C04 `0018` as qualified. F14 has not wired a live deployed route and has not verified an actual DB.
- **Collision risk**: C01 #468 vs R18 avatar #435 both edit Gateway `app.ts/main.ts`; Work #497 owns broader composition, five-tab navigation and Firebase #461 preservation. Rebase/cherry-pick this branch semantically after those files are reconciled. **Do not overwrite** U24 request/privacy UI PR #510, which is stacked on C01 and touches same C01 screen/controller; manually merge its new actions and this pagination. U21 Contacts Hub already offers separate lazy contact screen but needs its authoritative adapter to consume `page`, not truncate after 50 contacts. Do not duplicate pagination in U21.
- **Boundary**: Original U21 Contacts Hub, `/messages/contacts` route via F12, C02 real DM compose/send, U24 privacy action states, 10k lazy alphabetical search, cursor deletion/new-invite races and legitimate real A/B acceptance/revoke events remain **PARTIAL** pending integrated verification. Cursor is account-scoped but not an immutable snapshot; edits between pages can reorder results; client deduplicates but Work must verify user-facing pagination under concurrent accept/revoke. It is not a signed access token and must never be treated as one.
- **Work sequence**: review this SHA and validate source in a clean checkout; reconcile stacked U24, R18, C02 and Work #497; compose existing C01 endpoint through one Gateway bootstrap; run migration manifest in a disposable PG DB, Vitest/typecheck, Flutter analyze/widget, multi-user auth tests and Android; qualify pagination with 10k accepted contacts plus revoked/hidden/suspended tenants; resolve CI #457; keep PR draft until evidence supports merge, then promote only verified slices in dependency order. No merge, deployment, production enabling or Firebase secrets changes performed here.

**Overall**: `SOURCE_AUTHORED=yes`, `TESTS_AUTHORED=yes`, `EXECUTABLE_TESTS_RUN=no`, `DB_E2E=no`, `APP_E2E=no`, `DEVICE_VERIFIED=no`, `DEPLOYED=no`, `MERGED=no`. **PARTIAL_IMPLEMENTATION**, not DONE.


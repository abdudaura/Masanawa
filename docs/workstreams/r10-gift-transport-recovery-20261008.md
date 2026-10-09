# R10 — Gift transport and restart recovery (2026-10-08)

Owner: ChatGPT implementation window, scoped R10 recovery follow-up to merged PR #418.
Branch: `work/r10-gift-transport-recovery-20261008`.
Base: latest observed `main` SHA `5d19afc952b3dcabd18ee8f8d1c3ad13b72e6762`.
Claim created: 2026-10-08 ~11:51 Africa/Lagos. Five-minute repository-visible activity lease per `docs/MULTI-WINDOW-WORK.md`.

## Exact claimed files
- `apps/mobile/lib/src/talks/talk_gift_http_transport.dart`
- `apps/mobile/lib/src/talks/talk_gift_pending_store.dart`
- `apps/mobile/test/talk_gift_pending_store_test.dart`
- `apps/mobile/test/talk_gift_http_transport_test.dart`
- `apps/mobile/lib/src/talks/talk_gift.dart`
- `apps/mobile/test/talk_gift_models_test.dart`
- `docs/workstreams/r10-gift-transport-recovery-20261008.md`

No shared Gateway composer, ledger, migration, R09 stage fan-out, shell or CI ownership. Review any concurrent gift PR before shared edits.

## Findings / implementation plan
Merged main contains invalid Dart syntax in both gift transport (duplicated trailing method/class fragment; malformed request ID regex) and pending encrypted store (unterminated raw RegExp and duplicate trailing fragment). Gift request IDs must persist encrypted before POST and remain pending after an uncertain result. Restore compilable code, preserve the exact account-scoped retry semantics and add validation / restart / mismatch tests. This is a R10 **partial implementation lane**; real canonical server receipt lookup following ended Talk/repricing still needs integration-owned ledger read interface and must not be claimed complete.

Acceptance: no gift POST after missing signed-in owner or secure-storage failure; same ID on process restart; no new ID on ambiguous lost response; receipt mismatch cannot create success; successful write-back allows a new deliberate gift; actual Flutter/analyzer and two-handset Credits checks remain unverified until executed.

Requirement trace: T05, T07, W12, P04; J05. CI incident: #457, runner minutes exhausted. Keep PR draft/unmerged.

## Contract discovery
Server-side qualified gift catalog already returns an empty `items` array when no options are available, but `TalkGiftCatalog.fromJson` on `main` rejects an empty list. This is an end-to-end empty-state defect: preserve the valid empty response so the gift sheet can truthfully show unavailability rather than a parser error. Include focused model and HTTP regression coverage.

## Source checkpoint — 2026-10-08

Work branch commit before this checkpoint: `a74aef661ac9757a93b0e5a82d57cdfa63237b10`. Base `main` remains `5d19afc952b3dcabd18ee8f8d1c3ad13b72e6762`; branch is 13 commits ahead, zero behind at comparison. Changed files are the seven exact declared paths; no shared Gateway/finance/root/navigation edits.

### Implemented source
- Removed an accidentally duplicated trailing portion of `talk_gift_http_transport.dart` (108 deleted lines) and malformed `RegExp` expressions, restoring a single transport implementation with anchored safe persisted request-ID validation.
- Removed the duplicate trailing body in `talk_gift_pending_store.dart` and corrected its full-match validation for `pending:<id>` / `completed:<id>`. Secure persisted ID remains mandatory in the signed-in production provider, and persistence failure is not ignored.
- Fixed mobile catalog DTO to accept `items: []`, which the already-registered Gateway legitimately sends when no gift is qualified. This enables the existing no-gifts bottom-sheet state instead of surfacing a corrupt-response error. Invalid types, 25+ options, duplicates and unsupported prices still fail closed.
- Added/extended Dart unit regression cases for empty Gateway catalog, invalid/oversized catalog, forged request marker with no POST, account switch mid-response retaining the original pending request ID, and retry after re-authentication. Previous crash/restart and same-request idempotency tests remain.

### Evidence, blockers and Work handoff
- **Executed evidence:** GitHub API commit readback and structural/source comparison only: exactly one `GatewayTalkGiftTransport` and `sendGift`, repaired anchored `RegExp` expressions, no trailing corruption markers, 7 changed owned paths; no executed language toolchain or real HTTP/device acceptance.
- **Blocked/unexecuted:** Flutter SDK and a checked-out runnable project are unavailable in this connector runtime. Independently, [issue #457](https://github.com/Baatiku/masanawa/issues/457) documents zero-step GitHub Actions runs, so CI red is not test evidence. Do not re-run exhausted CI as a substitute for local verification.
- **Work next commands:** on checked-out PR head, run `cd apps/mobile && flutter pub get && dart format --output=none --set-exit-if-changed lib/src/talks/talk_gift_http_transport.dart lib/src/talks/talk_gift_pending_store.dart lib/src/talks/talk_gift.dart test/talk_gift_models_test.dart test/talk_gift_http_transport_test.dart test/talk_gift_pending_store_test.dart && flutter analyze && flutter test test/talk_gift_models_test.dart test/talk_gift_http_transport_test.dart test/talk_gift_pending_store_test.dart test/talk_gift_stage_overlay_test.dart test/talk_screen_test.dart`; investigate/fix any failures without removing assertions. Then full mobile test suite and real Android debug/release build.
- **Live qualification:** signed-in A and Host B; server-provided empty catalog must show unavailable, never POST; simulate loss after B receives Credits, kill/relaunch A and retry same ID (no second debit); switch account during in-flight settlement (never reattribute state); deny secure store read/write, change catalog price, end/unpublish Talk, confirm no deceptive payment-success state. Verify Wallet/Activity against canonical ledger and actual server revision.
- **Status:** Owned R10 mobile contract/parse-repair source is `IMPLEMENTED_UNVERIFIED`; **full R10 is still `PARTIAL_IMPLEMENTATION`**. Canonical receipt status lookup after an ambiguous debit followed by Talk end/repricing, actual gift outbox broadcast to both handsets, catalog policy persistence/localization, and real settlement/devices remain open. Coordinate any further ledger/Gateway changes with financial and integration owners; do not add a second payment authority.
- **Merge decision:** Keep draft/unmerged. ChatGPT Work must execute checks, repair issues, review access/financial behavior, and merge only when verified; no use of this branch as deployed truth.

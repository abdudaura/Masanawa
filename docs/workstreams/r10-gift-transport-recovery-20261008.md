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

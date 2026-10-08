# R04 AI Seat catalog and confirmation correctness

Owner: ChatGPT R04 paid AI-Seat safety implementation window, 2026-10-08
Branch: `work/r04-ai-seat-catalog-confirm-safety-20261008`
Base SHA: `265f2c5f6db81d076f57ca32dd47db3ff7fb0ad6`
References: R03/R04 in MOBILE-READINESS-PLAN.md and the canonical TALKS-PRODUCT.md AI quote/confirmation requirements.
Owned paths: `apps/mobile/lib/src/talks/talk_ai_seat.dart`, `apps/mobile/lib/src/talks/talk_ai_seat_http_transport.dart`, `apps/mobile/lib/src/screens/talks/add_ai_seat_sheet.dart`, `apps/mobile/test/talk_ai_seat_models_test.dart`, `apps/mobile/test/talk_ai_seat_http_transport_test.dart`, `apps/mobile/test/talk_ai_seat_sheet_test.dart`, `docs/workstreams/r04-ai-seat-catalog-confirm-safety-20261008.md`.
Dependencies: existing server quote/confirm and candidate availability; no changes to shared commerce, Gateway, migrations, R17 root-shell, theme or localization paths.
Scope: do not conceal HTTP 404 catalog-routing failure as an empty catalog; fail closed on absent availability; stale/expired quote cannot be submitted silently, re-quote via explicit action. Confirm errors must never falsely guarantee no duplicate request when server status is unknown.
Current step: claim published before code changes. Implement/review/test source; separate code vs CI vs handset evidence. Last update 2026-10-08.

## Implementation checkpoint

AI Seat catalog now fails closed on omitted or malformed `isAvailable` (only explicit boolean `true` can enable action). Malformed identity/kind are rejected rather than silently assuming an Expert. Gateway 404 and malformed catalog responses are not hidden as an empty available-persona list, so backend deployment problems produce the existing actionable error/retry state.

Paid quote parsing requires nonempty quote/persona/price, valid expiry, valid Expert/Twin kind, a recognized Host/Sponsor mode, and matching Host-approval requirement. Selection rechecks persona ID, type, mode, fee, approval and quote expiry against the chosen candidate before showing payable confirmation. A timer disables confirmation at expiry; a deliberate Get new quote action fetches current server terms. Expired/declined server outcomes are terminal for the old quote, not false success; unknown confirmation/transport timeout does not assert that payment failed or a duplicate wasn't sent. Successful confirmation requires a nonempty server request ID.

Focused tests added/extended: `talk_ai_seat_models_test.dart`, `talk_ai_seat_http_transport_test.dart`, `talk_ai_seat_sheet_test.dart` covering false defaults, bad persona/quote IDs, approval mismatch, true empty catalog versus HTTP 404, bad catalog entries, quote expiry and renewal, wrong persona quote, server expired/declined status, and unknown status after confirmation timeout.

**Verification status:** source/commit readback completed, but Dart/Flutter tests, lint/format and Android device tests were NOT executed because this connector session has no Flutter SDK. Production/deployment: NOT done. Do not merge this as release-qualified until CI-enabled checks pass. Server quote/settlement remain canonical; no commerce contracts or migrations changed. User's R04 Create/Host pre-Talk selection and persisted invitations are still OPEN and require separate shared-integration ownership.

Latest branch commits include `b8a5374`, `f70eaf8`, `b82034c`, `ad7de44`, `c9c574f`, `ab86868`, `f325651`, `202583b`, `3ef96d5`, `6625a87`.

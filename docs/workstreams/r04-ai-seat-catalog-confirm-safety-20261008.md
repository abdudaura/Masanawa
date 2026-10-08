# R04 AI Seat catalog and confirmation correctness

Owner: ChatGPT R04 paid AI-Seat safety implementation window, 2026-10-08
Branch: `work/r04-ai-seat-catalog-confirm-safety-20261008`
Base SHA: `265f2c5f6db81d076f57ca32dd47db3ff7fb0ad6`
References: R03/R04 in MOBILE-READINESS-PLAN.md and the canonical TALKS-PRODUCT.md AI quote/confirmation requirements.
Owned paths: `apps/mobile/lib/src/talks/talk_ai_seat.dart`, `apps/mobile/lib/src/talks/talk_ai_seat_http_transport.dart`, `apps/mobile/lib/src/screens/talks/add_ai_seat_sheet.dart`, `apps/mobile/test/talk_ai_seat_models_test.dart`, `apps/mobile/test/talk_ai_seat_http_transport_test.dart`, `apps/mobile/test/talk_ai_seat_sheet_test.dart`, `docs/workstreams/r04-ai-seat-catalog-confirm-safety-20261008.md`.
Dependencies: existing server quote/confirm and candidate availability; no changes to shared commerce, Gateway, migrations, R17 root-shell, theme or localization paths.
Scope: do not conceal HTTP 404 catalog-routing failure as an empty catalog; fail closed on absent availability; stale/expired quote cannot be submitted silently, re-quote via explicit action. Confirm errors must never falsely guarantee no duplicate request when server status is unknown.
Current step: claim published before code changes. Implement/review/test source; separate code vs CI vs handset evidence. Last update 2026-10-08.

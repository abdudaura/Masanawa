# R10 — Gift catalog and settlement-backed stage feedback

Owner/window: ChatGPT R10 implementation window (2026-10-08).
Branch: `work/r10-gift-catalog-stage-feedback-20261008`
Base main SHA: `265f2c5f6db81d076f57ca32dd47db3ff7fb0ad6`
Task: R10 in `docs/MOBILE-READINESS-PLAN.md`.
Last verified PR activity: 2026-10-08T05:16:01Z (GitHub PR metadata; use latest commit/PR activity for five-minute lease).
Status: PARTIAL — source committed in draft PR #418; checks/release acceptance OPEN.
Implementation head before this checkpoint: `83ace24a87f5641c1ad7bc75a19e73746fb9b396`.
Verification: source readback, branch-scope comparison and automated test cases authored; tests NOT EXECUTED.
Deployment/device/actual settlement: NOT DONE.

## Exact owned paths
- `services/gateway/src/talk_gifts/model.ts`
- `services/gateway/src/talk_gifts/service.ts`
- `services/gateway/src/talk_gift_routes.ts`
- `services/gateway/src/talk_gift_routes.test.ts` (focused catalog and settlement tests)
- `apps/mobile/lib/src/talks/talk_gift.dart`
- `apps/mobile/lib/src/talks/talk_gift_http_transport.dart`
- `apps/mobile/lib/src/screens/talks/talk_gift_sheet.dart`
- `apps/mobile/lib/src/screens/talks/talk_screen.dart` (gift-only code)
- `apps/mobile/lib/src/screens/talks/talk_gift_stage_overlay.dart` (new)
- `apps/mobile/test/talk_screen_test.dart` (gift test fake and focused gift assertions)
- `apps/mobile/test/talk_gift_http_transport_test.dart`
- `apps/mobile/test/talk_gift_models_test.dart` (new)
- `apps/mobile/test/talk_gift_stage_overlay_test.dart` (new)
- `docs/workstreams/r10-gift-catalog-stage-feedback-20261008.md`

## Boundaries and dependencies
No Gateway main composition, shared ledger, migration, root shell, billing/crypto, theme, localization or R09 runtime context changes. Reuse canonical gift transaction authority; no optimistic settlement animations or fabricated prices. Coordinate with R01 light theme, R06 Credits and R09 event context; this lane does not claim their paths.

## Implementation checkpoint (2026-10-08)

- Draft PR: https://github.com/Baatiku/masanawa/pull/418. Do not merge as release-qualified without tests and reviewer sign-off.
- Gateway exposes `GET /talks/:talkId/gifts/catalog` under session authorization, checks Talk eligibility and forbids Host self-gift. Six initial icon/amount options are server defaults, validated and injectable through service catalog policy. **Admin/market persistence is not implemented**.
- `POST /talks/:talkId/gifts` accepts optional stable option ID, rejects unavailable/mismatched prices and client-supplied arbitrary prices even for legacy amount-only APKs, without changing canonical Credit settlement authority. Completed receipt echoes option identity for new callers.
- Flutter reads fresh catalog, shows icon/name/price/recipient and explicit confirmation, handles missing/empty catalog without fabricated options, retains idempotent retry request IDs and rejects mismatch or missing completed settlement status.
- On successfully matched completed receipt, local sender sees bounded stage feedback with a screen-reader live region. Reduced-motion yields static feedback. **No cross-device gift broadcast, AI event injection or fake recipient acknowledgment**; these await authoritative R09 event stream ownership.
- Source readback completed, including repair of a malformed connector string replacement before checkpoint. No current known malformed transport snippet remains.
- Compared branch to original main SHA `265f2c5f6db81d076f57ca32dd47db3ff7fb0ad6`: changes limited to 14 declared R10-owned files. During work main advanced by 7 unrelated commits to `8100723f26ca32faabbeaf6e07bcaa27144013f9`; PR #418 reports mergeable at last check, but branch is 7 behind main.

## Test/evidence state

- New/extended Gateway route tests cover auth, self-gift, catalog, ID/price validation, arbitrary legacy prices and authority-injection rejection.
- New/extended Flutter tests cover catalog parsing, duplicate/invalid options, transport identity, uncertain/mismatched/incomplete receipts, missing catalog and reduced-motion stage feedback.
- **No Vitest/TypeScript/Flutter analyzer or widget test has run in this connector environment.** Do not say tests passed. No real Credits, recipient handset, Talk audio or deployment evidence.
- GitHub PR #418 Actions Mobile Build #37731467740 and Foundation CI #37731467807 concluded failure; their jobs expose `steps=null` and `logs_url=null`, so they provide **no evidence of application test failure or success**.
- Required next: run focused `services/gateway/src/talk_gift_routes.test.ts`, focused Flutter gift and Talk screen tests, typecheck/analyzer, full suites, and real handset/accessibility/real-settlement checks using a trusted runner. Reconcile recent main before merging.

## Remaining substantive R10 gates

- R09 authoritative Talk event/outbox fan-out to Host, Audience and AI context with dedupe, bounded animations and safe reconnects; never fabricate ledger success client-side.
- Durable admin/market catalog configuration and artwork localization, coordinated with R06 Credits pricing and R11 locale.
- Verification that gift feedback does not interrupt LiveKit audio under long sessions and low-power devices, and confirmation/receipt after disconnection and restart.

## Current step

Implementation branch is recoverable in draft PR #418. Preserve R10 boundary; another non-overlapping window can take next lane without modifying these unfinished files.

## Handoff policy
Record exact branch HEAD, tests executed vs unexecuted and unresolved provider/device/AI-event dependencies before leaving. Do not mark R10 release accepted without real-device and server settlement evidence.

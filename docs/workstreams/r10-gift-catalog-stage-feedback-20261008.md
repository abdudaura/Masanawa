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
- `apps/mobile/lib/src/talks/talk_gift_pending_store.dart` (new: durable, per-account encrypted pending request IDs)
- `apps/mobile/lib/src/state/talk_gift_state.dart` (gift-only persistence wiring)
- `apps/mobile/test/talk_gift_pending_store_test.dart` (new: durable recovery/race coverage)
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

Continuing R10: harden account-scoped persistence to survive app restarts after an ambiguous payment. Implementation branch is recoverable in draft PR #418. Preserve R10 boundary; another non-overlapping window can take next lane without modifying these unfinished files.

## Continuation checkpoint — durable gift safety and live catalog (2026-10-08)

Latest implementation SHA before this checkpoint: `732879b6538ee766e241950bc15628da63bd4716`.
PR #418: `https://github.com/Baatiku/masanawa/pull/418`.

- Existing mobile retry ID cache was **only in memory**, risking new debit IDs after a crash or an uncertain server response. New encrypted `SecureTalkGiftPendingStore` persists `pending:<id>` **before** HTTP POST, scoped to authenticated account + talk/option/amount. A reinstalled process recovers the same ID; a confirmed completed response advances to `completed:<id>` so the next deliberate send can use a fresh ID. Failed/missing secure storage never falls back to a new money request.
- In-flight same-option requests share one Future, preventing client double-taps from racing different IDs. Generated IDs include cryptographically secure entropy; no account/token data is embedded in the request ID. Transport checks for account changes during secure IO and before issuing a POST.
- Added crash/restart, lost receipt, second intentional gift, concurrent confirmation, account-switch, malformed-record and secure-storage-failure regression tests in `apps/mobile/test/talk_gift_pending_store_test.dart`. Tests are **authored and committed, NOT executed**.
- Added `TalkGiftCatalogSource` extension point for exact tenant/Talk-qualified server policy. Every catalog GET and POST re-reads live authoritative options, checks selection and price before settlement. Dynamic reprice, empty catalog and policy-source outage tests prove **intended fail-closed behavior**; they still need execution. Production composition currently uses validated server-side launch defaults because an admin/persistent policy source has not yet been wired.
- The Gift sheet now advises checking authoritative Wallet history, not recipient Activity, after an uncertain response. R09 owner was notified in PR #417 that eventual shared stage animation/AI event must originate from authoritative settled gift outbox, not local optimistic events. This R10 lane does not change R09 worker code.
- Latest observed CI for PR #418 continues failing before runner steps; no typecheck, Vitest, Flutter tests, APK build, real Credits settlement or handset check has passed in this environment.
- Main advanced during the lane. Before merge, reconcile current main, execute full relevant checks, review any checkout conflicts, and qualify sender/recipient behavior after lost responses. Do not use a mergeable GitHub metadata flag as a substitute for these release gates.

**Integration status:** Source on draft PR #418, no release deployment, no executed tests, no merge. Remains R10 PARTIAL.

## Handoff policy
Record exact branch HEAD, tests executed vs unexecuted and unresolved provider/device/AI-event dependencies before leaving. Do not mark R10 release accepted without real-device and server settlement evidence.

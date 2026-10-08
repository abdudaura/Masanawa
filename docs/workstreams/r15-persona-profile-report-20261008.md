# R15 — Public Expert/Twin persona safety reporting — Work integration handoff

Updated: 2026-10-08 (Africa/Lagos). Owner: GPT-6 feature window.
**Status: IMPLEMENTED_UNVERIFIED for the bounded persona-profile report entry. R15 overall: PARTIAL_IMPLEMENTATION / NOT DONE.**
Five-minute claim: last visible commit on this branch; carefully reclaim only after five minutes without visible branch activity and after reviewing #489.
Base `main`: `1d6a67ea3c182455b55a7d1d07eacdb4311682e3`.
Feature branch: `work/r15-persona-profile-report-20261008-gpt6`.
Latest reviewed implementation/test commit before handoff: `7815ebbba3422a6eb5fddd524fcba5c768982ca1`.
Final branch HEAD: see live [draft PR #489](https://github.com/Baatiku/masanawa/pull/489) (handoff commit necessarily follows the implementation SHA).
PR: [#489](https://github.com/Baatiku/masanawa/pull/489), **draft/unmerged**, against current main.
Trace: R15; T05, N05, P05, M10, Q privacy/security; integrated journeys J06/J11 (persona discovery/safety isolation). **No credit towards full R15/J11 acceptance.**

## Late-discovered concurrent duplicate: MERGE STOP (#491)

**At this checkpoint, a second active independent R15 persona-report PR [#491](https://github.com/Baatiku/masanawa/pull/491) emerged at virtually the same time as #489. Both originated from the exact same main SHA; #489 opened at 11:48:36Z and #491 at 11:48:54Z on 2026-10-08. This is an ownership collision requiring integration reconciliation, not permission to merge either or delete historical work.** Current observed #491 head `5fe1fa31791d2c742d79b4d12bef3847fbc7a10f`; its branch is `work/r15-persona-reporting-20261008-gpt6`. #489 base/main `1d6a67ea3c182455b55a7d1d07eacdb4311682e3`.

**Precisely overlapping paths**: persona public profile screen, new persona report sheet, talk safety transport/interface. **Unique #489 assets**: `apps/mobile/test/persona_report_flow_test.dart`, `services/gateway/src/talk_safety_routes.test.ts` persona HTTP auth/target validation, secure UUIDv7-style request IDs from `createRequestId()`, and more explicit bounded error copy. **Unique #491 assets**: account/persona-scoped encrypted local pending-report journal `persona_report_journal.dart` for crash recovery, session-switch guards, server 202/receipt body validation, stronger target/request validation, and extra Flutter/Gateway tests. #491 generates its initial report ID with timestamp + in-process counter instead of secure randomness; when reconciling prefer #489's `createRequestId()` secure factory. Consider combining the best validated tests and retry semantics, preserving deletion/privacy boundaries and Android keystore evidence. This handoff names differences from a **static diff review only**, not test evidence.

**Mandatory final Work action:** Compare #489 and #491 **before any cherry-pick**; select one authoritative persona report client contract/implementation (favor full account-scoped journal and receipt checks if verified), carry over secure request IDs and unique negative tests, run both suites and actual Postgres/Android checks at integrated SHA. Avoid applying both variants as separate report flows. Leave both DRAFT / UNMERGED while unresolved; #489 is **superseded pending reconciliation** and its source is NOT approved for independent merging. Source status of this branch remains as previously written, but overall release status remains UNVERIFIED and R15 PARTIAL.

## Scope, claims and non-overlap

Exact modified/created source:
- `apps/mobile/lib/src/screens/profile/persona_profile_screen.dart` — Adds a real Report action on publicly resolved Expert and Twin profiles; existing profile load/availability paths still apply.
- `apps/mobile/lib/src/screens/profile/persona_report_sheet.dart` (new) — Explicit reason, optional detail, progress, sanitized server failure, safe retry, receipt and close. No auto-speech, payment, or unilateral moderation.
- `apps/mobile/lib/src/talks/talk_safety.dart` — Extends existing canonical reportTarget contract with optional `clientRequestId` for backward-compatible callers.
- `apps/mobile/lib/src/talks/talk_safety_http_transport.dart` — Uses existing authenticated `ApiClient` and canonical `/safety/reports`; transmits stable request ID when supplied, secure-generated fallback for existing callers.
- `apps/mobile/test/persona_report_flow_test.dart` (new) — Focused widget/authenticated HTTP contract tests.
- `services/gateway/src/talk_safety_routes.test.ts` — Adds route boundary tests for authenticated persona reports, unauthenticated rejection and wrong-domain target rejection.
- This handoff.

**No new migration or backend route was required**: existing `packages/talks/migrations/0009_talk_safety.sql` owns `talks.safety_reports` (tenant,reporter,request-ID uniqueness); `services/gateway/src/talk_safety_routes.ts` already declares `POST /safety/reports` with `targetKind=persona` and strict type/length schema; `services/gateway/src/talk_safety/service.ts` performs canonical customer-session authorization; `services/gateway/src/talk_safety/repository.ts` returns existing report ID on idempotent insert; `services/gateway/src/app.ts` and `main.ts` conditionally compose the service from real Postgres/session authority. This is **integration of existing implemented code**, not a second reporting service/table.

Other R15 owners: #443 (AI Seat), #446 (gift safety), #450 (replay visibility), #451 (channels) touch different files. R18 #435 touches profile *edit* and shared Gateway; R17/C08 shell owner remains exclusive. C01 #468 shares Gateway composer but is not modified. CI issue #457 / PR #460 coordination remains exclusive. C02 #472/#475 and C05 #474/#476 conflicts belong to final Work integrator, not this feature.

## Input → authority → durable outcome → recovery

1. User visits existing `PersonaProfileScreen` for a server-resolved public Expert/Twin. Taps **Report this AI persona**. The report sheet names that profile. No auto-report or accusation.
2. User selects one of the **server-enumerated reasons**, may enter <=2000 characters, and explicitly taps Send. Absence of reason leaves send disabled.
3. On first attempt only, Flutter freezes reason/detail and a cryptographically randomized request ID from `createRequestId()`; sends `targetKind:persona`, `targetId:profile.publicId`, exact wire reason/detail and key through existing `ApiClient`, whose session middleware attaches bearer/handles token refresh. API authorizes customer tenant/user, schema-validates and inserts report with once-per-reporter idempotency. Existing SQL test `services/gateway/src/talk_safety/repository.test.ts` covers ON CONFLICT semantics.
4. HTTP 202 means **accepted for review**, not guilt/punishment or enforcement. UI shows receipt only after API resolves. No public Talk, DM, AI action, wallet value or raw sensitive data surfaced outside authenticated report.
5. Timeout, 401, 403, 429, malformed input and other errors display bounded messages. Uncertain request can only be retried with *the same* payload/key while the sheet remains open; fields are read-only after first attempt. Existing session refresh behavior is reused; if sign-in cannot recover, the flow requires reauthentication. Closing cancels local draft; no report is claimed to have been received in that case.
6. A new report after a full app restart receives a new key. **Known qualification risk**: app termination after a committed-but-unacknowledged report may allow a *new* user-initiated report; server idempotency protects same-key retries, not intentionally/newly generated keys after restart. Report review/dedupe policy must be measured before global R15 signoff. No money transfer or irreversibility involved.

## Test evidence versus unexecuted tests

**Executed:** source file fetch, route/service/migration wiring inspection and successful GitHub branch/commit pushes. No Flutter/TypeScript executable tests, PostgreSQL integration, APK or on-device checks ran; do not infer PASS from static review.

**Not executed, required by Work:** environment exposing GitHub file connector has no Dart/Flutter SDK (local runtime `command -v flutter; command -v dart` produced no binary). GitHub Actions #457 documents 2,000/2,000 used included Actions minutes, $0 Actions budget with Stop usage enabled; do not rerun non-starting jobs to manufacture results. Docker/PostgreSQL and two authenticated Android test users/devices not available through this window.

Commands from a fresh Work checkout at this PR HEAD, *not claimed as run*:
```bash
git fetch origin
git checkout work/r15-persona-profile-report-20261008-gpt6
pnpm install --frozen-lockfile
pnpm typecheck
pnpm vitest run services/gateway/src/talk_safety_routes.test.ts services/gateway/src/talk_safety/repository.test.ts services/gateway/src/talk_safety/service.test.ts
cd apps/mobile
flutter pub get
flutter analyze
flutter test test/persona_report_flow_test.dart test/talk_social_profiles_test.dart
flutter test
flutter build apk --debug --dart-define=API_BASE_URL=<isolated-qualified-test-gateway>
```
In test Postgres isolated from production, apply canonical migrations including 0009. With two distinct actual accounts/tenants, verify unauthenticated 401, signed-in persona report 202 + reportId, **exact row only in correct tenant**, same request key returns original reportId without second row, another user cannot see the report, malformed/off-tenant inputs denied, repeat after simulated timeout, sign-out/refresh, Android process kill and flaky network. Confirm destination ID type matches moderated public persona. Review report data retention, reviewer permissions and export/deletion policy with R12/R15, since those broader controls are outside this UI slice. Check low-end 320dp, RTL, large text, screen readers and keyboard insets. Run broader R15 / J11 safety regression and five-tab route tests after final R17/C08 integration.

## Evidence states and blockers

| Gate | State |
|---|---|
| Source written (bounded persona reporting) | YES on draft branch |
| New database migration | N/A — canonical `0009_talk_safety.sql` already defines reporting |
| Backend/API/auth/SQL source integration | EXISTING ON MAIN; static inspection only |
| Flutter UI/transport/retry state | SOURCE WRITTEN, UNEXECUTED |
| Local Flutter/Vitest/analyzer | NOT EXECUTED — SDK/runtime/workspace unavailable |
| CI executed | NO — #457 Actions quota blocker |
| Disposable DB e2e | NOT EXECUTED |
| Android device / two real accounts | NOT EXECUTED |
| Provider financial/Live audio qualification | N/A to this report action |
| Deploy / merge / R15 DONE | NO / NO / NO |

**Missing implementable source within this narrowly claimed UI feature:** none known after static read, but runtime execution may expose compile/integration defects; Work must correct rather than silently merge. **Outside this slice:** complete R15 reporting across other surfaces/moderation, downstream R12 retention and support response, whole-product J06/J11 and Assistant voice-driven report intents (C07) remain independent unfinished gates.

**Rollback:** revert PR #489 Flutter action/transport option and test changes; existing server reporting records are additive; no destructive migration or new irreversible user state introduced. Report reason/detail privacy requires production retention/access audit before release.

## Exact final Work consolidation actions

1. Inspect PR #489 diff, latest HEAD and all relevant live claims. Verify no Flutter `TalkSafetyTransport` implementers break on the optional named argument; adjust call sites or use a compatibility overload if needed. Ensure no R15 conflict in actual branch diff.
2. Run focused Flutter widget, HTTP, analyzer, Gateway route/repository tests above. Fix any compile and layout issues; do not mark a mock-backed widget test as genuine end-to-end.
3. Apply migrations to fresh disposable Postgres, run authorized two-user Gateway safety report → durable row → same-ID retry → tenant/privacy negative checks and restart/timeout cases.
4. Build/install Flutter on two Android accounts; verify real persona ID/selection/report/return path, signed-in refresh/expired token, accessibility, offline failure and no false accepted feedback.
5. Reconcile with R15 safety-review/retention policy and R17/C08 final five-tab routing; document final SHA, executed results and deployment rollback. **Only then consider converting draft and merging.**


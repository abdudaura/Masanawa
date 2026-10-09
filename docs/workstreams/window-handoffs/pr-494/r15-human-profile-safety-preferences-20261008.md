# R15 — Human profile block and mute / SHA-specific final Work handoff

Updated: 2026-10-08 (Africa/Lagos). Owner: GPT-6 independent R15 sublane.
**Status: IMPLEMENTED_UNVERIFIED for this bounded human-profile safety preference feature. Full R15: PARTIAL_IMPLEMENTATION / NOT DONE.**
Claim/lease: separate exact-path claim initially pushed on `ad72e04281b2b2aaa96828a9e2a1528aa4bc1072`; current activity = last branch commit, five-minute ownership reclaim rule applies after inspecting changes.
Base main: `1d6a67ea3c182455b55a7d1d07eacdb4311682e3`.
Branch: `work/r15-human-profile-safety-preferences-20261008-gpt6`.
Last implementation/test commit prior to this handoff: `a11bb4e10dd2ac4269751dd8caefc3b36fb7754e` (includes signed-out stale-action regression); earlier implementation source+tests `29511bf47fbe958b8509c0b6e946044697dd7a2c`.
Final PR HEAD SHA: check live [draft PR #494](https://github.com/Baatiku/masanawa/pull/494) (this handoff commit follows the implementation commit).
PR/issue: [#494](https://github.com/Baatiku/masanawa/pull/494), DRAFT, UNMERGED; #457 Actions infrastructure blocker; R15/T05/M10/J11 acceptance.
A concurrent new [#493](https://github.com/Baatiku/masanawa/pull/493) claims R17/C08 shared five-tab shell; live PR file inspection confirmed it does not touch these scoped human-profile source paths at handoff. The final Work integrator must recheck immediately before merging.\n\nOther separate R15 persona-report PRs: [#489](https://github.com/Baatiku/masanawa/pull/489) and [#491](https://github.com/Baatiku/masanawa/pull/491) are **mutually overlapping duplicates** with MERGE STOP. This #494 human-profile preference scope DOES NOT modify any of their exact paths. Other R15 server owners #443, #446, #450, #451 do not edit these paths as inspected.

## Exact scope by layer

1. `apps/mobile/lib/src/screens/profile/person_profile_screen.dart` — adds an explicit shield control on real, fetched **human** profile (not AI persona or public Talk). Opens scoped settings modal with canonical handle already from the real authenticated profile API. Existing Following / Talk / Twin navigation remains unaltered.
2. `apps/mobile/lib/src/screens/profile/human_profile_safety_sheet.dart` — reasoned privacy UI with real server GET, independent block/mute switches, a single in-flight update, read-after-write confirmation and no optimistic "saved" state. Uncertain transport failure freezes both editing controls and forces GET reconciliation before changing state. Retains per-sheet session user identity; if user signs out or switches accounts, blocks further actions and does not show another account's new server result. Reopening after restart always loads the authoritative server state; no client-only persistence. Returning via Close does not claim successful changes.
3. `apps/mobile/lib/src/social/human_profile_safety_transport.dart` — new **typed adapter** over existing `ApiClient`; transport normalizes/validates public handle; calls existing authenticated `GET/PUT /safety/profiles/:handle/preference`, validates `blocked` and `muted` are actual bools (fail-closed malformed payloads), sends both desired booleans (not an irreversible toggle).
4. `apps/mobile/test/human_profile_safety_test.dart` — Flutter state + profile entry + committed-but-response-lost retry/reconcile + stale-account sign-out fencing + real bearer HTTP wire integration tests using test doubles for network/auth (not production mocks).
5. `services/gateway/src/talk_safety/human_profile_preference_routes.test.ts` — Fastify-level route contract tests for 401 unauthenticated, two-tenant isolation, separate block/mute persistence, idempotent replay of desired state, 404 unknown handle and 400 malformed input. These use an isolated test repository to verify route+service code; they are **not** real PostgreSQL e2e proof.
6. This handoff file. No modifications to shared app/router/Gateway composition, profile **edit** source, finance, C02 data, report persona #489/#491, or CI.

**Schema/backend/API/auth were already implemented on `main` and reused, not rewritten:** `packages/talks/migrations/0009_talk_safety.sql` creates `talks.safety_preferences` with primary key `(tenant_id,viewer_user_id,subject_user_id)` and self-block CHECK; `services/gateway/src/talk_safety_routes.ts` GET/PUT routes validate handles/body; `services/gateway/src/talk_safety/service.ts` derives tenant+viewer exclusively from customer session, resolves subject via tenant-scoped `public_profiles` handle, applies canonical normalization; `services/gateway/src/talk_safety/repository.ts` upserts desired-state row; `services/gateway/src/main.ts` & `app.ts` conditionally register database-backed safety service. Existing `talk_safety/service.test.ts`, `repository.test.ts` and route tests remain prerequisites. No migration slot allocated or unapplied schema invented.

## Real flow, safeguards and recovery

Entry: authenticated user visits a real human public profile. Taps shield action. Loads current account's server preference; on fetch failure shows honest error and Retry/Refresh, with editing disabled. User changes Block or Mute. Client sends a full desired-state PUT `{blocked:boolean,muted:boolean}` through the existing bearer refresh middleware, then **GETs again**. Only matching server state displays "Privacy preference saved." If transport times out after a commit, readback cannot be verified, or GET returns inconsistent desired values, both switches are disabled until Refresh to learn authoritative state; refreshing does **not** resend the PUT automatically. Server's upsert is naturally idempotent for a repeated same desired-state PUT; no money or private chat content changes. Browser/Android app restart opens new sheet and reloads real persisted state. Account switch or logout during in-flight operation prevents old-account result becoming a successful UI outcome.

Privacy: preference is for **viewer → subject**, scoped by server tenant and verified identity. It is **not** a publicly disclosed block list. No contact import, no guest writes, no mixing with AI persona IDs, no new financial flow, no private DM automatic deletion, no microphone activation. Existing server feed/safety policy must be verified to actually honor these preferences in discovery, Talk actions and replay; UI alone does NOT qualify full R15.

## Executable test evidence and missing verification

**Actions executed:** GitHub file inspection from current `main`, actual new branch+ownership claim+source+test commits pushed and draft #494 opened. Sources statically examined, with no executable tests. No positive Vitest/Flutter/DB/Android PASS is asserted.

**UNEXECUTED because environment lacks Flutter/Dart & executable repository checkout and CI #457 Actions quota 2,000/2,000 with $0 budget / stop enabled.** No real PostgreSQL, production Gateway or two-device auth credentials exposed to this window. Test commands for future Work integration:
```bash
git fetch origin
git checkout work/r15-human-profile-safety-preferences-20261008-gpt6
pnpm install --frozen-lockfile
pnpm typecheck
pnpm vitest run services/gateway/src/talk_safety/human_profile_preference_routes.test.ts services/gateway/src/talk_safety/service.test.ts services/gateway/src/talk_safety_routes.test.ts services/gateway/src/talk_safety/repository.test.ts
cd apps/mobile
flutter pub get
flutter analyze
flutter test test/human_profile_safety_test.dart test/talk_social_profiles_test.dart
flutter test
flutter build apk --debug --dart-define=API_BASE_URL=<isolated-qualified-test-gateway>
```
On **fresh disposable migrated PostgreSQL**, run authorized tenant A/B different users against actual Gateway session login, GET initial preference (false/false), PUT block, GET true, SET mute, GET both true, duplicate PUT, a second account's unchanged state, self-block protection, unknown handle 404, 400 validation, 401 logout, concurrent updates, account switch, timeout after committed PUT then GET readback, airplane mode, process kill/restart and authenticated authoritative readback. Review feed/list and full Talk admission/replay safety so block/mute truly hide/limit interactions beyond a profile screen. Do not point tests at production data. On low-end 320dp Android verify scroll accessibility, RTL/large font, screen reader and the shared five-tab R17/C08 deep-link after integration. Existing expired-token interceptor should be tested for refresh success/failure. Use exact deployed SHA for any external check.

## Integration risks, ownership, release gates

- **Server blocking scope** currently documents public Talks and supported Talk interactions. Do NOT imply person-to-person DMs/C01–C04 are blocked until their **separate** account/message admission guards and flows validate this behavior. Cross-surface R15/C01 integration must check reciprocal denial at send/read time.
- **Last writer wins on full desired-state PUT** if two devices update different flags concurrently. No version/CAS protocol is present. This feature intentionally readbacks the truth; **simultaneous writes need product/backend review** for lost updates before global R15 acceptance. No silent claim of cross-device conflict avoidance.
- **No local cached preferences** (fail closed offline). App restart uses server; no manual backup UI needed. No extra migration or PII duplication. Rollback removes human-profile CTA/adapter/sheet/tests; existing shared SQL row is durable and remains for Talk More Sheet.
- **Potential Dart compilation/layout/test failures:** no compiler was run. Work must fix before moving status forward. Reject any argument that a drafted suite or cached result proves Android readiness.
- No new production credentials, CI settings, Stripe/Flutterwave/NOWPayments, provider actions or S3 object edits.
- Requirements: R15/T05/M10/J11. C01 human messaging block/report integration is outside this scoped privacy preference feature and **still open**.

**Release states:** `SOURCE_WRITTEN=YES` on #494; `LOCAL_TESTED=NO`, `CI_EXECUTED=NO`, `DB_INTEGRATED=UNVERIFIED`, `APP_INTEGRATED=UNVERIFIED`, `DEVICE_VERIFIED=NO`, `PROVIDER_QUALIFIED=N/A`, `DEPLOYED=NO`, `MERGED=NO`. Neither this bounded feature nor R15 is DONE.

## Exact steps for single final ChatGPT Work integrator

1. Inventory #494 main/head SHA and any newly appeared claims/PRs, avoiding #489/#491 persona-report collision and overlapping R17/C08 root shell.
2. Run focused Gateway/Fastify + TypeScript and Flutter/analyzer tests above; review/fix any compile errors and widget overflows.
3. Run real tenant-scoped Postgres/Gateway A/B tests, including authorization negatives, two-device write conflict, restart and network uncertainty; attach executed logs and SHA.
4. Verify underlying public Talk feed, reply, invite, replay filtering actually enforces existing block/mute intent; if gaps found claim correct R15 owner and implement server authority before promising privacy. Distinguish UI feature from whole R15 acceptance.
5. Qualify Android layouts/accessibility, post-merge five-tab routing with R17/C08, deployed SHA/rollback. Only then remove DRAFT and consider merging; keep all unverified work unmerged.

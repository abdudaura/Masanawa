# Masanawa — Mobile Feature → API → Backend → Database Acceptance Matrix

> **2026-10-08 source-review snapshot, not an all-green implementation ledger.** The matrix is a binding **verification method**, not another feature plan. Attach to existing R01–R19/C01–C08 PRs. A component/file existing in source is **`SOURCE_PRESENT`**, never equivalent to an end-to-end completed feature. The current mobile router in `apps/mobile/lib/src/router/app_router.dart` still says **four** destinations; approved **five-tab Talks · Chats · Assistant · Wallet · Agents** is an implementation target (R17/C08), not currently established in the shipped APK.

## 1. Mandatory proof chain per feature

`Human action in Flutter [voice OR text/tap]` → `typed client request + correct session & request id` → `concrete reachable Gateway API route` → `current owner/tenant/member/role/consent validation` → `domain command and repository` → `right SQL transaction + outbox / object storage` → `re-read server-authoritative status/receipt` → `screen recovery and cache/realtime updates`.

**Every link must exist and be exercised; no UI-only button, test fixture response, stale local cache, schema-only DB migration, or unregistered route counts as complete.** For remote money/Live audio/media, include the actual provider/device/permissions and verified external receipt or interrupted/unknown recovery.

### Per-feature required evidence record

Use the **existing** R/C ID and P/N/T/M/A/W/Q/J IDs; one audit entry per user-visible action, not just per tab. Each PR/handoff must include:

| Field | Required real evidence |
| --- | --- |
| `entry` | Flutter screen/state/controller, accessibility and voice & silent tap/text triggers, loading/error/Back state |
| `client` | Dart typed API transport, base URL/environment, auth refresh, cancellation/retry, idempotency/request ID, decoded errors |
| `server` | Exact API method/path from Gateway app/route registrar and typed request/response validator, current authorized principal and object/tenant/consent checks |
| `persistence` | Repo and schema/table/migration ID, deployed `masanawa_schema_migrations` record, transaction/outbox/media ACL, retention/deletion policy |
| `success` | Actual authoritative readback after restart or second device; financial settlement uses verified receipt/ledger, not HTTP 200 alone |
| `negative` | No login/expired token, wrong tenant/member, restricted/deleted user, repeated request/concurrent devices, malformed payload, slow/offline network and provider unknown/failure |
| `verification` | Executed command/log/commit SHA + real Postgres/Android/permitted provider trace; name skipped tests individually, do not label entire gate PASS |
| `status` | `NOT_STARTED`, `PARTIAL_IMPLEMENTATION`, `IMPLEMENTED_UNVERIFIED`, `VERIFIED_E2E`, `DEPLOYED_VERIFIED`; **a blocked CI runner never upgrades a status** |

If a feature owner has implemented all owned UI/backend/DB/contracts but executable checks are impossible due #457/credentials/devices, use **`IMPLEMENTED_UNVERIFIED`** plus deferred Work verification command, PR SHA, expected result and risk. If UI/backend or migration part is missing, use **`PARTIAL_IMPLEMENTATION`**, never DONE. Keep unverified PR draft/unmerged.

## 2. Observed source vs actual user journeys

| Existing R/C owner | User-visible action / proof boundary | Relevant source found on `main` | DB/media and authoritative acceptance | Current evidence status |
| --- | --- | --- | --- | --- |
| **R17/C08** | Tap five bottom destinations, header bell/profile, preserve drafts/Back/deep links | `apps/mobile/lib/src/router/app_router.dart`, `apps/mobile/lib/src/screens/twin/`, `docs/APP-SHELL-CONTRACT.md` | Profile/inbox/task/ledger projections through correct distinct authorized API, no accidental mic or monetary dispatch | **NOT COMPLETE:** current router describes four-tab; approved five only in docs |
| **R02/R04/R09, J01** | Explore/Live → Host creates public audio Talk → guest joins/rejoins → ending | `apps/mobile/lib/src/screens/talks/`, `services/gateway/src/talk_routes.ts`, `talk_live_routes.ts` | `talks.talks`, live/seat migrations, current Host/seat authority, LiveKit join token, stage reconnect fence and persisted end state | **SOURCE_PRESENT, E2E UNVERIFIED** |
| **R09/R10/R13, J05** | Live interactions/comment/question/poll/gift and replay | `services/gateway/src/talk_gift_routes.ts`, `talk_poll_routes.ts`, `talk_replay_routes.ts`, event/finance repos | `talks.*` activity & replay + `commerce.*` settled gifted Credits; object playback integrity, provider verified receipts and private access after revoke | **SOURCE_PRESENT, E2E UNVERIFIED** |
| **C01, J03** | Search exact public human, privacy policy, contact request/accept/decline/block/revoke | **Draft PR #468** `services/gateway/src/human_contacts/`, migration `talks/0016_human_messaging_contacts.sql` | Must authenticate A and B, enforce policy/block at time of action, deployed real DB FK, session and REST readback | **IMPLEMENTED SOURCE IN DRAFT, UNEXECUTED TESTS; NOT `main`** |
| **C02, J03** | Open human thread, send/receive ordered text, create thread without duplication | `docs/COMMUNICATIONS-EXTENSION-PLAN.md` (spec); **no complete deployed human-message API demonstrated by this audit** | Human-only conversation/membership message storage, idempotent client request, actual A↔B readback and denial for C01 blocks | **NOT VERIFIED / MISSING END-TO-END** |
| **C03/C05/R14, J03/J10** | Chats list fast, offline cached history and queued send, Firebase unread/deep link, multi-device catch-up | `apps/mobile/lib/src/core/mobile_push.dart` and existing agent transport; C03/C05 planned | Server durable message cursors, transactional outbox, protected account-keyed mobile DB, safe logout/wipe and bounded 100k fixture | **NOT VERIFIED / MISSING END-TO-END** |
| **C04, J04** | Hold voice-note record, upload, play on recipient phone and revoke after block | C04 spec; some AI/public live audio services exist and **must not be used as DM access authority** | Secure private object upload, member-only temporary read, metadata in DM domain DB, retry/delete, no public stream or cached token leak | **NOT VERIFIED / MISSING END-TO-END** |
| **C07/R19, J07** | One Gwani/Gwana Assistant in-chat switch, speech/text/taps execute same scoped tasks | `apps/mobile/lib/src/screens/chat/ai_chat_screen.dart`, `src/agents/masanawa_transport.dart`, `services/gateway/src/agent_shell_routes.ts` | `agents.character_sessions`, runs and event operations; persona attribution, session continuity, approval consumed once, failed turn readback | **LEGACY AI SOURCE PRESENT, FINAL ONE-CHAT/ACTIONS E2E UNVERIFIED** |
| **R03/R19, J06** | Browse verified Experts/Twins, select private persona chat, creator manages Twin | `apps/mobile/lib/src/agents/`, `services/gateway/src/twin_directory_routes.ts`, `twin_profile_routes.ts`, `talk_ai_seat_routes.ts` | `identity.*`, `agents.*`, `talks.persona_profiles`, `commerce.*`; owner/read/scoped paid-seat admission, current availability | **SOURCE_PRESENT, E2E UNVERIFIED** |
| **R18/R12, J10** | View/edit real profile photo/name/privacy, clear account after validation | `apps/mobile/lib/src/screens/profile/`, `services/gateway/src/talk_profile_routes.ts`, account deletion API; R18 draft #435 storage changes | `security.platform_user_profiles`, `talks.public_profiles`; authorized CAS, actual S3 WebP private ACL, deletion pipeline and object cleanup | **SOURCE PRESENT; R18 NEW STORAGE DRAFT/UNVERIFIED** |
| **R05/R06, J08** | View real distinct available vs pending NGN, Credits, creator earnings | `apps/mobile/lib/src/screens/wallet/`, `src/finance/`, Gateway `wallet_projection_routes.ts` | `commerce.ngn_wallet_entries`, Credits immutable ledger, Twin settlement states; real server balance/readback under duplicate/restart | **SOURCE_PRESENT, E2E UNVERIFIED** |
| **R07, J08** | Airtime/Data/Electricity/TV quote→confirm→receive proof | `apps/mobile/lib/src/screens/billing/`, `apps/mobile/lib/src/core/network/api_client.dart`, `services/gateway/src/billing_routes.ts` | `commerce.*` funding/billing quotes/reservations, Flutterwave actual provider state and final receipt/refund/reconciliation; negative credential/market | **SOURCE_PRESENT, PROVIDER/DEVICE UNVERIFIED** |
| **R08, J08/J09** | Crypto deposit/withdraw/exchange; valid asset/network/fee choice | `apps/mobile/lib/src/finance/crypto_wallet_screen.dart`, Gateway finance composition, `adapters/storage/postgres/src/commerce/crypto-repository.ts` | `commerce.crypto_intents/ledger/provider_events`, custody limits, IPN dedupe, asset/network value reconciliation, only qualified provider real receipts | **SOURCE_PRESENT, PROVIDER/DEVICE UNVERIFIED** |
| **C06/R06/R08, J09** | Internal cryptocurrency transfer launched from Wallet or approved DM/Assistant handoff | C06 design; **do not mistake existing `/v1/wallet/transfers` Credits transfer** for crypto book transfer | Verified custody-backed same asset/network atomic balanced ledger transfer; recipient account binding, quote/consent, sender/recipient receipt, replay-safe single debit | **DISTINCT CRYPTO TRANSFER NOT VERIFIED** |
| **R11, J02/J10** | Hausa/English qualified languages and accessible voice/text/tap parity | `apps/mobile/lib/src/localization/`, `apps/mobile/lib/src/core/live_voice_session.dart`, Gemini runtime | Same server action IDs, permission/mic restart, speech attribution and translated API error localization, accessibility tests on low-end Android | **SOURCE PRESENT, FULL E2E UNVERIFIED** |
| **R14/R15, J04/J11** | Activity bell notification, report, block/mute/revoke across public/private | `services/gateway/src/talk_safety_routes.ts`, `talk_activity_routes.ts`, `apps/mobile/lib/src/core/mobile_push.dart` | `talks.*` safety/push, `events.*` outbox/receipts; real FCM A/B, private redaction and current denial across media/read/send | **SOURCE PRESENT, CROSS-DOMAIN E2E UNVERIFIED** |
| **R16, J10/J11** | Install release Android APK/AAB and recover from phone/network interruption | Flutter shell, Android build scripts, `.github/workflows/mobile-build.yml` | API base URL and exact running Gateway SHA, TLS, auth token migration, data-at-rest cache, crash metrics, Play signing and real 320dp test | **BLOCKED/UNVERIFIED; CI #457** |

### Specific source mismatches and audit tasks

1. **Mobile root route contract drift:** mobile `app_router.dart` still contains legacy four-tab descriptions, redirects `/chat` and `/chats` toward Home Talk. Final approved **`/messages` human DMs** and **`/assistant` single workspace** are not evidenced on current `main`. R17/C08 must implement typed and backward-compatible routes once. Do not mutate existing `/chats` into human DMs.
2. **Distinct transport configuration:** `apps/mobile/lib/src/core/network/api_client.dart` defines `API_BASE_URL` and `apps/mobile/lib/src/agents/masanawa_transport.dart` defines `AGENT_BASE_URL`, both defaulting to a Railway-owned hostname. Align build-time backend target through one environment/compatibility policy while preserving test injection and not putting provider or DB secrets on device. Moving accounts should not force recreating all human/profile/AI clients by hardcoded domain.
3. **Legacy API inventory:** `ApiClient` still defines community/group, `/ai/chat` and related methods alongside live billing/account routes. **Do not blindly remove them or falsely assume they work:** for each method find actual Flutter caller, exact Gateway/other backend route, owner and deprecation contract; mark `ACTIVE`, `MIGRATE` or `RETIRED`, add contract check, and remove unsupported UI entry points only after migration.
4. **Authorization != route existence:** Gateway `app.ts` installs routes based on injected services; `main.ts` constructs each only if real repo/authorizer/provider readiness exists. Missing keys/repo can mean route 404/disabled even when source is present. Test actual production composition, `/readyz` and two account responses.
5. **Database != media files:** privacy tests include blob object actual access after logout, user block, deletion, expiring signed URL, and backup/restore. PostgreSQL row count cannot prove object exists.
6. **Current deployed SHA != GitHub main:** as audited, Railway newest Gateway deployments awaited approval and prior main SHA was last successful; a locally passing route may not run on the phone's configured endpoint. Explicitly test exact deployment SHA and API hostname.
7. **Money correctness:** Credits transfer has an existing `/v1/wallet/transfers` implementation; C06 crypto internal transfer is a different typed/ledger action. Never label crypto finished because Credits tests pass.

## 3. Real acceptance test families — require executed results

1. **API shape and route registration:** static contract scan extracts Dart request methods/path/DTO and Gateway registered routes/TypeBox schemas. Fail on missing active path, mismatched verbs, casing, status/envelope, response models. Include conditional injection with/without provider auth. Every active client method must be classified; inactive legacy can be explicitly retained but not counted as passed.
2. **Fresh DB and schema:** disposable PostgreSQL with pinned/tested compatible version, `pgvector` extension, complete manifest, clean install + reapply no-op + checksum tamper negative, outbox transaction, tenant isolation and FK. Use real Postgres integration fixtures, not `describe.skip` due absent `MASANAWA_TEST_DATABASE_URL`.
3. **Authenticated two-user HTTP:** session A/B, same/different tenant, expired/rotated access, blocks/closed account, idempotent retries including simultaneous requests, pagination cursors, no unauthorized object access. Test saved state after server process restart and new user client.
4. **Flutter widget/device:** actual API-backed screens, loading/empty/error/reconnect, 320dp/large font, Hausa/RTL eligible locales, deliberate mic permission, no automatic finance charges, accessibility semantics, push/deep links, real second account, per-user encrypted local cache.
5. **Long-running and external effects:** real LiveKit join/end and audio track permission; AI actions scoped and once-only; official provider sandbox/qualified live tests verify external receipts, fee/FX/asset/network, delivery/refund/reconciliation and withdrawal ambiguity. Simulated provider results are only **unit tests**, never real-world provider certification.
6. **Deployment/restore:** full backup-to-fresh-account rehearsal, object consistency, receiver access, ledger state and webhook/outbox fencing as in `DATABASE-REDEPLOYMENT-AND-RESTORE-RUNBOOK.md`, plus current runtime SHA check.

**When CI/real credentials/Android are blocked:** complete the owned code, write exact tests, commit and push, record **`IMPLEMENTED_UNVERIFIED` or `PARTIAL_IMPLEMENTATION` accurately**, open/update draft PR with deferred ChatGPT Work test list; do not burn time endlessly retrying #457, do not disable checks, and **do not merge or mark DONE without independently executed evidence**.

## 4. Handoff template to use in each implementation PR

```text
Feature + R/C lane: ...
Requirement IDs / journey: ...
Base SHA, branch, PR, exact file claim and other active owners: ...
Frontend action + controller + voice/text/tap state: ...
Typed Dart method/path/request/response: ...
Gateway exact method/path/validation/auth/current tenant-policy check: ...
Repository + SQL migration/table + blob/event/outbox ownership: ...
Positive path: authoritative server readback + restart/other device: ...
Negative/retry/offline/block/delete/duplicate/provider-unknown tests: ...
EXECUTED evidence: command + actual result + tested SHA + environment: ...
Unexecuted checks, external blocker once, deferred Work action: ...
Status: NOT_STARTED / PARTIAL_IMPLEMENTATION / IMPLEMENTED_UNVERIFIED /
        VERIFIED_E2E / DEPLOYED_VERIFIED
Deployment SHA / rollback: ...
Remaining owned code (if any) and next integration dependency: ...
```

**Do not introduce 18 separate app integrations for 18 rows; the matrix belongs to existing feature PRs and is a cross-cutting verification guard.** The UI stays **Talks · Chats · Assistant · Wallet · Agents**, and API authority remains the server.

# U10 — Human-only chat composer and truthful delivery recovery (2026-10-09)

## Claim and ownership evidence
- **Workstream:** U10, everyday human-chat composer polish (M02/M05/M06/M07, Q04/Q05/Q08; J03/J10/J11).
- **Active claim first committed:** 2026-10-09 00:18 UTC, branch `work/u10-human-chat-polish-20261009-gpt6`, claim commit `d177ff77ef5ace36a1510fa259aa90f80421dfb0`; renewed through substantive commits. Five-minute inactivity rule applies to this workstream, **but unmerged changes remain durable and require reconciliation**.
- **Latest main at selection:** `5e758673ae91082520b21b3153da53791ae2cbf3`, also branch merge base.
- **Code implementation head before this handoff update:** `b70fb8a9b9bf3a6aac2cd491930ceabc2e4f7a8c`. PR head includes this handoff commit; consult the PR for exact latest SHA.
- **Search at claim:** no U10 branches/PRs/issues or `docs/workstreams` U10 claim. C02 #472/#475, C04 #478, C05 #474/#476, Work #497 and R17/C08 #493 reviewed without modifying their files.
- **Exclusive paths:** `apps/mobile/lib/src/human_chat_ux/**`, `apps/mobile/test/human_chat_ux/**`, this handoff. No edits to central Flutter router, five tabs, Firebase, Gateway, database migrations, auth, financial ledgers, billing/crypto, C02 `human_messages` or C05 `human_sync`.

## Status: PARTIAL_IMPLEMENTATION — unmerged / not verified or deployed
Meaningful, independently compile-targeted Flutter component source and tests are committed, but live integration with canonical human DM authority is blocked on the **unmerged and competing** C02/C05 and F12 Work drafts. Not an end-to-end Chats feature, and not eligible for a release claim.

### Committed functional source
1. `human_chat_contract.dart` — immutable verified account+tenant+conversation scope; persisted body and exact idempotency key, strict saved-data shape; narrow C02 send/ACK port and capability-gated reply quote.
2. `secure_human_chat_drafts.dart` — existing `flutter_secure_storage` OS-backed encrypted device storage, per-account isolation and bounded 16-thread retention, safe removal and **account-only** purge; corrupt records fail closed; serialized per-account operations avoid two-thread lost drafts; no `deleteAll`, plaintext SQLite or phonebook/DM logging.
3. `human_chat_composer_controller.dart` — draft hydration and persistence **before network send**; existing `createRequestId()` UUIDv7 for C02 idempotency; optimistic busy gating and exact-key retry after unknown transport result/process restart; reject forged/mismatched ACK; server accepted != recipient delivered/read; refresh-safe, disabled on secure-storage outage; quote invalidation; rechecks current authenticated session prior to sending; purge revokes UI access synchronously before waiting for storage.
4. `human_chat_composer.dart` — compact 1–5-line WhatsApp-style **human-only** chat field with emoji palette (outside text input), safe Send/mic toggle, attachment/voice controls **only when a C04 capability callback exists**, keyboard newline semantics, bounded 4,000-character message, multi-line quoted reply when authorized, retry/discard banner after unknown outcome, explicit server-accepted vs delivery/read-not-confirmed text and readable status/semantics. No auto-recording, silent AI DM membership or money operation.
5. `human_chat_c02_bridge.dart` — strict injection seam for canonical authenticated C02 `HumanDmTransport.send` and `HumanDmMessage` ACK fields without duplicating API endpoints, financial flows, or the C02 wire format. Reply capability defaults **off** until backend quote/reply support exists.

### Auth / backend / database boundaries
All actual membership/block/tenant permission checking, server message persistence, edit/delete, delivery truth and idempotency enforcement remain owned by canonical C01/C02/C03, **not** by this presentation component. `isAuthorized(scope)` MUST be bound by F12 to the current actual authenticated account/session and thread membership, never a constant. C02 transport MUST supply signed API session and authoritative response. The adapter accepts only its returned server ACK, never an LLM-generated receipt. No new DB migration, API, Firebase, wallet or hidden sixth tab is needed or introduced.

### Relevant regression tests added (13, NOT executed)
- `human_chat_composer_controller_test.dart` — 8 scenarios: uncertain timeout and restart same request ID; simultaneous double tap; storage failure blocks send; forged server ACK; signout while in flight; Alice/Bob account isolation/purge; quote tombstone; corrupt saved pending data.
- `human_chat_composer_widget_test.dart` — 2 scenarios: 320dp layout, emoji and mic-vs-send; unknown outcome and same-message retry.
- `secure_human_chat_drafts_test.dart` — 3 scenarios: secure per-account records and purge/no global deletion; 16-thread bounded retention; corrupt storage safe failure.
- **Source sanity only:** all 8 Dart files were fetched from this actual branch and checked for balanced delimiter pairs: 8/8 passed a noncompiler lexical check. **This is not Dart analysis, Flutter build or execution evidence.**
- **Executable commands NOT RUN:** `cd apps/mobile && flutter pub get && flutter analyze lib/src/human_chat_ux test/human_chat_ux && flutter test test/human_chat_ux` — current work environment has no `dart` or `flutter` executable and no network checkout of the private repository. No device, emulator or screen-reader run. GitHub Actions queried for this branch: **zero runs**; combined status at source head reports **Vercel failure due build-rate limit**, which is not a Dart test result.
- Real two-person C01 admission/C02 DM, C03 delivery/read events, C04 Android/iOS microphone and file picker, C05 kill/relaunch/outbox race, local-key protection on physical Android, IME/high-font/RTL accessibility, and device memory/performance measurements are all **UNVERIFIED**.

## Exact F12/C02/C04/C05 integration recipe (future designated single-owner wiring)
1. Reconcile duplicate C02 schemas/APIs #472/#475 and C05 implementations #474/#476 in one canonical, tested branch; retain selected C02 `HumanDmTransport.send(conversationId, requestId, body)` idempotent API. Do **not** copy or create a competing DM transport.
2. In F12's **existing C02 human thread screen only**, inject `HumanChatC02Bridge(sendCanonical: (...))`. The closure calls the authenticated `HumanDmTransport.send`, then returns `HumanChatServerAck(conversationId: message.conversationId, clientRequestId: message.clientRequestId, messageId: message.messageId)` from the **actual** returned `HumanDmMessage`. For current C02, `replySupported=false` and reject non-null reply. Explicitly render only server-supported actions.
3. Inject `HumanChatScope` from verified tenant+user+conversation session and `isAuthorized` closure that checks current session identity and membership; call `purgeAccount` / dispose on sign-out, revoke or switch, clear account C05 caches too; never construct scope from an untrusted deep link alone.
4. Integrate this widget in existing human-only Chats /messages route **through F12 exclusively**; preserve C02 edit/delete (actual server APIs), C05 outbox and ACK recovery under their one canonical send owner, keyboard/draft/scroll anchors. Avoid double-enqueueing requests when wiring C05: exactly the saved C02 idempotency ID should flow into C05's canonical outbox.
5. Only bind `onAttachment` / `onVoiceNote` after C04's authenticated upload and deliberate record/preview flow is tested; no competing mic runtime. Add pin/archive/mark-unread actions **only after** an authorized C02/C05 preference contract exists (currently not offered); defer permanent server reply quotes until C02 supports and reauthorizes revisions.
6. Run listed tests + full mobile analyzer on actual combined branch, two-account account-switch/revocation and process-death scenarios, real Android keyboard/IME/low-RAM screen reader, C02 membership/postgres API tests and C05 encrypted outbox reconciliation. Existing tests from #472 and #474/#476 must remain green before removing this draft status.

## Risks / handoff
- Source is independently owned but product wiring is missing; avoid implying currently reachable real user UI.
- A local secure draft is not an authenticated message, a server ACK is not peer delivery, and a retry uses the original exact ID; do not fabricate receipts or payments.
- Preserves owner five-tab target **Talks · Chats · Assistant · Wallet · Agents**, existing Firebase and protected shared file ownership.
- **Do not merge or deploy** before named owners integrate the one selected canonical C02/C05 contract and executable CI/Android checks pass.

# U10 — human DM composer and recovery handoff

**Updated 2026-10-09 · GPT-6 autonomous U10 · PARTIAL_IMPLEMENTATION, untested, DRAFT / UNMERGED / NOT DEPLOYED.**

## Baseline / exact lease
- Canonical base main SHA: 5e758673ae91082520b21b3153da53791ae2cbf3.
- Branch: work/u10-human-chat-composer-20261009-gpt6.
- Latest source + test checkpoint (before this documentation commit): ca67c16045c6bf8890616eb7cb2777a1f3e6615b. Initial substantive checkpoint: b07ba63f3e88ac4ff2810f7178251bb9d2597249.
- Exact owned paths: apps/mobile/lib/src/human_chat_ux/**, apps/mobile/test/human_chat_ux/**, this workstream handoff. Five-minute lease refreshed by scoped commits. Confirm no newer owner before adopting.
- Inspected: CONTINUE-HERE.md; updated re-audit; U21–U30/F01–F18 and U10 contracts; HUMAN-CHAT-AND-CONTEXTUAL-AI; C02 #472; C04 #478; C05 #474 and competing #476; Work #497; open PR/branch inventory. No pre-existing U10 PR/branch at claim.

## Substantive owned source
1. human_chat_draft_store.dart: bounded versioned private draft record and pending idempotency envelope, existing keystore-backed flutter_secure_storage; tenant/user/conversation composite key with length prefixes. Corrupt state fails closed; no plaintext backup.
2. human_chat_composer_controller.dart: cryptographically generated request IDs; ordered protected writes before API send; accepted-only typed C02 port and authoritative server-history lookup on retry; same request key after crash/timeout; duplicate tap prevention; no fake delivered/read state. Revocation disables sends. Explicit unconfirmed discard clears input and cautions that send may have succeeded. Loss of reply capability never turns a pending reply into a plain message. Logout owner may call revokeSessionAndPurge.
3. human_chat_composer.dart: compact 1–5 line multiline Flutter input, safe area/4000 limit, mic/send toggle only with real voice callback, actual provided attachment/emoji actions or no button, optional server-capability-gated reply preview, accessible retry/status/discard confirmation. No automatic AI inspection, payments, independent Chat routes or fake capabilities.
4. test/human_chat_ux/human_chat_composer_controller_test.dart and human_chat_composer_widget_test.dart: negative security, uncertain send, restart and UI tests authored.

## Evidence: source is not integrated or qualified
- This runtime has NO dart/flutter executables, no GitHub DNS for local checkout, no disposable DB/Android device or provider credentials. Shared CI quota incident #457 also remains open. NO tests were executed here; do not report passing Flutter analyze/test, Android APK, CI, A/B human messaging, database, provider or live push.
- Commands to run in integrated checkout:
  cd apps/mobile && flutter pub get
  cd apps/mobile && dart format --output=none --set-exit-if-changed lib/src/human_chat_ux test/human_chat_ux
  cd apps/mobile && flutter analyze lib/src/human_chat_ux test/human_chat_ux
  cd apps/mobile && flutter test test/human_chat_ux/
- Authored regression cases: key collision; wrong account; corrupt keystore; lost ACK; persisted request ID and retry; server-history acknowledgement no resend; duplicate tap; wrong ACK never clears draft; storage failure sends nothing; revoked permission; pending reply downgrade refusal; explicit discard; logout purge; small phone, voice action gating, honest accepted status.
- Mocked ports are regression fixtures only and are NOT a production communication backend.

## Exact integration dependency / ownership
- C02 #472 is the preferred previously identified canonical human messaging authority; C02 #475 proposes competing SQL/DTO, so reconcile first with C01 #468. One canonical C02 transport sends clientRequestId and returns server messageId/clientRequestId; adapt it into HumanChatSendPort. findServerAcknowledgement must search authorized actual C02 server history matching current sender, conversation and request ID; NEVER count a C05 optimistic local cache row as an ACK.
- C05 #474 vs #476 must elect ONE protected outbox. Reuse its queue and same request ID, not two independent message senders. U10's keystore is UI draft/retry metadata, not the authoritative C05 outbox.
- R17/C08 / Work #497 owns the five-tab Flutter shell. Integrator replaces C02 thread composer with HumanChatComposer and creates controller for exact session tenant/user/thread, calling revokeSessionAndPurge at signout or access revoke. NO changes to router, tabs, pubspec, gateway main/app, Firebase, migration registry or financial ledger on this branch.
- C04 #478 provides voice/attachment handlers only when composed and permissioned. No browser TTS. No reply capability advertised until C02 gains actual server-validated quote/reference. Existing C02 edit/delete is unaffected; pin/archive/unread sync remains backend capability-gated.
- Perform real backend C01/C02/C03/C04/C05 + source branch composition, expiry/reauth and blocked-contact negative tests, killed Android app/restart, two actual account/device tests, low-memory/keyboard/IME, Hausa/RTL/accessibility, Firebase privacy tests, CI and disposable PostgreSQL before merger.
- Scope-specific failures: absence of C02/C05 integrated into main, no global thread mount, no executable Flutter tests and no Android A/B proofs; therefore release gate remains NO-GO.

**Disposition: keep draft PR open/unmerged; next integrator must preserve source checkpoint, reconcile prior PRs and execute real tests. No production, financial or native credential actions.**

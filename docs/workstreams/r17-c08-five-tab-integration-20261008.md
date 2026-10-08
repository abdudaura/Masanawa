# R17/C08 — Five-tab shell integration: source, verification and Work handoff

Updated UTC: 2026-10-08T12:00:50Z. Owner: GPT-6 / R17-C08 exclusive shared Flutter shell.
**Status: PARTIAL_IMPLEMENTATION. NO E2E PROOF. DO NOT MERGE.**
Claim: this file; initial visible claim SHA 53d7ee0a6747660ff867ed738d383d0c21ba5c34; five-minute activity lease is renewed by substantive pushes, not the open PR alone.
Base main SHA: 1d6a67ea3c182455b55a7d1d07eacdb4311682e3.
Branch: work/r17-c08-five-tab-shell-20261008-gpt6.
Pushed SOURCE SHA before this handoff: 5f2dbf1de17003b4a328cdd64e0c2006e8b3ba99. Final checkpoint SHA is the newer HEAD of PR #493.
PR: https://github.com/Baatiku/masanawa/pull/493 — **DRAFT / UNMERGED**.
Trace: R17/C08; N01–N08, M01–M03/M08, A01/A02, W03, Q01/Q05/Q08/Q09/Q10 and J01/J03/J04/J07/J08/J10/J11.

## Exact path ownership and implemented source

- apps/mobile/lib/src/screens/twin/shell_tab.dart: exact stable five-tab enum Talks, Chats, Assistant, Wallet, Agents, legacy home/talk compatibility typed.
- apps/mobile/lib/src/router/app_router.dart: signed-in canonical roots /talks, /messages, /assistant, /wallet, /agents, plus /messages/:conversationId; /chat/:id stays AI Character; /chats redirects to private Assistant; /home?tab=talk stays private AI, /home stays public Talks; legacy create/activity/you actions preserved.
- apps/mobile/lib/src/screens/twin/twin_home_shell.dart: five destinations in order; public Talk feed, human-only inbox, server-driven Gwani/Gwana private Assistant, native Wallet, Agents/Twins; public Start Talk FAB only on Talks; header Activity/profile; unmount Assistant when away (no background mic).
- apps/mobile/lib/src/core/shell_deep_link.dart: strict opaque UUID DM locator via trusted masanawa.com HTTPS or masanawa://messages; authenticated server membership remains required.
- apps/mobile/lib/l10n/app_{en,ha,ar,es,fr,pt}.arb: translated new tab labels.
- apps/mobile/test/app_shell_route_compatibility_test.dart, apps/mobile/test/twin_home_shell_test.dart, apps/mobile/test/shell_deep_link_test.dart: authored route, RTL, viewport, Start Talk scope, deep-link negative checks; not executable here.
- docs/workstreams/r17-c08-five-tab-integration-20261008.md: this committed source-accurate handoff.

**Unmodified upstream source used for wiring, not reimplemented:** C02 #475 at SHA 91973de513845fb57d9f50e446c89dadd5af4f5c supplies apps/mobile/lib/src/messages/human_dm_{controller,outbox,screen,transport}.dart (same Git blobs). C07 #480 at SHA 6a0f8e4561684afcff8d1b85c452575b8d022a75 supplies apps/mobile/lib/src/assistant_workspace/{assistant_draft_store,assistant_workspace_controller,assistant_workspace_screen,secure_assistant_pending_journal}.dart (same Git blobs). Human DM API is bearer-authenticated with encrypted account-scoped pending outbox; Assistant uses authenticated server agent directory and secure draft/pending journal. Source integration is not server deployment. No new schema, fake finance ledger, provider secrets or direct payment capability were created.

## Missing implementable production code — feature is NOT DONE

1. R17/C08 **New message** human-only action from Chats and Person Profile: consent-aware C01 person lookup/connection, C02 server-verified otherUserId conversation open, authoritative thread navigation and return/backstack. No inert/fake FAB was added. C01 #468 contact client source requires repair: its branch's human_contacts_transport.dart retrieved at this checkpoint showed duplicated/malformed regex/declarations and inconsistent response signature; do not import unchanged or claim it compiled.
2. C01 consent, C02 DM data/write API, C03 realtime/unread/push, C04 private voice notes, C05 indexed cache/recovery must be reconciled, integrated and deployed. C02 #472 vs #475 have DUPLICATE alternative talks/0017 migrations/services; never apply both. C05 #474 vs #476 conflict.
3. C07 #480 currently combines two Character histories client-side but lacks a **single durable server task authority**, typed cross-feature operations, unified approval context and registered Gateway workspace routes. Native Gemini Live R02 not integrated. Persona switching alone does NOT satisfy J07.
4. R17 shell requires full contextual Ask Assistant, typed Wallet/DM transfer intents, human profile entry, deep-link backstack restoration, persisted scroll/draft/account-switch handling, localization/accessibility at 320dp and in RTL/large fonts, unread Activity and notification routing, and integration with R18 profile/header revisions.
5. Auth/negative two-user DB API tests, Flutter+Android integration, device/account switch/airplane/restart, privacy/voice/payment consent regression and genuine deployment proof remain missing. Navigation widget tests are not E2E.

## Cross-branch dependencies / collisions / data and security

- C01 #468 + R18 #435 both modify Gateway app.ts/main.ts; compose semantics without overwriting either. C01 talks/0016_human_messaging_contacts.sql is unmerged. C02 #472 and #475 have competing 0017 migrations; choose one canonical SQL/model first. C03 #473/#483/#486; C04 #478; C05 #474/#476; C06 #487; C07 #480; R14 #436; R17 older #445; R11 #426 are separate draft work; review diffs before integrating.
- Gateway tenant/auth/member/reciprocal block/request consent on **each** message read/send/media/upload remains authoritative; the Flutter path/UUID is NOT authority. Mobile local key material must remain account-scoped; revoked/deleted accounts clear private state without falsifying financial audit retention.
- Existing native Wallet/agent directories remain their source of truth. Do not merge fiat/Credits/crypto, authorize paid Seat or transfer on navigation or under AI model direction. Backend registration has not been changed by this PR.
- No SQL migration in PR #493. Before external migrations/backups/restores, follow docs/BACKEND-DATABASE-PORTABILITY-AUDIT-20261008.md and docs/DATABASE-REDEPLOYMENT-AND-RESTORE-RUNBOOK.md. Fail closed and rollback at known SHA if app routes precede backend eligibility.

## Verification ACTUALLY executed

- GitHub source diff and PR inventory, main SHA/ref readback, branch creation, public repository claim, source commits/pushes, changed-files inventory and **DRAFT PR #493** confirmed via GitHub connector. Last source commit 5f2dbf1de17003b4a328cdd64e0c2006e8b3ba99 (22 changed paths before this handoff). These are source-state observations, **not test PASS**.
- Local tool environment: no flutter, dart or pnpm executable; git checkout failed DNS "Could not resolve host: github.com". **No Flutter analyzer/test, PNPM test/typecheck, database transaction, Android build or device testing executed.**
- Shared issue #457 and draft #460 confirm GitHub Actions account/runner/quota incidents with failures before job steps. Do not repeatedly re-run blocked CI; a zero-step job is not code-test evidence.

## UNEXECUTED checks and concrete final ChatGPT Work sequence

1. Freeze current main and all R/C branches, examine fresh PR diffs/lease activity. Preserve source #475/#480 provenance when rebasing #493; remove copied files from final integration only after canonical owners' exact blobs are included. Fix conflicting 0017 migrations and C01 contacts source FIRST.
2. Compose C01, ONE C02, C03/C04/C05 and C07 services with R18, R14, R02 while respecting shared app.ts/main.ts ownership. Add C01 contact picker -> approved C02 conversation open and New message button; Person Profile Message. Implement full server task/authorization and Gemini native audio without auto mic.
3. With executable Flutter environment, cd apps/mobile && flutter pub get && flutter gen-l10n && flutter analyze. Check any FlutterSecureStorage/StateNotifierProvider/generation/icon/type errors. Then flutter test test/app_shell_route_compatibility_test.dart test/shell_deep_link_test.dart test/twin_home_shell_test.dart, followed by assistant_workspace_controller_test.dart, assistant_workspace_screen_test.dart, human_dm_controller_test.dart, human_dm_screen_test.dart, human_dm_transport_test.dart (tests upstream in #475/#480), then flutter test full. Fix any failures; none were run in this window.
4. In repo root run pnpm install --frozen-lockfile && pnpm typecheck && pnpm test; run migration rehearsal on isolated disposable real Postgres, then two authenticated independent users A and B plus blocked C; test join/send/read/edit/delete/cross-tenant denial/unique ID retry/outbox replay/push and signed-out exposure.
5. On real Android run build APK/AAB and signed-in two-device human DM text/voice, denied mic, background/restart, account switch, 320dp/RTL/large fonts and slow network. Run public Host/listener/FAB, Gwani↔Gwana action context and no duplicate money charge, Wallet crypto/Billing qualifications; all J01–J11. Save SHA-specific terminal, DB, session/receipt, screenshots, monitoring, rollback and security evidence.
6. #457 shared Work owner resolves Actions allocation once; execute CI and sign off only when the actual commands ran. If code missing keep PARTIAL_IMPLEMENTATION. Final merge by single designated Work integration window after coordinated review.

## Release gate truth table

| Gate | State | Evidence |
| --- | --- | --- |
| SOURCE_WRITTEN | PARTIAL | Navigation wired; human New message and full cross-feature dependencies missing |
| LOCAL_TESTED | NO | No runnable Flutter/Dart |
| CI_EXECUTED | NO | #457 zero-step Actions |
| DB_INTEGRATED | NO | C01/C02/C07 and 0017 collision |
| APP_INTEGRATED | PARTIAL | Unmerged upstream client source mounted, backend missing |
| DEVICE_VERIFIED | NO | Android/real users unavailable |
| PROVIDER_QUALIFIED | NO | No live Gemini/payment test |
| DEPLOYED | NO | Branch only |
| MERGED | NO | #493 DRAFT |

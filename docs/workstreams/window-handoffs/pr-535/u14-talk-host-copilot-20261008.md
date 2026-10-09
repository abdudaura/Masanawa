# U14 — private Talk Host preparation and deliberate publication
**2026-10-09 · PARTIAL_IMPLEMENTATION / ISOLATED / DRAFT / UNMERGED / NOT DEPLOYED**

## Ownership and immutable checkpoint
- Claim issue: [#532](https://github.com/Baatiku/masanawa/issues/532), created before source modification. Five-minute exact-file lease refreshed by commits on this branch.
- Base live `main`: `5e758673ae91082520b21b3153da53791ae2cbf3`.
- Branch: `work/u14-talk-host-copilot-20261009-gpt6`.
- Source/test checkpoint before this handoff commit: `ba7fdfa570fbe120aa8bf03dc3ff3f1fcc93cf4a`.
- Own only `services/gateway/src/talk_host_copilot/**`, `apps/mobile/lib/src/talk_host_copilot/**`, `apps/mobile/test/talk_host_copilot/**`, and this handoff. **No modifications** to native Firebase, common Gateway composer, Flutter root router, Talk/R04/R09 worker, canonical financial ledger, migration registry, CI or production system.

## What is real code (NOT end-to-end availability)
1. An authenticated, private `HostPrepService` with tenant/host filtering, bounded title/topic/questions, PostgreSQL-backed revision CAS drafts, process-restart list/get, owner edits and a persistent publication phase. User fields cannot set tenant/Host/account/phase or receipt.
2. Source PostgreSQL repository with actor-keyed WHERE clauses and `revision AND phase='draft'` atomic transition. Draft SQL proposal creates dedicated private `talks.host_preparations` table, per-owner index, phase and question bounds. **It has NOT been sequenced, applied or RLS/PG-verified.**
3. A deliberately reviewed `POST /v1/talk-host-preparations/:prepId/go-live` endpoint that requires `confirmGoLive:true` and latest revision. Only then does it call the **existing canonical TalkRepository** to create the public Talk using deterministic `talk_<prep UUID>`. A reserved publication cannot automatically create a second Talk; a lost write response leaves `publishing` status and requires readback via `verify`. This implementation reflects current `TalkRepository.createTalk` behavior, which **starts the Talk live**. It must not be reinterpreted as a publish-later draft endpoint.
4. Verified host-only Expert candidate and quote preview delegates to the canonical `TalkAiSeatService` after Talk publication. There is **no paid Seat confirmation, admission, approval or transfer path** in U14. Real prices/availability come from domain service, not AI text.
5. Standalone Fastify registration seam, strict max-item TypeBox body schemas, and authenticated Flutter Dio transport using the existing `ApiClient` bearer/refresh interceptor.
6. Account-fenced Flutter `ChangeNotifier` controller with revision-safe saving, private draft resume listing and deliberate new draft, stale async response discard, uncertain publication lock/readback, and account switch clearing.
7. Nested Talk preparation screen with editable questions, Save, explicit public Go Live modal, publication status readback, and actual Expert availability/quote-only cards. Does not start microphone or automatically invite/send/pay.

## Evidence (do not mistake static inspection for executable tests)
- Connector-authenticated comparison with `main` prior to this handoff: **20 source commits ahead, 0 behind; only nine U14-owned source/test paths changed** (before adding this handoff). No main modifications.
- Authored `services/gateway/src/talk_host_copilot/service.test.ts`: **9 Vitest cases** for private creation, two-actor IDOR, authorization/explicit confirmation/stale CAS, hostile bounds, canonical idempotent Talk ID, lost-response reconciliation, concurrent requests, private draft listing and real quote delegation.
- Authored `apps/mobile/test/talk_host_copilot/host_preparation_controller_test.dart`: **3 Flutter controller tests** for no autopublish/account switch stale response, unknown publication lock, revision edit.
- Exact current GitHub source read and **26/26 static contract inspections passed**, covering owner scoping, CAS, bounded API, quote-only, review, deterministic Talk ID, no root changes and negative test presence. **This is only structural review, not Vitest, Dart analyzer, Flutter test, SQL execution or app/device proof.**
- Available shell: Node `v22.16.0`, TypeScript CLI `5.8.3`; **no mounted authenticated repository checkout / node_modules, no Flutter/Dart**, `git ls-remote` failed DNS (`Could not resolve host: github.com`). GitHub Actions quota/runner shared blocker issue [#457](https://github.com/Baatiku/masanawa/issues/457) remains. **0 executable Vitest runs, 0 Flutter widget runs, 0 PG integration runs; no CI, provider or phone qualification**. They must not be called passes.
- The draft SQL is not a registered migration; running or deploying this module without elected F11 migration composition is prohibited.

## Crucial remaining U14 feature/integration gaps
1. **F11/Work:** assign migration ID, inspect canonical schema/foreign keys/RLS/service-account role, test PG18/pgvector migrations/replay/restore, and ensure talk ID unique constraints. Do not add a competing migration.
2. **F18/Gateway composer:** inject the real auth authorizer, PostgreSQL pool, canonical Talk repository and Seat service; register U14 routes; review Fastify schema behavior and normal error envelope. No mock services in production.
3. **F12/R04:** mount nested Talks prep screen with authenticated account key and optional prep ID. Preserve *exactly* Talks · Chats · Assistant · Wallet · Agents and only Talks Start Talk FAB. Test old Talk routes, Back, deep links, state and 320dp.
4. **C01/F14/R04:** expose only accepted, authorized human contacts as invite candidates and use genuine Host invitation API with result/status; never look up guessed handle and invite automatically. Existing C01 #468/R04 #433 source is unmerged and must be composed before this UI exposes invitation.
5. **U01/U02/U04/F18:** add actual operator voice/text/tap capability and U02 journal/quote/approval state. This U14 code contains manual Flutter preparation only; **there is no model-generated interview/question suggestion implementation, Gemini Live, auto Talk assistant, or task-journal binding**. Build against the single canonical operator protocol, not another assistant.
6. **R04:** qualify authorization, Talk lifecycle and exact go-live behavior across existing worker, LiveKit and async errors. `TalkRepository.createTalk` currently marks Talk live at insert; test that explicit user action is the only publisher. On ambiguous failure, prefer status-only reconciliation: never create with a different ID.
7. **Seat billing:** candidates and quote are read/prepare only. Confirm requires separate fee/expiry/user review and canonical financial authority, currently absent from this UI.
8. **Real tests:** use full checkout with packages installed:
   - `pnpm --filter @masanawa/gateway-service typecheck`
   - `pnpm exec vitest run services/gateway/src/talk_host_copilot/service.test.ts` (root-workspace)
   - `cd apps/mobile && flutter analyze lib/src/talk_host_copilot test/talk_host_copilot && flutter test test/talk_host_copilot`
   - Disposable PG migration + create/list/CAS/concurrency/readback/owner-isolation tests; Fastify inject tests; low-end Android device, offline/restart, real signed-in A/B accounts, denied Host and paid Seat safety.
   - Full R/C/U release checks and five-tab golden journeys before any merge.

## Security/red-team and conservative behavior
- Pre-publication drafts are private data, never public Talk summaries. No selected personal DM/phonebook data is ingested; no paid action or autogenerated Guest/Expert invitation.
- Actor IDs come exclusively from current authorizationHeader; all SQL list/read/edit/publish operations bind tenant and host; unknown IDs return not-found.
- Publication marker and revision CAS eliminate a normal duplicated create; a network error **does not** mark success and **does not** retry the external create automatically. Manual recovery of stuck `publishing` without a canonical Talk is a genuine remaining operational requirement.
- Account-switch suppresses late Flutter responses and clears prior draft/list; controller forbids another Go Live after unknown result until status readback.
- Existing Talk metadata can be edited after Go Live; readback verifies immutable Talk ID, tenant and Host ownership rather than mutable topic/title.
- Private SQL RLS/retention/account deletion and distributed conflict behavior need review, not claimed complete.

**Disposition:** Keep this PR **DRAFT/UNMERGED**. Source and test cases exist, but the complete U14 AI-first Host Copilot and canonical app composition do not. No production changes, migrations, paid admission, Talk launches, mobile release, merge or deletions performed.

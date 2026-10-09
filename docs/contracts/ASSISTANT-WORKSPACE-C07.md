# C07 private Assistant workspace adapter — source contract and Work integration gates

Status: **PARTIAL_IMPLEMENTATION / SOURCE_WRITTEN / UNVERIFIED**, 2026-10-08. This is an isolated additive implementation, not a released Assistant feature and not a new canonical assistant task database.

## Binding authority and reuse

- Authenticated real directory: GET /agent/directory. Only server-returned supportAgent profiles named Gwani/Gwana can appear in this client adapter; no synthetic personas or user-editable character IDs as identity proof.
- Persisted selection: PUT /agent/preferences/default {characterId}, followed by a fresh authenticated directory readback. The existing agents.user_agent_preferences table in agents/migrations/0004_platform_agent_preferences.sql owns account+tenant preference and revision. A rejected/ambiguous switch must leave the previous selection active.
- Backend conversation: existing authenticated POST /agent/conversations/open and turn transport, with its canonical CharacterSession and account-scoped turn idempotency. Per-character authenticated GET /agent/history and GET /agent/turns/:requestId/status are authoritative. The client merges read-only, per-character history into a timestamp/key sorted display and labels each reply. No local text becomes a fabricated server message.
- Pending operation: journal write to FlutterSecureStorage must complete before first send; same original canonical request ID is checked before any retry. "pending" and failed never become "sent"; an unknown response is uncertain. Any abandonment requires explicit user confirmation with duplicate-risk warning. The composer also uses separately encrypted account-scoped draft storage, preserved on Gwani/Gwana switch and fenced on account change.
- Native microphone: the isolated screen offers the mic only when R02/R17 supplies a concrete native integration callback. Opening Assistant never starts recording. Talk public audio, human DM voice notes and private Gemini audio remain separate.
- Caller must pass the *actual authenticated* session user ID, the existing agent directory transport, canonical agent transport implementing AgentShellTransport, and a real protected journal. A provider-dependent navigation/root change belongs solely to the R17/C08 integrator. Do not override /chats historical AI identity or take ownership of C01–C05 message paths.
- Existing typed AgentShellAction execution is the financial/tool authority. This screen does **not** execute voice-derived payments, send a person-to-person DM, change Talk Host state or approve an action based on LLM output.

## Why this is not a complete C07 feature

The production server still stores separate per-character conversation sessions. A combined display/projection of two authorized history pages is **not** a single durable server-side workspace with one task/intent pointer and common cross-persona context. The branch now contains an **isolated, not-yet-registered** Gateway composition in `services/gateway/src/assistant_workspace/service.ts` and `routes.ts`, using the existing authenticated directory/session/AgentShell APIs and PostgreSQL tables. Its GET snapshot, PUT role readback, POST session/turn and GET status paths are not live until the shared Gateway owner semantically wires them into `app.ts` / `main.ts` (which conflict with R18/C01). It does **not** implement a new server action registry, single committed task timeline, cross-persona consent invalidation, server event cursor, all-role history pagination or cross-persona semantic context bridge. Nor has the approved /assistant root route, native Gemini Live voice, profile/Talk/billing/crypto tool actions or full voice/text/tap parity been integrated here. These must be coded and verified by coordinated C07 + R17/C08 and R02/R04/R06/R08 owners, not claimed as done.

Do **not** use the current adapter as a misleading substitute for the complete owner-approved C07 scope; keep the draft unmerged until a production integration plan is reviewed and actionable dependencies are reconciled. Do not create a second action or financial store.

## Tests and expected results — unexecuted, for ChatGPT Work

Base this branch from its actual HEAD, compare newest main and open PRs #435 #468 #472 #473 and relevant R02/R17/C08 owners. Resolve any claim collisions before root or Gateway edits.

Execute in an environment with the correct Flutter SDK and dependencies:

    cd apps/mobile
    flutter pub get
    flutter analyze lib/src/assistant_workspace test/assistant_workspace_controller_test.dart test/assistant_workspace_screen_test.dart
    flutter test test/assistant_workspace_controller_test.dart
    flutter test test/assistant_workspace_screen_test.dart

Then verify full application analysis and tests; run the canonical workspace TS and Postgres checks according to package scripts (and record exact executed command/results):

    pnpm install --frozen-lockfile
    pnpm typecheck
    pnpm exec vitest run services/gateway/src/assistant_workspace/service.test.ts
    pnpm test

With two independent session-backed test accounts A and B, a migrated PostgreSQL test DB and real Gateway:
1. Confirm both support identities resolve from the actual tenant. Look up A's directory, switch to Gwana, read back preference; B must retain its own original default. Try invalid/non-support agents, expired/revoked session, and concurrent switch conflicting revision.
2. Send A a message to Gwani, switch to Gwana and send another with voice **and** typing once those integrations exist. Return and verify single authenticated workspace, attributed messages and shared task pointer with correct server ordering after kill/restart/another device. No history leak to B.
3. Inject lost HTTP response immediately after server commitment; recover the exact requestId via status/history. Kill app after protected journal write, restore A and then switch to B mid-request; no duplicate prompt/charge or B seeing A's draft.
4. Test in-flight persona switch during quote/destructive action; stale approval is refused server-side; wrong account and wrong persona cannot authorize prior consent.
5. Denied mic, offline, credential revocation, 401 refresh, listening to public Talk while starting/stopping private voice, and no public stage/DM/audio leakage; device-qualified Hausa/English, screen reader, large text, RTL and low-end memory.
6. Wire the single /assistant tab and typed aliases only from the single R17/C08-owned final five-tab root. Test Back, talk preservation, human /messages and Agents separate.

**Known blockers at creation:** account's GitHub Actions included 2,000/2,000 minutes consumed and $0 stopped budget (#457/#460); this connector runtime cannot clone private GitHub via network and has no Flutter/Dart/Postgres runtime or devices. No tests, CI jobs, Android builds, real API requests, migrations, deployment or release gates were executed here. Leave draft/unmerged and evidence fields false.

## Required evidence before changing status

Capture exact branch/merge/deploy SHA, migrated database instance/restore proof, test command stdout/stderr, auth negative-case logs with secrets removed, API response examples scoped to A/B, mobile build signatures/device versions, native mic/turn/audio measurements, and R/C/J acceptance coverage. Passing compiler checks alone is NOT end-to-end acceptance. Owner: ChatGPT Work for blocked executable checks and conflict-aware merge; C07 owner for source continuation.
## Additive Gateway route contract (SOURCE ONLY, not deployed)

After R18/C01 shared Gateway composition reconciliation, wire only the trusted `createAssistantWorkspaceService({directory, shell, conversations})` whose three dependencies are already composed from canonical Postgres-backed providers; call `registerAssistantWorkspaceRoutes(app, service)` from the single owning Gateway composer. Do not create a competing bearer authentication middleware or expose arbitrary tenant/user/character lookup.

- `GET /assistant/workspace?limit=50`: authenticated, returns `{activeRole,roles,messages}` (up to 100 merged recent rows; the current implementation restricts the response to its configured limit), both roles and each per-character message authorized independently.
- `PUT /assistant/workspace/persona` `{role:"gwani"|"gwana"}`: calls canonical PostgreSQL preference write; re-reads server directory before confirming.
- `POST /assistant/workspace/sessions` `{role}`: requires that role be the current server selection and delegates to canonical admitted CharacterSession creation; never trusts a client-supplied Character ID.
- `POST /assistant/workspace/sessions/:sessionId/turn` `{role,requestId,text}`: requires current selected role, parses canonical IDs and delegates to existing `AgentConversationService.turn` request-ID dedupe; financial/destructive approval is NOT exposed.
- `GET /assistant/workspace/turns/:requestId/status?role=gwani`: permits both still-authorized support roles for recovery after switching, delegates to existing per-character canonical state.

Negative test suite: `services/gateway/src/assistant_workspace/service.test.ts` (auth A/B, role swap state, stale role, scope/ID validation, status after switch). The test source is written but **NOT EXECUTED**. After source composer integration, add a live two-user PostgreSQL isolation/transaction test rather than relying only on the injected Fastify unit test. The isolated Flutter adapter presently uses the *already-live existing agent APIs*; updating it to consume this optional composite route is a separate compatibility decision for R17/C08, not a claimed deployed feature.

### No new migration

`packages/agents/migrations/0004_platform_agent_preferences.sql` already provides tenant/user persisted active Assistant preference. `packages/agents/migrations/0006_mobile_shell.sql` already holds server-authoritative turns, history and typed action states. Creating another transcript, financial ledger or provider-specific action table would violate the current canonical architecture. **A new durable cross-persona task registry is still missing**, however, and its eventual migration/contract requires coordinated ownership with the existing action, finance and identity authorities before merge.


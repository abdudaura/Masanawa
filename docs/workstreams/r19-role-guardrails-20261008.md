# R19 — private Agent/Twin role integrity and visible AI disclosure

Updated: 2026-10-08 UTC; window: GPT-6 R19 isolated implementation.
**Feature-source status: IMPLEMENTED_UNVERIFIED for this bounded private Agent/Twin response/disclosure slice. R19 as a whole: PARTIAL_IMPLEMENTATION. NOTHING IS DONE, VERIFIED_E2E, DEPLOYED or MERGED.**
Five-minute activity lease: activity follows the latest commit/PR update on this branch, not indefinite PR ownership. Release this claim when this handoff is committed. Never overwrite active owners.

## Immutable pointers and ownership

- Canonical base `main`: `1d6a67ea3c182455b55a7d1d07eacdb4311682e3`.
- Working branch: `work/r19-role-guardrails-20261008-gpt6`, committed and pushed by GitHub Contents API.
- Source checkpoint before this final handoff: `ee3f552a3a7d4bb83f3ec85bb5708fba3ea4b3c3` (this handoff commit will be newer; refer to draft PR for current HEAD). Comparison on this SHA: 12 commits ahead / 0 behind main; 8 changed files.
- Draft/unmerged PR: [#498](https://github.com/Baatiku/masanawa/pull/498); shared final Work integration: [#497](https://github.com/Baatiku/masanawa/pull/497).
- Requirement mapping: R19 / A09, N05, A08, Q12 / J06, J07, J11. Existing private character conversation is independent of the centered C07 Assistant workspace.
- Live collision review: R02/R19 [#448](https://github.com/Baatiku/masanawa/pull/448) owns live worker turn fencing, C07 [#480](https://github.com/Baatiku/masanawa/pull/480) owns its switchable workspace, R15 #489/#491 own persona profile safety screens, R17/C08 [#493](https://github.com/Baatiku/masanawa/pull/493) owns root five-tab shell, and Work #497 owns reconciliations. **None of their source paths were edited here.**
- Exclusive affected paths below; no shared `main.ts`, `app.ts`, central Flutter router, root shell, providers, ledger, migration manifest or CI settings edits.

## Changed source by layer

| Layer | Path / change |
|---|---|
| Authorized existing tenant/profile/session API | Reuses `AgentConversationAuthorizer` → `AgentConversationService` → `AgentStrategy` with the admitted server presentation and existing identity/session/run authorization. No new endpoint; no weakened auth. |
| Production model adapter | `services/gateway/src/production_strategy.ts` invokes bounded, profile-driven persona instruction builder on every existing private agent turn across mobile, WhatsApp and Telegram; existing public-Twin, channel, capability and Tool/Skill boundaries remain in place. |
| Development fallback | `services/gateway/src/alpha_strategy.ts` uses the same role contract with explicit development/runtime capability caveat. |
| Shared isolated helper (new) | `services/gateway/src/production_persona_role.ts`: explicit AI identity, use selected server profile (no hardcoded names), role-appropriate adaptive tone/humor, serious-topic restraint, no unproven operations/credentials/life history, natural Hausa/code switching, respectful stop/goodbye; length bounds aligned with the existing authorized presentation. Multiline presentation is JSON-encoded as data, not concatenated into an independent instruction. Model prompt-injection resistance remains probabilistic and requires adversarial provider QA. |
| Flutter consumer UI | `apps/mobile/lib/src/screens/chat/ai_chat_screen.dart` shows a persistent AI identity alongside the actual agent presence/working status; `apps/mobile/lib/src/screens/chat/components/ai_persona_status_label.dart` is an accessible label preserving AI identity for loading/typing/empty status. No navigation, identity source, billing or audio behavior altered. |
| Backend tests (new) | `services/gateway/src/production_persona_role.test.ts`: real strategy invocation against a controllable inference stub, selected profile change (Gwani/Gwana), mobile/WhatsApp/Telegram instructions, public-Twin vs human-owner disclosure, malicious multiline presentation as quoted data, invalid/oversized input rejected before inference, cancellation signal and response contract. No pretend live model/provider test. |
| Flutter tests (new) | `apps/mobile/test/ai_persona_status_label_test.dart`: rendered widget tests with visible AI disclosure for available, busy and empty presence states. |
| Database/migrations/credentials | N/A: no new persisted feature state; existing Postgres authorization/session/run persistence is used unchanged. No secrets/provider direct calls added. |
| Offline/restart/recovery | Existing durable conversation retry/session and account readback ownership unchanged. Role instructions recompile from the admitted profile for every turn; Flutter status label recomputes from current directory state. Actual offline/restart/Android behavior is **UNEXECUTED**, not presumed. |

## Scope, source completion and remaining work

**Implemented in source for this subfeature:** backed private AI persona instructions routed to both existing inference strategies; auth-accepted, never a UI-only fake persona. Compact visible AI disclosure in private chat. Unit/widget tests committed.

**Not implemented / not claimed by this subfeature:** server-side enforcement of all generated response semantics (LLM may still ignore prompts), publication of all seventeen personas/voice qualification, public Talk AI worker role contexts, live Gemini audio, full model adversarial QA, voice language pronunciation, C07 center Gwani/Gwana shared workspace integration, R17/C08 new shell adoption, persisted consented memory controls, future provider rollout. These remain **R19 overall PARTIAL_IMPLEMENTATION** (or C07/R03/R02/R17 owners), not an unverified-complete full R19. The existing private persona chat already has authenticated backend/run custody; this PR does not pretend to implement missing operators or persistence.

## Verification executed versus not executed

**Executed (source/API only, no runtime test):**
- GitHub authenticated fetch: main and relevant canonical contracts/plans, current PR ownership/file list, #457 incident.
- GitHub branch `work/r19-role-guardrails-20261008-gpt6` created from actual main; source commits pushed; GitHub comparison at `ee3f552...` showed 8 expected files, 12 commits ahead and 0 behind main, no main merge.
- Reviewed actual mobile package name `masanawa` and corrected Flutter test import.
- Reviewed the rendered repository-side changed path content and test fixtures for syntax/contract plausibility. **No compiler, CI, integration test, database or physical device execution.**

**NOT EXECUTED — Work owner must run on an executable fresh clone of the exact PR HEAD:**

```bash
git fetch origin && git checkout work/r19-role-guardrails-20261008-gpt6
corepack enable
pnpm install --frozen-lockfile
pnpm --filter @masanawa/gateway-service typecheck
pnpm exec vitest run services/gateway/src/production_persona_role.test.ts
pnpm typecheck
pnpm test:ci
cd apps/mobile
flutter pub get
flutter analyze
flutter test test/ai_persona_status_label_test.dart
flutter test
flutter build apk --release
```

**Blocked context:** shared Actions [issue #457](https://github.com/Baatiku/masanawa/issues/457) documents multiple independent CI failures before checkout or any job steps and central owner coordination. PR #498 had no Actions runs at initial creation. This GitHub-only window has no checked-out repository/dependency toolchain, Flutter/Dart SDK, authenticated disposable PG18, configured Gemini Live or two Android devices. Do not repeatedly rerun empty-step Actions. Work #497 owns CI recovery, integration and test execution. No local or simulated mock passing results are asserted.

**Required live end-to-end evidence:** authorized real tenant + two distinct admitted AI character profiles; turn via mobile, WhatsApp and Telegram using current deployment/source SHA; compare role task quality and safe serious replies, check fake capability claims, explicit AI identity and spontaneous respectful goodbye; hostile biography/Skill prompt-injection tests, English/Hausa/code switch; Flutter signed-in Android private chat header before and after process death/account switch; no leakage across C07 Assistant and human DMs, no false completion of live or financial actions. Verify failure/timeout paths remain intact. Confirm generated text safety with humans; unit tests inspect instruction packaging, not provider obedience.

## Security, authority, rollout and collisions

- Admin-authorized presentation fields are **data** in a JSON string; no new role table or identity from display names; every turn still goes through tenant session authorization. Length check fails closed before inference if admission data malformed. This does not claim model-proof prompt-injection defense.
- Financial confirmation/action authority remains with existing server operations, never model prose. No modifications to wallet/crypto/DM membership or public Talk audio transport. Logs should not include private transcript/provider keys.
- Live Android/gateway contract differs from draft R17/C08 center Assistant: Work must preserve AI disclosure in any new centered Assistant header without rebasing this change over another active root-shell owner. This PR covers the existing private Agent/Twin thread only.
- Shared CI and provider runtime rollout are independent gates. Existing mobile theme/colors untouched.
- Rollback: revert this isolated PR (no migrations/data deletion/ledger effects), or keep provider adapter disabled at deployment until model QA. Do not silently lose legitimate previous agent instruction or Skill policy when resolving branches.
- Integration ordering: harmonize R03 published authorized persona roster, R15 safety, C07 Assistant, C08 shell with existing R19 label; preserve #448 live worker safety and new #498 production strategy additions.

## Concrete final Work actions

1. Re-read latest #498 file diff, HEAD SHA, current main and active leases. Confirm typecheck, run exact Vitest and Flutter commands; fix any compilation/test failures on authorized integration branch.
2. Verify `AgentConversationAuthorizer` supplies bounded, tenant/current character presentation on every Gateway turn, not an untrusted display name; test adversarial cross-tenant character switching, denied auth, version change, cancelled retry.
3. Execute real Gemini model QA for all 17 role variants (not necessarily this feature branch's source), sample safe sensitive-topic and goodbye transcripts, check language and actual voice compliance; write evidence not just prompt snapshots.
4. Resolve merge conflicts with PRs #480 and #493 in AI identity semantics; ensure new center Assistant and separate Expert/Twin threads BOTH disclose AI clearly, with no provider or account leakage.
5. Run Android/two-device and server persistence/restart tests as necessary; record deployment SHA and provenance for final R19 gates; merge #498 only after actual verification. Unresolved failures stay draft.

## Release gates at this SHA

| Gate | Status |
|---|---|
| SOURCE_WRITTEN (bounded role/disclosure slice) | YES |
| LOCAL_TESTED / CI_EXECUTED | NO / NO |
| DB_INTEGRATED | EXISTING AUTH PERSISTENCE ONLY; no new schema; integration unverified |
| APP_INTEGRATED | Wired in existing `AiChatScreen` source; unverified on device |
| DEVICE_VERIFIED / LIVE_MODEL_QA / PROVIDER_QUALIFIED | NO / NO / NO |
| DEPLOYED / MERGED | NO / NO |
| R19 full feature DONE | **NO — PARTIAL_IMPLEMENTATION** |


## R19 ownership extension (new five-minute claim, 2026-10-08 UTC)

During the bounded implementation review, `services/gateway/src/agent_conversation.ts` was found to admit a session and check only active/expiration before invoking strategy, without a local explicit check that returned persisted session's tenant/user/character/relationship and persona version still match fresh authorization. Extend this exact R19 claim to `services/gateway/src/agent_conversation.ts` and `services/gateway/src/agent_conversation.test.ts` only, for fail-closed isolation and recovery. Existing C07 #480 is a separate workspace and does not edit these files; no edits to shared composers or financial authority. This extension is **PARTIAL_IMPLEMENTATION** until coded/test cases committed and recorded, and does NOT authorize claiming whole R19 DONE. The previous SHA-specific handoff remains historical evidence; this section and subsequent final checkpoint supersede its eight-file scope.


## R19 recovery claim extension (2026-10-08 UTC)

The new server `agents.session_persona_changed` response must have a **working Flutter recovery path**, not an indefinite Retry loop. Add exclusive R19 paths `apps/mobile/lib/src/state/ai_chat_state.dart`, `apps/mobile/lib/src/agents/agent_session_recovery.dart`, `apps/mobile/test/agent_session_recovery_test.dart` to support safe new-session acquisition for text, voice and multi-media across a stale profile update, while avoiding blind retries of arbitrary financial/turn-pending HTTP 409s. Do not edit shared root shell/voice provider/ledger. This claim remains active only with repository-visible changes and expires after five minutes of inactivity.


## Final R19 private conversation security and recovery checkpoint — 2026-10-08 UTC

**Supersedes earlier eight-file source scope and two interim claim extensions above.** Complete current SHA-specific work prior to this handoff commit: `873cc1efddd4d059af09d6f119b45a94707c83ad`, base `1d6a67ea3c182455b55a7d1d07eacdb4311682e3`, draft PR #498. Live comparison with main: **20 branch commits ahead, 0 behind; 13 exact changed files**. This final handoff commit itself becomes the new PR HEAD; always use the live PR HEAD for checkout. The exact changed paths are:

1. `services/gateway/src/production_persona_role.ts` (new authorized-data role, truth, AI identity and consent policy).
2. `services/gateway/src/production_strategy.ts` (real production inference strategy uses role policy).
3. `services/gateway/src/alpha_strategy.ts` (dev inference strategy uses same policy).
4. `services/gateway/src/production_persona_role.test.ts` (six grouped production/development, channel/Twin/bounds/cancel policy tests; unexecuted).
5. `services/gateway/src/agent_conversation.ts` (**new:** on `open`, `turn`, `mediaTurn`, `mediaSetTurn` assert repository-returned session tenant/user/relationship/character/sessionId and current authorized persona version match the requested logged-in identity **before any inference/run/billing side effects**. Returns typed `agents.session_scope_mismatch`/ `agents.session_persona_changed`. For `close`, guard account/session identity but permit stale version to exit safely).
6. `services/gateway/src/agent_conversation.test.ts` (**new cases:** wrong tenant/user/character/relationship/session ID are denied before runs; stale persona version denies text/voice/media set; valid owner closes stale version; inconsistent newly created session never reported as usable).
7. `apps/mobile/lib/src/screens/chat/ai_chat_screen.dart` (wired persistent AI label in existing Agent/Twin chat).
8. `apps/mobile/lib/src/screens/chat/components/ai_persona_status_label.dart` (new accessible status label).
9. `apps/mobile/test/ai_persona_status_label_test.dart` (new render tests).
10. `apps/mobile/lib/src/state/ai_chat_state.dart` (**new:** preserve same requestId while reopening **only** proven stale/missing/persona-updated session for cached text, single-media or multi-attachment sends; no blind retry on a generic HTTP 409 or pending financial outcome; readback/session state updated by existing `_bindingFor` and stored persistently).
11. `apps/mobile/lib/src/agents/agent_session_recovery.dart` (new typed classification of known *pre-dispatch* stale errors).
12. `apps/mobile/test/agent_session_recovery_test.dart` (positive closed/not-found/persona-change and negative pending-turn/unknown financial/403/ambiguous 409 tests).
13. `docs/workstreams/r19-role-guardrails-20261008.md` (claim and immutable evidence).

**Source assessment for THIS bounded subfeature:** `IMPLEMENTED_UNVERIFIED`; backend and consumer UI wired into existing production/auth/session/profiles. Database: canonical persistence already exists in `CharacterSessionRepository`; **no new table or migration** because guard only compares existing authoritative, persisted fields. The existing `AgentConversationService` continues returning agent reply and already stores run and mobile turn status/readback; no alternate financial operation invented. The code assumes current auth resolves current published character version and repository read is scoped; Work must validate this against real Postgres/identity and reconnect behaviors. Denials have no side effects because checks precede `runs.create`, `mobileShell.claimTurn`, inference and billing. Automatic retries are restricted to known pre-dispatch session errors; network-unknown outcomes require existing journal/readback and must not be re-sent.

**Remaining unverified/known risks:** code tests newly written but **NOT EXECUTED**; generic fallback HTTP 404 without error code remains auto-recoverable for backward compatibility—Work must validate actual production error envelopes before signoff. Prompt injection via approved-looking profile JSON may still influence an LLM; JSON encoding is structural hygiene only, not a guaranteed containment boundary. Frontend state may need additional integration regressions for cross-account/logout while performing delayed retries, media upload progress, resumed captions/attachments, and server `409` classification. Actual two-account Postgres tenant isolation, profile-version CAS drift, mobile cached transcript/restart, Gemini provider compliance, voice/pronunciation, and final centered C07 workspace are not tested or delivered.

**Final required Work verification commands** (run against current PR #498 HEAD, NOT untracked snippets):

```bash
pnpm install --frozen-lockfile
pnpm --filter @masanawa/gateway-service typecheck
pnpm exec vitest run services/gateway/src/production_persona_role.test.ts services/gateway/src/agent_conversation.test.ts
pnpm typecheck
pnpm test:ci
cd apps/mobile
flutter pub get
flutter analyze
flutter test test/ai_persona_status_label_test.dart test/agent_session_recovery_test.dart
flutter test
flutter build apk --release
```

Work integration: use disposable Postgres with migrations, real authenticated A/B users and two distinct published persona revisions, verify server `409` envelope and no strategy/ledger/operations after denial, authoritative readback after benign retry, no duplicate call after `agents.turn_pending`, manual/multi-file cached session rebinding, genuine model E2E. Then run Android/release/provider QA. Record exit codes and exact SHAs. GitHub Actions issue #457 remains unverified; no CI job or test result is asserted. Tests and hardware remain **NOT EXECUTED**, not PASS. Keep PR **DRAFT / UNMERGED**.

**Final Work release gate matrix:** SOURCE_WRITTEN bounded R19 slice YES; LOCAL_TESTED NO; CI_EXECUTED NO; DB_AUTH_INTEGRATION UNVERIFIED; APP_INTEGRATION SOURCE ONLY, not device; DEVICE_VERIFIED NO; MODEL_POLICY_QA NO; PROVIDER_QUALIFIED NO; DEPLOYED NO; MERGED NO. Full R19 still `PARTIAL_IMPLEMENTATION` until 17 roles, real live audio, language QA, consented context and recovery are executed. Required proof depends on #441/#495 (authoritative character setup), #448 (public Talk audio), #480 (private Assistant), #493 (five-tab integration), #497 (single Work verification). No merge or done claim permitted.


## Observed branch CI failure evidence (2026-10-08 UTC)

After final source push, [Foundation CI run 37779827593](https://github.com/Baatiku/masanawa/actions/runs/37779827593) on this branch completed **failure**, with [job 113319819487](https://github.com/Baatiku/masanawa/actions/runs/37779827593/job/113319819487): `runner_id=0`, `steps=0`, no assigned runner. **No source/test/build step executed.** A [Mobile Build run 37779827717](https://github.com/Baatiku/masanawa/actions/runs/37779827717) also concluded failure; its step count was NOT independently inspected here, so do not assume the exact same cause solely from its conclusion. This source-specific observation supplements central issue #457, does **not** establish code compile/test failure or pass, and does **not** authorize CI rewrites/billing changes here. The central Work #497 owner should first recover runner allocation, then rerun the tests against the new handoff HEAD and fix any code failures. Leave #498 draft.


## Claim extension — R19 streaming pre-dispatch error repair (2026-10-08 13:00 UTC)
After checking main and live PR timestamps, C01 #468 and central Work #497 have no GitHub-visible activity within the previous five minutes. Their previous `app.ts` additions remain protected; this branch claims **only** the existing `/agent/sessions/:id/turn-stream` error emission hunk in `services/gateway/src/app.ts`, new `services/gateway/src/agent_turn_stream_error.ts` + unit test, and exact `apps/mobile/lib/src/agents/masanawa_transport.dart` streaming error parser and tests. Preserve semantic content of #468 contact and #435 profile composer (both unmerged); Work #497 must reconcile additions by hunk, never blindly overwrite the shared composer. Fresh lease from this claim push. Purpose: propagate only whitelisted **pre-dispatch** stale-session codes as machine-readable NDJSON without leaking raw errors and without auto-replaying partial streams/unknown outcomes. This does not change ledger, auth admissions, public Talk, root navigation or financial retry semantics. Status stays PARTIAL_IMPLEMENTATION while implementing and unverified when tests are unavailable.


## R19 streamed-turn pre-dispatch recovery — completed source checkpoint (2026-10-08 UTC)

**Current feature-source status: IMPLEMENTED_UNVERIFIED for this bounded R19 slice, NOT full R19.** At the checkpoint before this paragraph was committed, `main` remained `1d6a67ea3c182455b55a7d1d07eacdb4311682e3`; branch comparison was 33 commits ahead / 0 behind with 18 changed files. The final handoff commit (then any comment/body updates) becomes the branch HEAD; inspect PR #498 HEAD rather than treating this intermediate SHA as final.

**Discovered real source gap (now implemented, not verified):** existing `services/gateway/src/app.ts` sent `{type:"error",code:"turn_failed"}` for all NDJSON streamed text failures. The frontend therefore could not distinguish a definitely pre-inference `agents.session_persona_changed` from an ambiguous failed turn, so the original Flutter text-session recovery was disconnected in the common streaming path. New code repairs this by transferring only three safe pre-dispatch session codes (closed, not-found, persona-changed) and only when no text/audio event has been emitted. Other errors—including scope denial, financial unknown, late model/stream error—remain generic. Streaming errors contain no raw exception text.

**Exact incremental paths since prior handoff:**
- `services/gateway/src/agent_turn_stream_error.ts` (new): allowlisted `PlatformError` pre-dispatch classification with output fence.
- `services/gateway/src/agent_turn_stream_error.test.ts` (new): typed session errors vs output/unknown/financial/scope branches.
- `services/gateway/src/agent_turn_stream_http.test.ts` (new): Fastify NDJSON route tests for stale preflight, prior delta and ambiguous errors; **unexecuted**, actual hijacked reply behavior must be verified.
- `services/gateway/src/app.ts`: **narrow STREAM ROUTE HUNK ONLY**; mark delta/audio output before writing; emit safe code. Because C01 #468 and R18 #435 also add unrelated shared composer code, cherry-pick/semantic integration with both is mandatory. Full-file overwrite prohibited; no other part of the Gateway composer changed.
- `apps/mobile/lib/src/agents/agent_session_recovery.dart`: strict classification; removed dangerous bare HTTP 404 retry (could be deleted/unauthorized persona instead of expired session). New safe typed NDJSON error conversion, generic outcomes preserve original request instead of blind resend.
- `apps/mobile/lib/src/agents/masanawa_transport.dart`: tracks *any* received audio or text before considering typed automatic reopen; typed NDJSON codes are converted to pre-dispatch ApiException, unknown errors remain "outcome unknown." Existing request ID and authorization/cancel transport intact.
- `apps/mobile/test/agent_session_recovery_test.dart`: 404 fail-closed, streamed before/after output, unknown codes and sanitized messages.
- `services/gateway/src/production_persona_role.test.ts`: corrected an incorrect case-sensitive prompt assertion before executable checks.

**Recovery end-to-end source path:** current tenant auth → typed character/session/version validation in `agent_conversation.ts` before `mobileShell.claimTurn` or `runs.create` → `app.ts` streams only an allowlisted pre-dispatch denial → Flutter NDJSON decoder creates exact machine code only before delta/audio → `ai_chat_state.dart` invalidates cached binding and reopens the currently authenticated profile → resends original text/voice/multi-file with same client request ID → existing canonical mobile Shell persistence/readback. For any partial stream, unknown conflict, pending turn, financial uncertainty, or ambiguous 404, no automatic resend occurs; explicit user recovery/status reconciliation remains necessary. This code does not itself prove exactly-once behavior across service restarts; test against canonical persistence.

**Required executable checks on current exact PR HEAD (none executed):**
```bash
pnpm install --frozen-lockfile
pnpm --filter @masanawa/gateway-service typecheck
pnpm exec vitest run services/gateway/src/production_persona_role.test.ts services/gateway/src/agent_conversation.test.ts services/gateway/src/agent_turn_stream_error.test.ts services/gateway/src/agent_turn_stream_http.test.ts
pnpm typecheck && pnpm test:ci
cd apps/mobile
flutter pub get
flutter analyze
flutter test test/ai_persona_status_label_test.dart test/agent_session_recovery_test.dart
flutter test
flutter build apk --release
```

**Specific live checks required:** signed-in A and B with distinct tenant, current/stale persona version, Postgres-backed session/open/read/claim, stream first response 200 with typed NDJSON `agents.session_persona_changed`, client reopen and exactly one persisted send/record; verify late error after text/audio does NOT retry; network disconnect after provider or wallet side effect does NOT replay. Verify malicious wrong session/user cannot use stale recovery as unauthorized member, accounts switching mid-reopen fence in `ai_chat_state.dart`, and cached outbox/request IDs through Android process death. Run Flutter Android/Gemini and actual service/provider qualifications. No local checkout or runner exists in this window; network cannot resolve private GitHub from container and GitHub Actions #457 steps still blocked. **Tests NOT EXECUTED; no false PASS.**

**Reconciliation for Work #497:** #498 now touches `app.ts`; C01 #468 and R18 #435 compose there. Preserve their router/service registrations AND this one NDJSON error hunk. Do not ship only C01 or only this change; do not infer full release readiness from 200-stream status. Centered Assistant C07 #480 and five-tab C08 #493 must preserve this status/AI identity for their own distinct workspace. **R19 overall stays PARTIAL_IMPLEMENTATION:** all 17-role real model/audio/language QA, consented memory and staging/deployment remain open.

**Release gates:** bounded source written YES, LOCAL_TESTED NO, CI_EXECUTED NO, authenticated Postgres E2E UNVERIFIED, app source wired YES but Android integration UNVERIFIED, provider/model QA NO, DEPLOYED NO, MERGED NO. Draft #498 remains unmerged.


## Final R19 review extension — streamed expired-auth outcome and final handoff (2026-10-08 UTC)

The streamed session recovery review also found an authentication edge: once `turn-stream` was hijacked, the Gateway replied HTTP 200 and generic `turn_failed` on an expired access token, defeating Dio's 401 interceptor and hiding the actual recovery. The implementation now allows **only** `CustomerAuthError` with HTTP 401, **only before any delta/audio output**, to emit the sanitized machine event `auth_required`. Flutter converts it to `ApiException(statusCode:401, code:AUTH_REQUIRED)` so normal signed-out/sign-in guidance appears; it does **not** auto retry a request on a new identity, nor reveal raw backend error text. After any text/audio output, even that error is generic/unknown and no replay occurs. 403, 503, provider and financial failures remain generic.

**Incremental files** over previous streamed handoff: `services/gateway/src/agent_turn_stream_error.ts` + `agent_turn_stream_error.test.ts` now recognize this single auth class/code; `services/gateway/src/agent_turn_stream_http.test.ts` tests sanitized HTTP 200 NDJSON auth event; `apps/mobile/lib/src/agents/agent_session_recovery.dart` maps safe auth event to 401; `apps/mobile/test/agent_session_recovery_test.dart` verifies sign-in and no replay. No additional shared auth or migration files were modified.

**Last source SHA before this final record:** `0fa0a708420e63ec218580d3e2d743b5646e4e94`; canonical main base `1d6a67ea3c182455b55a7d1d07eacdb4311682e3`. Compared: 39 commits ahead, 0 behind, 18 changed files. This handoff commit becomes the new pushed HEAD. Exact file paths and overlap responsibilities in preceding two sections remain authoritative.

**CI/runtime evidence:** no local tests executed because the container cannot resolve private GitHub for a checkout and lacks pnpm/Flutter SDK; owner Actions #457 still shows failed jobs without steps. No new empty-step CI loops attempted. Unit/HTTP/Flutter test code was authored but **ALL UNEXECUTED**. In particular, Work must verify Fastify hijacked-reply injection tests produce the expected NDJSON body and that an expired access token returns the typed `auth_required` event; do not infer this from code review. Run the whole prior executable command block against actual current PR HEAD.

**Security/reconciliation gates:** Work #497 must merge **the narrow change within `app.ts`** with C01 #468 and R18 #435 service-registration edits; this branch does not claim ownership of those integrations. Confirm A/B tenant and cross-account session boundaries with real Postgres, genuine 401/403 retry fences, interrupted/partial audio streams, developer vs production inference, restart/outbox idempotency, 17-persona model/audio QA and Android tests. One independent auth weakness outside this bounded feature remains: Dio's automatic token refresh is not invoked for a 200 streaming response, so this source intentionally asks for sign-in instead of silently refreshing; no extra paid operation should ever be auto-repeated after a stream error. Keep unknown responses pending for explicit verification.

**Release claim:** this bounded private-persona session and streamed recovery source is `IMPLEMENTED_UNVERIFIED`. R19 as a whole stays `PARTIAL_IMPLEMENTATION`. SOURCE_WRITTEN yes; LOCAL_TESTED no; CI_EXECUTED no; AUTH/POSTGRES E2E unverified; APP source wired yes / DEVICE_VERIFIED no; MODEL/PERSONA VOICE QUALIFICATION no; DEPLOYED no; MERGED no. PR #498 remains **DRAFT/UNMERGED**. Repository claim is released after this checkpoint; subsequent Work ownership must recheck the five-minute lease and actual changed paths.

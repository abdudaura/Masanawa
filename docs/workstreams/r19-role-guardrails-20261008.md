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

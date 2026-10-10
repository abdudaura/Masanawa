# CHAT-P04 — authorized Gwani text before audio (2026-10-10)

**State:** PARTIAL_IMPLEMENTATION (customer CHAT-P04); bounded Gateway stream increment **IMPLEMENTED_UNVERIFIED**, not integrated and not deployed. **Owner/window:** GPT-6 / CHAT-P04. **Base:** `main@7c443966be97e9092cbc1fb98562c75253434326`. **Branch:** `work/chat-p04-authorized-text-before-audio-20261010-gpt6`. Exact-path registry claim: `chat-p04-gwani-text-before-audio-20261010-gpt6` on `factory/claims`. **Source files:** `services/gateway/src/agent_conversation.ts`, `services/gateway/src/agent_conversation.test.ts`; this handoff.

## Actual connected source

The existing authenticated `/agent/sessions/:characterSessionId/turn-stream` route (`services/gateway/src/app.ts`, **not changed**) accepts `onTextDelta` and sends NDJSON `delta` immediately. Previously, whenever the billing/crypto/teaching processors were enabled, the strategy suppressed raw deltas to protect machine directives, but the conversation service never emitted its redacted final result before `renderAudio()`. On slow audio synthesis the customer could receive no text until `done`, despite the canonical run and mobile command already being completed.

The bounded change preserves directive-suppression and billing approval: when post-processing applies, it sends **only the server-settled final reply** as a delta after canonical completion and **before** audio synthesis. When raw streaming is already safe, it preserves the existing model deltas without duplicating final text. An NDJSON callback failure/closed client after durable completion is not reclassified as a failed financial/agent operation; the authoritative turn is recoverable from history. No new endpoint, wallet mutation, schema, actor resolver, model authorization, paid provider or shell edit.

Authored three Vitest cases on the actual conversation service: adversarial billing machine directive must not appear on the stream; settled quote text is observable before a deliberately blocked audio renderer finishes, and a disconnected streaming callback does not falsify run completion; raw safe model deltas remain exactly two chunks without an extra reply. Unhandled `<masanawa_action>`, `<masanawa_crypto_action>` and `<masanawa_learning_state>` machine markup is now withheld from this **early** channel even if post-processing declines it. The pre-existing final `done` reply sanitizer/fallback remains a separate AF04/AF00 review item and has NOT been proven safe. Third regression checks unhandled markup cannot be emitted early. No repository runtime test PASS claimed.

## Finite closure checklist — CHAT-P04 and related acceptance

| ID | Required source / exact path | Owner | Source state | Actual execution / integration |
| --- | --- | --- | --- | --- |
| CHAT-P04-A | Settled authorized text before TTS in `services/gateway/src/agent_conversation.ts` + regression `agent_conversation.test.ts` | this PR | IMPLEMENTED_UNVERIFIED | Vitest/TS **NOT_RUN**; integration SHA none |
| CHAT-P04-B | Existing NDJSON delta → Flutter active stream `services/gateway/src/app.ts` → `apps/mobile/lib/src/state/ai_chat_state.dart` | AF00/AF06 | Existing callback path inspected; exact cross-branch composition **NOT_VERIFIED** | Functional Flutter/API E2E **NOT_RUN**, root files not seized |
| CHAT-P04-C | Cancellation, timeout and first-text-vs-audio stage metrics, redacted p50/p95 and queue/session/provider spans | AF04/AF05/AF13, with AF00 composition | MISSING | Tracing/provider timing **NOT_RUN** |
| CHAT-P04-D | Durable server acceptance independently of AI result, optimistic outbox, restart-safe idempotent reconciliation (CHAT-P02) | AF06/AF00 | MISSING | API/DB/client **NOT_RUN** |
| CHAT-P04-E | Streaming UI stale/failed/reconnect, accurate progress/receipts with sent/request IDs, and delayed-audio negative test | AF06/AF00 | MISSING shared client work | Device/Flutter/API **NOT_RUN** |
| GWANI-P01 | Durable multistep purchase draft with canonical consent and server persistence | AF04/AF01/AF00 | MISSING (separate essential purchase milestone) | No authorization/payments verified |
| Integration | One reviewed non-deploying baseline, safe merge with root #600 + Work #497, source conflict and local fixes reconciliation | AF00 | NOT_INTEGRATED | Integration SHA **none** |

**Closed source item this continuation:** CHAT-P04-A only, as implemented source with authored negative regression. All MISSING/NOT_INTEGRATED entries remain active; this does **not** close CHAT-P04 or the entire chat-speed/billing milestone. Continue implementing next dependency-ready items, not another verification helper.

## Verification and exact execution ownership

**Actually observed in this window:** `node -v` = `v22.16.0`, `tsc --version` = `5.8.3`, `pnpm`, `dart`, `flutter` and `psql` not available; `git ls-remote https://github.com/Baatiku/masanawa.git HEAD refs/heads/main` fails `Could not resolve host: github.com`. A checkout containing actual imported workspace packages is absent. The fetched GitHub source is not a local executable repository. The source edits and tests were committed and are available to read via the GitHub connector. **Executed standalone:** `node` regex smoke on machine tags (7/7 negative/positive inputs; standalone only, not original repository tests). **No Vitest, repository TypeScript, Flutter, PostgreSQL, APK or provider check ran.**

**GitHub issue #457 verified:** hosted Actions quota was 2,000/2,000 minutes, budget $0 / Stop usage. PR #600 Foundation CI run 38027514223 and Mobile Build 38027514188 failed before useful executed-step proof; no claim of source failure or success. Do not re-run exhausted no-step CI as a fake check or increase paid budget without authorization.

**AF13 / executable Node24 + pnpm12 checkout owner** at the *exact final PR HEAD*, from repository root:
```sh
node --version
pnpm --version
pnpm install --frozen-lockfile
pnpm --filter @masanawa/gateway-service test -- agent_conversation.test.ts
pnpm -r typecheck
```
Record actual output; repair any compiler or fixture issues in this PR before merging. **AF00/AF06** then test real authenticated NDJSON Gateway/Flutter flows with intentionally slow or failing PCM provider, verify user sees finalized text before audio, callback disconnect/restart, no leaked directives and no duplicated order. Run the source and E2E checks against the single pinned integrated SHA.

**Safe integration target:** the one AF00-reviewed non-deploying baseline (name/SHA must be published by AF00; `#600` itself is a root feature PR, not automatically a certified non-deploying branch). The bounded composition requires no root source change for this endpoint, but AF00 must review conflict with existing #600, #497 and deployment triggers and publish the integrated SHA. No merge to production main, financial activation or owner local pull from this partial increment. Preserve unseen local APK changes.

**Next implementation owner/action:** AF04 and AF06 finish the rest of CHAT-P04 timing/cancellation/recovery and CHAT-P02 durable server acknowledgment. AF00 composes and assigns runnable qualification rather than requesting local pull.

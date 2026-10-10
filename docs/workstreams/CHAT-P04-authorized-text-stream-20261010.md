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

## Continuation — bounded audio completion (2026-10-10)

**Actual source commits:** `afd343b01ab9fbd9a84c3b02e87e6b92cb2e69d2` (15-second default synthesis deadline, abandon late PCM), `0845be3752e2bc4aa15d9ed460bb86cb35880417` (abort-on-client-disconnect), `5dc046ead062d6d9f96946f86519c82c12d919e1` (synchronous provider failure isolation), `4e34587cf1cc1982aed8c700703e7f3dd20d362a` (three authored negative tests). Exact protected ownership is this PR's already owned `services/gateway/src/agent_conversation.ts` and `services/gateway/src/agent_conversation.test.ts`; no shared route, native renderer, financial or Flutter path was seized.

**Customer behavior:** When a billing/crypto/teaching reply has already been settled and text is visible, optional audio can no longer stall the eventual turn response forever. The audio deadline is configurable (default 15,000 ms; 100–60,000 ms allowed). If the provider ignores cancellation, `Promise.race` still concludes; a timed-out/disconnected call cannot stream later PCM. Disconnect during TTS ends the optional wait without changing the already completed run. Provider synchronous and asynchronous errors do not retroactively fail the settled text. **The timeout does NOT abort payment/model execution:** it begins only after run and mobile shell completion. A provider that fails to honour the signal may still use resources after the text response; the contract requests cancellation, not a guarantee that remote billing has stopped.

**Finite checklist delta (no feature-wide completion claim):**

| ID | Exact source item / current state | Owner / executable next action |
| --- | --- | --- |
| CHAT-P04-A | Early settled text, machine directive early fence: **IMPLEMENTED_UNVERIFIED** in existing `agent_conversation.ts`, existing regression cases; no real runner | AF13 Node24/pnpm12 execute actual Vitest + typecheck on exact PR SHA; AF00 integrate only on certified non-deploying unified SHA |
| CHAT-P04-C1 | Bounded optional TTS wait, upstream audio cancellation, late PCM suppression and synchronous-provider recovery: **IMPLEMENTED_UNVERIFIED**, source commits above + three authored regressions | This PR source complete; AF13 run real tests, AF05 review renderer cancellation |
| CHAT-P04-C2 | Auth, session, command claim, run create, pre-inference, model, post-inference, settlement, first text and audio redacted per-turn source timings: **IMPLEMENTED_UNVERIFIED**. Queue/catalog/internal provider spans and measured p50/p95: **MISSING** | AF04/AF13 extend provider/internal timing and collect real p50/p95; AF00 owns shared composition |
| CHAT-P04-C3 | Model/provider bounded timeout, cancel/status/retry with explicit spend/idempotence recovery: **MISSING**; don't time out or retry financial operations without durable authority | AF04+AF01/AF06, canonical operation/reconciliation owners |
| CHAT-P04-B/E | Actual Flutter/Gateway text, NDJSON reconnect/status, post-disconnect recovery, text-before-slow-audio E2E: **MISSING qualification and shared-client source as listed above** | AF00/AF06 bounded shared paths `services/gateway/src/app.ts`, `apps/mobile/lib/src/state/ai_chat_state.dart` |
| CHAT-P02/GWANI-P01 | Durable early server acceptance plus restart-safe outbox and one persistent multi-turn purchase draft: **MISSING**, distinct milestone source | AF06/AF00 and AF04/AF01 respectively, in their own existing/coherent feature work |
| Integration | Reviewed safe non-deploying unified baseline and source conflicts with #600/#497, **NO VERIFIED INTEGRATION SHA** | AF00 root integrator; do not infer that #600 is nondeploying or ask for local pull |

**Verification:** GitHub source commits and readbacks are structural only; the three new Vitest cases are **NOT_RUN**. The runner here has Node 22.16.0 and globally installed TypeScript 5.8.3 but no private checkout, pnpm, Node 24, Flutter/Dart or PostgreSQL; `git ls-remote https://github.com/Baatiku/masanawa.git HEAD` fails with DNS resolution of github.com. Root command for AF13: `pnpm install --frozen-lockfile && pnpm exec vitest run services/gateway/src/agent_conversation.test.ts && pnpm -r typecheck`. Exact script path must be verified against workspace configuration by AF13 before execution; execution was not simulated as a passing repository suite. AF00/AF06 must verify actual authenticated streaming and disconnect at the integrated SHA, plus safe deployment wiring. Local APK source still unseen.

**Next implementation responsibility:** AF04/AF13 own correlated stage tracing and safe model/tool deadlines for CHAT-P04-C2/C3; AF00/AF06 own protected Gateway/client status integration. Prioritize missing connected source, not another validator or helper PR. PR #612 stays open/partial until remaining requirements are implemented and checked.

### Correlated latency source continuation

**Source:** `3726ad4a6a0426ca1ecaf3efced579b20780acba` extends the existing authenticated `turn` service with one low-volume JSON record per turn, `agent.turn.latency`. It measures `authorization`, `sessionRead`, `commandClaim` where present, `runCreate`, `preInference`, `model` where model inference is invoked, `postInference`, `settlement`, `firstTextMs` and `audio`, plus `totalMs`. The record includes only canonical request/correlation IDs, stage timing numbers and outcome. It deliberately excludes input text, inference output, tool args, balances, account/tenant ID, authorizations, media and provider secrets. Optional injected `onTurnTiming` observers can aggregate; default structured `console.info` emits the same redacted record. Best-effort diagnostics cannot change canonical operation completion. Existing operation replay uses the same request ID and emits completed timing without claiming a new model run.

**Regression:** `ed796ce85ddcfa87cdc240e600e6729e4c348bca` extends the existing actual service Vitest to assert correlated stage fields and absence of raw model/billing directives and user text. The repository suite remains **NOT_RUN**. GitHub source and test blob readback confirmed only textual presence of the implementation and authored assertions, **not type correctness or runtime behavior**.

**C2 still open:** tracing begins inside `turn`, so an admission failure before the inner caught run and upstream HTTP queue time are not yet fully sampled. Internal model/provider/catalog durations and backend DB subqueries need owner-specific instrumentation. No live p50/p95, phone frame metrics, cold/warm/poor-network results, or qualified user-visible first-text measurements exist. AF04+AF13 own those source/instrumentation and real measurement tasks, AF00/AF06 own request-scoped client/API correlation and verified non-deploying integration. Do not mark CHAT-P04 done or ask the owner for a local pull.

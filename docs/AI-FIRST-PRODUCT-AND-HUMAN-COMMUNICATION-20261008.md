# Masanawa — AI-first product, helpful agents and outstanding human communication

**OWNER-APPROVED EXPANSION · 2026-10-08 · implementation plan, NOT shipped functionality**

## 0. Source of truth and decision

Masanawa is not a messenger with a chatbot pasted onto it. It is a **voice-first communications, live human-hosted Talks, qualified Billing/Crypto, learning/work and creator economy platform** whose **Gwani/Gwana operators understand and operate the same products the user sees**. Human-to-human messaging must be attractive even when AI is never invoked, and AI must produce verifiable useful work rather than ungrounded promises. Product is useful to a lone user before their friends join and becomes more valuable through invitations, permitted shared artifacts and creator/Twin experiences.

- **Exactly five destinations:** Talks · Chats · Assistant · Wallet · Agents. Assistant is center, **one private Gwani/Gwana chat with in-header switch**, not an additional Home/Skills/Tools/Tasks bottom tab. Users still have separate private Expert/Twin conversations in Agents. Human DMs belong exclusively to Chats; public stage audio solely to Talks; money authority to Wallet/Gateway; contextual agent action is available from each tab and returns to origin.
- Flutter Android/iOS remains canonical. Server-versioned shell content and later qualified Shorebird patches are the update model; new native/plugin/asset/engine changes require signed binary releases. Read `FLUTTER-RELEASE-AND-SHOREBIRD-POLICY.md`.
- Existing R01–R19/C01–C08 and J01–J11 (plus GJ-01–GJ-17) are **required prior foundations**, not discarded or silently completed by the new U01–U20 delivery overlay. Open draft code is not `main` or production proof.
- **Scope:** consumer platform and its actual authorized services: Gemini Live voice, live public Talks/LiveKit, person DMs/voice notes, creators/Twins, teaching/search/research/work artifacts, NGN and other market-qualified bill payments, NOWPayments custody/crypto where fully qualified, notifications and privacy. WhatsApp/Telegram remain private account-linked assistant channels; don't imply permission to read arbitrary external WhatsApp chats or control third-party apps.
- No unapproved sixth tab, forced chatbot intrusion into a human DM, always-on microphone, model-issued payment, hidden consent, fake receipt, automatic phonebook upload, or pretend E2EE. **Human DM E2EE, groups and peer calling are separate unresolved product/security decisions**; protect their future migration seams without advertising or shipping them by inference.

## 1. Actual audit observations vs roadmap

At base `main` `3613b590e9df54178397bce97bdd2874766817b3`, `packages/agents`, `packages/memory`, `packages/skills`, `packages/tools`, Gateway agent conversation/shell, teaching and specific billing/crypto assistants and Flutter AI chat state exist. These are **source foundations**, not an integrated full-platform autonomous operator. Existing billing/crypto specializations use bounded model-generated action directives; the universal operator must converge through one **typed server-authorized capability registry** and persistent operation journal, never create a second ledger or execute free-form text as instructions.

`apps/mobile/lib/src/screens/chat/chat_list_screen.dart` on main lists AI Character chat threads; it is **not** a verified authoritative human DM inbox. Dedicated C01–C05 and C07/C08 implementations are in draft, often competing/stacked. Consolidation Work PR #497 is draft and verification limited: backend ~1209 pass/1 fail/143 skipped, Gateway typecheck baseline issues, Flutter 443 pass/11 fail, DB/device/provider release evidence missing; CI incident #457 unresolved. Source already implemented in existing draft PRs must be **reused, not written again**.

This expansion closes under-attended product experience and integration. It does not claim R/C foundations are green. Windows must work in isolated paths, consume stable contracts, write genuine tests and create explicit integrator seams; otherwise status PARTIAL_IMPLEMENTATION. Do not wait idle for Work reset where isolated implementation is possible.

## 2. The user outcome: ask → inspect → act → verify → continue

Universal operators Gwani and Gwana must handle **one user-owned task identity** through voice, text, buttons and contextual app controls. A persona switch preserves scoped task references/history and does not roll forward approvals from another quote/persona. The user should not see Skills/Tools/Workflow internals; the agent **knows** the actual product catalog, permissions, version, account, accepted contacts, billing routes, wallet amounts and Talk/Host rules by authenticated backend read APIs, NOT by prompt recollection or hardcoded guesses.

**Operator example A — "Gwana, prepare my Talk tonight about local businesses and invite Musa":**
1. Detect account, current language/quiet mode, availability of Talk publishing and inviter permissions.
2. Read authorized Talk capability/cost/seat policy and Expert availability; prepare title/outline/questions privately; show a concise editable Talk plan.
3. Search contact by opted-in handle / consent-safe scope; disambiguate before exposing/sending.
4. Propose any paid Expert Seat with precise quote. User deliberately approves recipient/message, public Talk publication and any actual charge separately as required.
5. Invoke idempotent typed Gateway operations; only after readback show actual Talk ID, invitation send receipt and pending Expert Seat state. Resume precisely after app restart with no double send or surprise charge.

**Operator example B — "Buy data for my mother":**
1. Reuse explicitly saved permitted beneficiary, otherwise request exact number and country/network; cannot guess from speech.
2. Fetch server-qualified provider, plan, amount, fee and quote-expiry, not catalog guesses. User speaks or taps confirm exact terms, with stronger reauth if required.
3. Recover quote-scoped funding shortfall without duplicate intent; return pending/unknown/settled/refunded states from authoritative ledger and receipt. Never imply money sent merely because model said yes.

**Operator example C — "Continue Wednesday's class":** query only consented, account-scoped lesson/task memory; produce next step, assess answers in Hausa/English or dynamic language; create a shareable document **only after** real file generation/storage and access authorization; surface progress and source references.

**Operator example D — user listening to public Talk:** user privately asks Gwani to draft a question or invite a consenting person; public room audio must NEVER hear Gemini private mic, balance or DM content. Return to same Talk/seat/scroll and respect host admission.

An ordinary **typed/tap-only** user must reach every same result and confirmation as a voice-only user. The agent cannot be the only way to access wallet balances, people chats or supported services.

## 3. Universal platform operation (highest priority)

1. **Typed capability catalog** owned by Gateway: `id/version`, read/prepare/execute permissions, authenticated account/tenant/role/Host/seat/recipient scopes, feature availability, eligibility and regional constraints, prices/quotas, input/output schema, confirmation policy, risk/reauth level, idempotency scope, error/recovery and receipt lookup. The model selects a proposed capability; it does not authorize, mint receipts, execute SQL, change account identity or generate a trusted confirmation. Treat model output as untrusted.
2. **One durable task/operation engine:** append-only authorized state transitions proposed→resolved/clarifying→prepared→awaiting-approval→running→succeeded/failed/unknown/cancelled/reconciling, with causal IDs, audited actor/agent, readback, step statuses and bounded retries. Async unfinished work cannot run without explicit permission and resource budgets; no hidden work after logout/deletion.
3. **Surface-independent dispatcher:** voice/text/tap and supported WhatsApp/Telegram adapters produce identical typed Gateway requests; Flutter maintains visual state, not permission or money truth. No competing magic-tag parsers for newly implemented capabilities; legacy billing/crypto directive adapters must map into canonical typed plan before authorization.
4. **Own-product awareness:** query current logged-in authorized user profile, supported plans and networks, exact ledger balances/availability, relevant Talk state and agent/Expert catalog; capability unavailable must have clear explanation, alternate path and retry. UI entrypoint "Ask Assistant" passes minimal typed reference + allowed intent, never dumps an entire private DM/room.
5. **Task center inside Assistant:** grouped Active · Approval needed · Completed / History (no extra root tab), visible per-step result, cancel if not executed, explain/retry/resume, user-editable drafts, share/download authorized output, task-specific server operation receipts and support/report escalation for unknown outcomes.
6. **No awkward questions:** request only the missing necessary fields; recognize "second one" only within versioned current choices; allow corrected number/contact/amount before quote; spoken "yes" from background/public Talk never authorizes money or message send.
7. **Security:** never read a person's unrelated DM, bypass contact admission, start public microphone, buy Expert Seat or send crypto because a model suggested so; require fresh deliberate confirmation scoped to exact quote/recipient/terms with cancellation and expiry. User can review each allowed agent scope and revoke it.
8. **Observability:** test real successes and forbidden accesses equally; metric taskCompletionVerified, falseSuccess=0, unintendedWrite=0, duplicateFinancialWrite=0, timeToValue, correctionRate, recoveryRate, per-operation cost, model inference/performance, audit evidence without raw sensitive transcripts.

**Product tools to deliver via U overlay:** discover People/Talks/Experts/Twins (C01 privacy), organize/invite/host Talks (R04/R09), owner-only manage Twins/profiles, draft/review/send human messages (C01–C04), user-visible bill/crypto read/quote/reconcile (R05–R08), search/teach/translate/research/create files, view pending support tasks, contextual private help and authorized follow-up. No new provider or country advertised until proven qualified.

## 4. Human chat must be excellent WITHOUT the agent

Baseline messaging must feel instant, honest and comfortable: correct identity/contact consent, optimistic **pending** sends with eventual server ACK, accurate delivered/read where allowed, robust reconnect/delta sync, per-account protected cache, drafts, scroll restoration, media preview, compact input, clear mic vs send, voice-note review, reply/forward/edit/delete within declared semantics, useful search, pinned/bookmarked messages, mute/unread/notification policy and meaningful error recovery. The **message body must never represent an internal crypto transfer**; contextual Transfer starts a quote/review flow in Wallet authority.

Quality budgets are **measurement goals**, not source claims: cached chat list warm p95 <1s, cached thread p95 <500ms on named budget Android; capture 1k-thread/100k-message fixture, reconnect, deleted/revoked member, missing cursors, offline, device switch, duplicate request, source/type/clock/timezone/read status correctness, data usage, memory, cold-start and dropped frames. Avoid startup waiting for AI or wallet services. Conversation remains readable and usable if Live audio, AI, provider or push is down.

The human-owned thread must preserve recognizable humans vs clearly disclosed AI Expert/Twin and not blur public Talk comments into a DM. Blocking/revocation must deny subsequent DM send/read/search/media URL even with stale credentials and cached push link. E2EE is **not currently established** by server-side at-rest encryption: before marketing E2EE, define client key lifecycle, safety and multi-device, user-consented AI access and full device/security testing as an owner-approved separate change.

## 5. Opt-in AI assistance FOR a selected human message

AI is **outside** the human DM by default: no passive transcript scan, notification transcription, unseen membership or background prompt ingestion. Selected-message actions (only when technically/legally permitted and explicitly tapped) include **draft reply, translate Hausa/English/selected language, summarize selected authorized text/voice note, explain, extract a candidate event/task, prepare Talk invitation, create teaching note, and hand off to a Wallet quote with a verified recipient**. Context selector must show exactly what will be disclosed, why, scope/time, redact sensitive text where appropriate, and provide Cancel / Review before send. Results stay private Assistant draft unless manually sent; no AI write back into other human's chat without authorization.

Translation must show source/target language, preserve original and indicate uncertainty, especially money, names, addresses, legal statements and dialect switching. Voice-note transcription/translation is **explicit opt-in only**, with per-file permission and retention/disposal; never route private DM audio into public Talk or assistant Live microphone. User may disable AI assist per-thread globally. Server enforces DM content membership/consent on every read; selected message IDs bounded.

**Product differentiation:** "Chat → useful result" rather than mere AI stickers: from one human message, draft reply, prepare event/Talk, share safe document, invite exact person, initiate a separate confirmed transaction or continue a previous task.

## 6. Continuous, reviewable memory, teaching and finished artifacts

- **Memory:** distinguish ephemeral conversation from consented durable preferences/tasks; store source/time/owner/confidence/TTL; retrieval enforces account/person/Character scopes; provide inspect/correct/delete/disable remember UI; never remember sensitive beneficiary/DM/private financial data silently. Avoid leaked memory between humans and public agent/Talk contexts.
- **Tasks:** durable task list with owner, deadlines (optional), prerequisites, step event journal, narrow permissions, paused/pending states, replay-safe authorization and cross-device recovery. One active task may involve documents, Talks and services, but execution authority remains per-domain.
- **Teaching:** discover topic/goal/level naturally, track checkpoint, practice exercises, corrective feedback, selectable lesson pace/language, return after interruption, generate authorized structured notes and source/verification cues; no fabricated certification/credential. Existing `agent_teaching_assistant.ts` and skills `teaching.ts` are to be extended, not cloned.
- **Files/work:** actual generated/stored downloadable/editable (where format supports it) artifacts with creator, version, permissions, checksum, expiration, preview, safe sharing, failure/retry and revocation. No "I made a PDF" absent persisted file. Make presentation inside the same Assistant conversation, not a sixth tab.
- **Research:** distinguish evidence-backed lookup from model general knowledge, timestamps/recency and source links; uncertain or external-facts tasks never invent verification. External APIs or paid research need server-approved provider/quotas.
- **Proactive:** future opt-in user reminders, Talk reminders, completion follow-up and status notifications with schedules, timezone, budget and clear cancellation; never automatic DM to others or purchases. Product should function without notification permission.

## 7. Talks and Twins that create distinctive value

**Before Talks:** prepare concise outline/questions, suggested permitted guests/Experts, optional title preview and selection quotes, creator learning tips; publish only with Host action. **During:** approved on-demand AI prompt/assistance in private Host controls; public Expert speaking strictly seat/admission/turn/voice constraints; moderate/report via actual Host/safety tools and no free AI-to-AI farming. **After:** only consent- and rights-eligible replay summary/highlights, follow-up question set, permissible clipping/share, actual Host/Twin earnings and payout state. No fabricated replay or settlement.

**Twins:** voice-first onboarding interview, optional consented reference files, owner knowledge boundary, preview/test harness, publish/unpublish, individual permissions, routing to platform when out-of-credit only through transparent published policies, owner analytics, per-task spend and real payable commissions. Never promise impersonation of a real human without permission, or pretend the Twin performed work lacking tool authority. Feedback/scorecards should measure verified task resolution, correction, safety and satisfaction, not number of model replies or paid interactions.

## 8. Adoption, accessibility, resilience and support

A user can immediately receive useful help without importing contacts: private Assistant text/voice, a useful lesson or file, a Talk to listen to or host (where enabled), and supported bill/crypto services. Grow via permissioned Talk invitations, shareable non-sensitive Expert/Twin page, human referral and approved WhatsApp/Telegram assistant links; do not scrape address books or silently relay private messages. Single click/voice intro tutorial is optional, not a long welcome wizard.

Hausa and English voice + script, code switching, correct amounts/names/digits, low-literacy voice and silent tap parity, screenreader/large text/RTL where supported; measured low-end Android/data/battery, weak offline connectivity and account logout/device changes. Push defaults lock-screen safe; independent Talk vs Assistant vs DM audio focus and recording indicators. Provide task-level help/report and truthful pending/unknown recovery; users must never be asked to find raw API tokens.

## 9. Delivery order and release proofs

**Dependencies before release:** C01–C05 human transport, C07/C08 assistant integration, R02 LiveKit/media, R05–R08 money, R11 language, R12/R15 safety, R14 push, R16 readiness, R17 navigation and R18 profile must be requalified. New U01–U20 overlay is decomposed into independent workstreams in `20-WINDOW-AI-CHAT-EXECUTION-20261008.md`, with their own tests and status, but cannot mark inherited prerequisites DONE.

**Golden expansion journeys K01–K12:**
- **K01:** user asks to create a Talk/invite named consented person → preview → exact approved writes → receipts → resume.
- **K02:** one scoped voice/text/tap Task ID, Gwani/Gwana switch, no accidental re-approval after restart or expired quote.
- **K03:** app realizes current real supported service catalog; explains unsupported region/provider without hallucination.
- **K04:** selected human DM → explicit AI assist → draft/translate → user reviews/send only if approved; no broad DM ingestion.
- **K05:** offline text reply and voice note → reconnect → exactly one message, correct delivery status, history across devices.
- **K06:** human conversation search/pin/reply/notification/deep link and block/revoke with no unauthorized indexed results.
- **K07:** live Hausa voice prompt → correction of name/number → quiet typed/tap flow → legitimate document or bill quote without leaked public microphone.
- **K08:** memory consent, inspect/correct/delete, resume study/task on a fresh authorized device, no other-account exposure.
- **K09:** generated document/lesson/file persisted, previewed, shared with chosen audience, revoked/expired and accessible on another device.
- **K10:** Host prepares, runs and concludes a Talk with approved AI Expert, gated replay summary and legitimate creator ledger.
- **K11:** creator trains/tests Twin; scopes abilities and money; readback real usage/eligible commissions; revokes owner access.
- **K12:** opt-in scheduled reminder/task notification (no autonomous purchase or unsolicited DM), cancellation and offline recovery.
**All K journeys require denied authorization, blocked target, expired token, interrupted network/process, retry, account switch, low-RAM Android and no-data-leak testing as relevant.** Real-money/media/device/DB gates remain external until executed.

## 10. Success measures and decision discipline

- **Agent usefulness:** verified end-to-end task completion, actual operation receipt, time-to-useful-outcome, recovery rate, clarity/number of follow-up questions, safe refusal/uncertainty, rate of inaccurate completion claims (**target zero**) and unauthorized/duplicated writes (**zero**).
- **Human messaging:** median/p95 time to first useful local frame, honest server delivery/read latency, outbox recovery, no wrong-recipient delivery, low data/battery and robust notification deep links.
- **Voice:** user-perceived barge-in latency, reconnection, audio isolation, language/number recognition correction and real Android speaker/earpiece behavior.
- **Creator/Talks:** authenticated audience join, actual Host voice, successful tool-limited AI contribution, consented replay usefulness, real settled creator revenue; no spam AI-to-AI loops.
- **Retention:** user returns to complete a real task, lesson, Talk or conversation; do not optimize time spent by manipulative engagement.

**Not authorized automatically:** reading all DMs for smart assistance; E2EE marketing; group chats/calls; importing phonebook; autonomously sending human messages or financial actions; arbitrary third-party app control; new regulated rails/regions; auto-publishing public content or recurring tasks without explicit agreement; ad/subscription revenue promises. Implement interfaces extensibly, keep those capabilities gated and owner-decision-only.

## Canonical references

`CONTINUE-HERE.md`; `docs/PRODUCT-NORTH-STAR.md`; `docs/APP-SHELL-CONTRACT.md`; `docs/END-TO-END-UX-ARCHITECTURE.md`; `docs/OWNER-REQUIREMENTS-TRACEABILITY-20261008.md`; `docs/COMMUNICATIONS-EXTENSION-PLAN.md`; `docs/VOICE-FIRST-INTERACTIONS.md`; `docs/MOBILE-AGENT-EXPERIENCE.md`; `docs/WHOLE-PRODUCT-ACCEPTANCE-JOURNEYS.md`; `docs/FLUTTER-RELEASE-AND-SHOREBIRD-POLICY.md`. The new operator/chat contracts and U01–U20 workbook are additive; original security, domain ledger, Talk and migration contracts always retain their respective authority.

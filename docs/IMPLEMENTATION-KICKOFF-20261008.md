# Masanawa — Definitive Implementation Kickoff (2026-10-08)

## OWNER CORRECTION — full 48-scope backlog and Contacts (2026-10-08)

The first U01–U20 parallel guide was useful but incomplete. The new [master unfinished-scope audit](UNFINISHED-SCOPE-RECONCILIATION-20261008.md) maps every current **R01–R19/C01–C08** plus open PR dependencies; [U21–U30 and foundation F01–F18](ADDITIONAL-U21-U30-AND-FOUNDATION-F01-F18-20261008.md) give each missing product/foundation source an explicit owner, [Contacts contract](CONTACTS-AND-ADDRESS-BOOK-EXPERIENCE-20261008.md) defines the real Chats→New message contact journey, and [79-row historical task ledger mapping](LEGACY-150-TASK-RECONCILIATION-20261008.md) prevents silently losing future/historic tasks. [28 unique additional prompts](ADDITIONAL-WINDOW-LAUNCH-PROMPTS-20261008.md) supplement, do not replace, first 20 prompts. **F windows reclaim existing drafts**, not create conflicting backend/schema/router. Owner coding pause remains lifted for isolated non-overlap; verify real DB/provider/device/CI separately before merge.


## CURRENT OWNER RESUMPTION — ADDITIVE U01–U20 TRACK (2026-10-08)

The owner has **lifted the global pause** for twenty nonoverlapping AI operator, human Chats, Talks and Twins development windows; Work #497 remains draft until later usage resets. Read [20-window executable assignments](20-WINDOW-AI-CHAT-EXECUTION-20261008.md), [product specification](AI-FIRST-PRODUCT-AND-HUMAN-COMMUNICATION-20261008.md), [operator V1](AI-OPERATOR-ACTION-AND-TASK-CONTRACT-V1-20261008.md), [human Chat contract](HUMAN-CHAT-AND-CONTEXTUAL-AI-CONTRACT-20261008.md) and [actual verification gates](20-WINDOW-INTEGRATION-AND-ACCEPTANCE-20261008.md). The original R01–R19/C01–C08 remain prerequisites and owners of their existing domain/finance/communications code. Keep new work in isolated U folders; shared composition/migrations/Firebase/five-tab router have single owners. Unverified feature branches stay draft/unmerged with detailed Work handoffs.


## Mandatory all-window checkpoint and one final Work handoff

**Before claiming, switching or ending any R01–R19/C01–C08/shared lane, read [`docs/FINAL-WINDOW-CONSOLIDATION-HANDOFF-20261008.md`](FINAL-WINDOW-CONSOLIDATION-HANDOFF-20261008.md).** All windows must commit/push a `docs/workstreams/` handoff containing exact PR/branch/SHAs, implementation vs missing production code, executed/unexecuted tests, dependencies, conflicts, blockers and reproducible next steps, and link that record in the PR. The owner will later initiate **one** ChatGPT Work integration window to collect all branches/PRs, reconcile overlapping implementations and migrations, complete implementation gaps, run blocked verification and merge only genuinely verified changes. This does **not** exempt windows from implementing their whole owned source slice now or allow PARTIAL_IMPLEMENTATION to be called DONE.


## Backend-to-database acceptance overlay and stop conditions

**Mandatory before starting each owned slice:** inspect `docs/BACKEND-DATABASE-PORTABILITY-AUDIT-20261008.md`, `docs/BACKEND-FEATURE-TRACEABILITY-20261008.md`, and `docs/DATABASE-REDEPLOYMENT-AND-RESTORE-RUNBOOK.md` when your feature has schema/media/provider/deployment impact. Existing R01–R19/C01–C08 and 77 P/N/T/M/A/W/Q IDs remain the sole task ownership/requirements ledger. An actionable feature is **Flutter screen + typed API + Gateway registration + tenant/auth + domain service + PostgreSQL/media/outbox + authoritative readback + offline/negative/restart recovery**, all implemented in **one owned lane** or explicitly coordinated owned dependencies. Build the whole owned code scope, not a tiny code edit.

**Externally blocked verification policy:** after one confirmed CI/credential/device/service blocker (e.g. #457), **stop retry loops**, continue complete source, author all relevant automated tests and integration harnesses, record exact unexecuted commands/test environment/PR SHA/expected proof and Work owner in checkpoint, keep PR **draft/unmerged**. `PARTIAL_IMPLEMENTATION` = missing owned production code; `IMPLEMENTED_UNVERIFIED` = complete source slice but real checks unavailable; only `VERIFIED_E2E`/`DEPLOYED_VERIFIED` after executed proof. A Gateway code route or Flutter button alone does not pass a feature; a Railway `/healthz` 200 alone does not establish DB readiness; production changes require safe backups/recovery gates.


> **Status: CANONICAL IMPLEMENTATION HANDOFF — DOCUMENTS ONLY.** Read this before opening a new development window. It is a work allocator and evidence gate, **not** proof that the source, running Gateway, Flutter application or release is finished. The owner has approved the end-to-end product design and does **not** authorize "for now" shortcuts or throwaway intermediate architectures.

## 0. First-priority source of truth (read in this order)

1. `CONTINUE-HERE.md` — current main snapshot, active incidents, handoff; never trust a dated embedded summary over newer main/PR evidence.
2. `docs/APP-SHELL-CONTRACT.md` → `docs/END-TO-END-UX-ARCHITECTURE.md` — **only** approved current mobile information architecture and router/return behavior.
3. `docs/PRODUCT-NORTH-STAR.md`, `docs/TALKS-PRODUCT.md`, `docs/VOICE-FIRST-INTERACTIONS.md`, `docs/CONSUMER-SERVICES.md`, `docs/DEFAULT-AI-PERSONAS.md`, `docs/MOBILE-SCREEN-ARCHITECTURE.md`, `docs/MOBILE-AGENT-EXPERIENCE.md` — existing feature-level behavior, subordinated to the five-tab layout.
4. `docs/OWNER-REQUIREMENTS-TRACEABILITY-20261008.md` — **77** tracked product decisions (P/N/T/M/A/W/Q), LOCKED vs QUALIFIED vs explicitly unapproved. Every feature must carry its trace ID.
5. `docs/WHOLE-PRODUCT-ACCEPTANCE-JOURNEYS.md` — **J01–J11** multi-surface completion scenarios; `docs/GOLDEN-JOURNEYS.md` has the earlier GJ journeys, which remain binding as applicable.
6. `docs/MOBILE-READINESS-PLAN.md` (R01–R19) + `docs/COMMUNICATIONS-EXTENSION-PLAN.md` (C01–C08): **one** implementation ledger, including all old and new scope; no second competing milestones.
7. `docs/MULTI-WINDOW-WORK.md` — live ownership, exact-path claims, five-minute stale-activity lease, branch/PR/rebase/integration, test and device evidence.
8. `docs/REQUIREMENTS-RELEASE-GATE-CHECKLIST-20261008.md` — final explicit verification crosswalk and launch disqualifiers.

**Historical documents, old branch handoffs, migration records, screenshots and older PR narratives are evidence only, not new product directions.** `docs/README.md` establishes precedence and `docs/NAVIGATION-DOCUMENTATION-AUDIT-20261008.md` documents which old docs were audited versus preserved as historical. If a referenced contract conflicts with the five-tab design, log the conflict and obtain approval instead of improvising.

## 1. Non-negotiable final consumer design — no temporary redesign

**Bottom tabs, left-to-right: `Talks · Chats · Assistant · Wallet · Agents`.** Exactly five. **Assistant is the center tab** with two tabs on each side.

| Destination | Only primary purpose | Where actions live |
| --- | --- | --- |
| **Talks** | Public Explore/Live vertical single-column human-led audio Talk feed, start/live/stage, reactions/questions/comments/gifts, replays, following | Sole **Start Talk** FAB; Topic → composer → deliberate Go Live; real human Host always; free admitted human Seats / server-quoted paid AI Seats |
| **Chats** | Authenticated **person-to-person** private conversations, indexed quick recent list, unread/search, text, voice notes, safe media | **New message** primary action, people profiles' **Message**, contextual **Transfer** handoff (never the message Send button) |
| **Assistant (center)** | **One** private Gwani/Gwana chat; switch persona within that chat while retaining scoped history/drafts/tasks, attributed replies and secure consent | Voice (native Gemini Live after deliberate mic), typed text and inline tap cards; same permission-scoped server task/action engine |
| **Wallet** | Qualified native fiat/Credits, pending vs available creator earnings and asset/network crypto, exact histories and receipts | Crypto first, then Data, Airtime, Electricity, TV/Cable; exact service quotes, confirmation and network/market/provider eligibility |
| **Agents** | Full Masanawa Experts + Twins catalog, private Expert/Twin **persona** chats, creator's My Twin, paid Seat authorization/invites | Server-verified personae and availability; never duplicate the center Gwani/Gwana operator or silently grant a paid public Seat |

**Header:** Activity bell and editable profile avatar in header (not a sixth bottom tab); settings includes Account/Support/Privacy/Language/My Twin/earnings etc. **Talks is the former Home Explore/Live**; no additional Home bottom destination. Never use current root `Talk` as a second private AI tab. Root theme: bright readable light/white surfaces, contrast-safe vibrant green, semantic tokens; logo and theme may not be unilaterally reset.

**Do not repurpose existing URLs:** new human `/messages`, `/messages/:conversationId`; private Gwani/Gwana `/assistant`; historical `/chats` is old private AI, not human DMs; `/chat/:characterId` is private AI persona; old `/home` maps Talks, legacy old tab queries are typed and preserved. Keep stage, invoices, receipts, personas, profiles and notifications deep-linked to their **correct identity type**. Keep Back, scroll, in-progress drafts and task/session references through contextual navigation. No tab entry may automatically start mic, publish a Talk, approve a paid Seat or transfer money.

## 2. Whole-product boundaries established **before parallel coding**

- **Auth/identity:** canonical tenant + user account + verified session. Human person refs, AI persona refs, public Talk refs, private conversation refs, live room membership, financial recipient refs and action IDs are different **typed domains**. A visible handle, AI persona ID or cached contact can never itself prove payment or DM membership.
- **Private communication:** real people DMs, private Gwani/Gwana Assistant, private Expert/Twin persona conversations, WhatsApp/Telegram assistance, public Talk comments and live stage audio are distinct. Block/report, restricted/deleted accounts, token revocation, audio stream access and attachment URLs checked **on every authoritative read/send/subscribe/upload**.
- **Storage/fast history:** do not create a manual backup/restore product merely for fast loading. Durable server history + per-account protected indexed Android cache + offline pending outbox + delta cursors/realtime catch-up + lazy pages/media and bounded cache are mandatory. Never treat an in-memory AI thread or optimistic local state as a human DM server.
- **Money:** existing custody-backed verified crypto/fiat/credits/earnings ledgers are separate. Account→account internal crypto transfer is an **atomic balanced book transfer**, not fake on-chain transaction, not a fiat universal payment, and not a DM text send. Current R06/R08 financial owners alone qualify custody/spendability, fees, limits, compliance, immutable receipt, fresh consent and once-only idempotency. The AI model or app UI never becomes a ledger authority.
- **Operator:** Gwani and Gwana switch within **one** owned Assistant workspace but remain properly attributed AI personas. Read-only lookups, DM draft+authorized send, Talk create/invite/Host actions and qualified Wallet/Billing/Crypto/profile/Twin support use one typed, independently authorized durable action engine across speech/text/taps. A persona switch, interrupted speech or context change never repeats approval or charge.
- **Live audio:** actual human Host, free human Seat with Host admission, eligible AI seats with priced confirmation; ensure public LiveKit track vs Gemini private audio vs DM voice-recording privacy; no background recording/microphone permission upon landing in a tab. Keep gifts/replay/safety/events and creator earnings/commission contracts intact.
- **Audience / locale:** camera-shy speakers can create/monetize with audio only; low-literacy users can complete approved flows by deliberate voice; silent users can do equivalent tasks by typing/tapping; test Hausa, English and qualified international languages separately from UI locale and money jurisdiction. Do not present unreliable speech transcripts as verified user input.
- **Regulated/qualified:** Flutterwave and NOWPayments operate only where real provider, network, custody, device, KYC/AML and app store requirements are met. A UI listing/secret/config flag alone is never eligibility. Refund/pending/unknown/reconciliation/chargebacks and support are mandatory.
- **No product invention:** WhatsApp likeness does not approve E2EE claims, group DMs, person↔person calls or contact-book upload. Proposed subscriptions/advertising are not guaranteed earning streams. Support a future extensible DM data model but do not add a sixth tab or show inert feature buttons.

## 3. Parallel workstream contracts — choose a *real available lane*

**Before claiming any lane**, inspect fresh `main`, exact open/draft PR changed paths, `docs/workstreams/` claims and issue #457; one writer per exact path. A PR marked draft is not license to overwrite its content. Expired five-minute activity lease permits a **careful reclaim with diff review**, not destructive reimplementation. The table does not preassign people or reserve paths.

| Lane | Independent deliverable and acceptance | Shared integration owner/dependency |
| --- | --- | --- |
| **C01 — communications-identity** | Canonical human account/contact discovery; user-controlled handle visibility, inbox policy, request/accept/decline/revoke, reciprocal blocks/report, deletion; real authenticated A/B and SQL tests. | R12/R15/R18 social/identity; **draft PR #468** now contains substantial unverified code, including Gateway composer and `0016_human_messaging_contacts.sql`. **Resume/review that PR**, do not start a duplicate. R18 #435 touches shared `main.ts`, `app.ts`; resolve semantically. |
| **C02 — communications-core** | Durable 1:1 conversation/message schema, typed membership, ordered stable message IDs, client request idempotency, read/history pagination/edit/delete policy, moderation/rate caps; authoritative send-time C01 consent checks, real Postgres A↔B tests. | Own independent new DM models/repos/routes; coordinate DB migration naming, Gateway composer and R15. **Never** use AI-character conversation tables as human transport. |
| **C03 — communications-realtime** | Authenticated realtime/catch-up, inbox event/outbox, monotonic cursors, offline send retries and ack semantics, unread/read reconciliation, push/deep links and multi-device background/kill. | C02 + R14 (Firebase) and Gateway events; one notification owner. No push event substitutes server history. |
| **C04 — communications-media** | Secure encrypted-in-transit private voice notes, strict upload/type/length/storage bounds, MIME/content/scan, signed access per member, revoke/delete, retry/playback and optional valid image/docs; separate audio session from public Talk. | C02/C03, R02 Live audio owner, storage/privacy R12/R15. No base64 media blobs in Postgres. |
| **C05 — communications-mobile-performance** | Per-account protected indexed cache, recent list/thread first paint without network, lazy 30–50 previous-message pages, sync/outbox, media LRU/data saver, 1k threads/100k-message bounded-memory fixtures and measured warm/cold p95 on budget Android. | C02/C03 contract, C04 media and R16 app quality. Do not edit shared root navbar; preserve account-switch/logout isolation. Can benchmark mock fixture while real API develops; **mock is not release proof**. |
| **C06 — communications-internal-crypto** | Authenticated account-to-account crypto transfers on **existing** custody-backed asset/network double-entry ledger; quote/limits/fees/fresh consent, atomic exactly-once debit/credit, recovery/refund/receipts and DM/Wallet/Assistant entry intent. | **Exclusive financial owner R06/R08** must coordinate existing commerce schema/ledger, compliance, asset balances; C02 just passes verified counterpart as a hint. |
| **C07 — communications-ai-actions** | One switchable Gwani/Gwana private workspace and typed action/operation registry; voice/text/tap parity; task context restore, safe DM drafting/sending, Talk Host actions, read-only support and qualified money with server-confirmed receipts. | R02/R03/R04/R11/R17/R19 plus C01/C02/C06; financial commits are never model-authorized; shared task/route composer coordinated. |
| **C08 — communications-nav-release + R17** | **One** final five-tab shell, center Assistant switch, dedicated Chats and Agents, Talks public Explore/Live/Start FAB, header and profile, Wallet, typed aliases, Activity/notification routing, accessibility and actual Android release. | **Single R17/C08 shell integration owner** (not two competing owners) after C02–C05 APIs exist and C07 state contract is agreed; R01/R11/R14/R16/R18 integration; make no temporary four-tab product. |

**R01–R19 remain mandatory and can continue concurrently** on nonoverlapping owners: R01 contrast/theme; R02 actual multi-device LiveKit/Gemini audio; R03 Expert identity/availability; R04 participant lifecycle; R05 funding/reconcile; R06 wallet/native balances; R07 real qualified billing; R08 custody/crypto; R09 stage events; R10 gift settlement; R11 localization; R12 deletion/privacy; R13 replay; R14 real push; R15 safety/channels; R16 Android/Play/performance/release; R17 final shell; R18 working profile; R19 quality, consented AI personas. Never equate draft PR code to deployed completion.

**PRs to recover rather than duplicate at handoff:** documentation PR #467 (messaging UX reference, still **draft** at time of audit; do not rely on its unmerged text as canon), private contact PR #468 (**draft, code unverified**), profile PR #435 (**draft, shared Gateway overlap**), Actions/verification PR #460 (**draft**). Always query again — these are a snapshot, not permanent claims.

## 4. Shared file/contract integration: hard stops

- **Shared Flutter routes and root tab enum:** R17/C08 designated integration owner ONLY; C05/C07 submit isolated widgets/interfaces via their PR. Do not try to insert a temporary Chats UI into an old Shell that another window will discard.
- **Gateway `services/gateway/src/app.ts` and `main.ts`, root `package.json`, shared auth/providers/types:** integration owner or freshly reclaimed scoped shared edit after checking every active PR; never force-write another window's version. PR #468 already includes *additive* C01 composition; PR #435 includes unrelated avatar composition in **the same files** — their eventual integration must include both.
- **Database migrations:** schema owner claims unique next names, reviews concurrent branches and migration ordering. `talks/0015_profile_avatar_objects.sql` is on #435; `talks/0016_human_messaging_contacts.sql` is on #468. Do not reuse these names, silently rewrite applied migrations or drop identity FKs because integration is inconvenient.
- **Ledger/providers:** financial owner performs write-state integration with quote IDs, ledger sequence and settlement test; a different window must not implement a second credits/crypto/NGN store.
- **Event/realtime/push:** C03/R14 owner chooses exact outbox/event/cursor/expiry semantics, integrates notifications and user settings. No user data from DMs in public stage activity.
- **Secrets/CI/deployment:** #457 with PR #460 and ChatGPT Work coordinates exhausted Actions quota/verification, credentials, runner and release. Don't charge accounts, edit CI billing or merge failed/unexecuted code to show progress. Work can execute tests with terminal/cloud computer; pure GitHub file edits cannot.

## 5. Execution sequence (parallel but gated)

**Immediate, no further product redesign:** independently claim C02 server DM models/authorized APIs; C03 event contracts; C04 bounded private media; C05 local cache benchmarks; C06 qualified financial ledger; C07 actions/persona switch; continue R01–R19 owners. **C01 must resume #468 and pass its actual tests** before anyone treats its contact policy as authoritative. Coordinate all C work with the existing R owners and migration ownership.

**Integration once dependencies pass:** the single R17/C08 owner resolves exact route and session ownership, installs the final five tabs **once**, combines private Chats/Assistant/Wallet/Agents/Talks, runs API→Flutter→Android acceptance. It is acceptable to implement and test isolated APIs before the final shell; it is not acceptable to ship a misleading intermediate shell or pretend missing functions exist.

**Release:** run all 11 J journeys, existing GJ journeys, R/C acceptance and privacy abuse/error/recovery checks. Verify every real provider/asset/market and two-device audio/message paths; freeze/rollback by deployed SHA with monitoring and on-call plan.

## 6. Evidence checklist — never mark a row DONE by appearance

For each R or C feature attach:

1. **Claim:** exact R/C ID, owner, base/feature/main SHA, conflicts/active PRs and IDs from traceability + J journeys.
2. **Source:** backend + Flutter + schema + migrations + auth + API/contract + secret handling + cancellation/back/deletion + absence of placeholders.
3. **Executable verification:** exact command and terminal/log result for `pnpm typecheck`, focused/full Vitest, real PostgreSQL transaction tests, `flutter analyze`, Flutter widget/suite and actual Android APK/AAB or conditional hardware test. No made-up PASS.
4. **End-to-end:** two signed-in independent real users/devices, poor network, restart/account switch, denied mic, large fonts/RTL/languages, payment negative and idempotency cases as applicable; distinguish sandbox vs genuinely live provider.
5. **Performance/operations:** p50/p95 app first interactive/Chats list/thread, network bytes, memory/disk on named low-end phone; service logs/monitor/alerts/privacy with no raw DM content, provider credentials/expiry and rollback path.
6. **Status fields independently:** `SOURCE_WRITTEN`, `LOCAL_TESTED`, `CI_EXECUTED`, `DB_INTEGRATED`, `APP_INTEGRATED`, `DEPLOYED`, `DEVICE_VERIFIED`, `PROVIDER_QUALIFIED`, `MERGED`, `BLOCKED(reason)`. **ONLY validated evidence advances status.**
7. **Reviewer:** check entire J journey entry→success/receipt→error→retry→restart→return state and regression against unrelated Tabs/Talks/finances. No fake success, inert controls, hardcoded contacts/prices, automatic mic or unapproved charges.

### Known current verification blockade (status as at document creation)

GitHub Actions jobs have been failing before executing steps because included Actions minutes are exhausted (2,000/2,000) and the Actions spending budget is $0 with Stop usage enabled (PR #460). #457 owns recovering executable checks. **A zero-step workflow is neither passed nor proof of source failure.** Local/Work executable tests may produce useful evidence, but release CI and Android/provider qualification still require real results.

## 7. Universal new-window execution prompt

> Continue `Baatiku/masanawa` from the latest `main`. **Do not restart planning or redo finished work.** Read `CONTINUE-HERE.md`, `docs/IMPLEMENTATION-KICKOFF-20261008.md`, `docs/APP-SHELL-CONTRACT.md`, `docs/END-TO-END-UX-ARCHITECTURE.md`, `docs/OWNER-REQUIREMENTS-TRACEABILITY-20261008.md`, `docs/WHOLE-PRODUCT-ACCEPTANCE-JOURNEYS.md`, `docs/MOBILE-READINESS-PLAN.md`, `docs/COMMUNICATIONS-EXTENSION-PLAN.md`, `docs/MULTI-WINDOW-WORK.md`, then necessary domain guides. Inspect current code, **all** open relevant PRs (including drafts), claims and CI issue #457. Reclaim one highest-priority **available and nonoverlapping R01–R19 or C01–C08** lane with an exact repository-visible five-minute lease/path claim and its existing branch/PR if present. Implement every owned backend, database, API, mobile, auth, recovery, privacy, spoken and silent interaction to real end-to-end acceptance. Preserve the fixed **Talks · Chats · Assistant · Wallet · Agents** target with **Assistant center and one Gwani/Gwana switchable chat**. R17/C08 alone integrates shared Flutter shell; coordinate Gateway/ledger/migrations/CI ownership rather than overwriting other windows. Run executable tests/builds and real integrations, report blockers truthfully, keep unverified PRs draft/unmerged, commit testable work, and leave a precise SHA-based handoff. Then claim the next nonoverlapping available lane only after a safe checkpoint. **No mock product completion, silent money action, loose financial authority or disposable interim navigation.**

## 8. Documentation freeze — how to change requirements responsibly

The owner has already approved the complete five-tab product direction and the traceability matrix. New windows **do not need another conceptual planning pass**. A genuinely missing/contradictory requirement should be recorded with its P/N/T/M/A/W/Q ID, affected R/C and J, risk/decision and proposed additive remedy; change the **canonical** docs in a separate reviewable change before making source drift. Do not rewrite historical proof to claim prior work passed. Voice/localization or provider compliance decisions may legitimately need external qualification; mark QUALIFIED and work the feasible adjacent code in parallel.

**This kickoff is ready to use when merged to `main` and linked from `CONTINUE-HERE.md`; this file itself does not change app source or release readiness.**

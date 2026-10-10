# Twenty parallel implementation windows — AI operator, human Chats, Talks and Twins

## CORRECTIVE RE-AUDIT — preserve U01–U20, add core recovery and Contacts (2026-10-08)

The original 20-window plan was NOT a complete accounting: it did not assign a full Chats→Contacts/optional phonebook/invitations journey or all unfinished R01–R19/C01–C08 and historical 150-ledger items. Those omissions are corrected by [re-audit](UNFINISHED-SCOPE-RECONCILIATION-20261008.md), [Contacts](CONTACTS-AND-ADDRESS-BOOK-EXPERIENCE-20261008.md), [U21–U30/F01–F18](ADDITIONAL-U21-U30-AND-FOUNDATION-F01-F18-20261008.md), [new launch prompts](ADDITIONAL-WINDOW-LAUNCH-PROMPTS-20261008.md) and [79 unchecked historical tasks](LEGACY-150-TASK-RECONCILIATION-20261008.md). **All current U01–U20 scopes remain valid.** F scopes recover/reconcile existing R/C branches without duplicate migration or API; 48 scopes must NOT all edit shared paths simultaneously. K13–K20 Contacts acceptance is required in addition to K01–K12.


**Owner authorization: 2026-10-08. Development pause lifted with coordination safeguards.** This document is the operative U01–U20 **addition** to existing R01–R19/C01–C08. The owner will run 20 ChatGPT development windows and later ask ChatGPT Work to combine/verify outstanding source. **Start code now in isolated workstreams; do not wait for Work usage to reset.** It does NOT waive verified CI/device/provider/DB gates, entitle any lane to merge unsafe work or grant general permission to edit shared root code.

**For 20 separate copy/paste prompts:** [`20-WINDOW-LAUNCH-PROMPTS-20261008.md`](20-WINDOW-LAUNCH-PROMPTS-20261008.md) labels each window U01–U20; use one prompt per window, not twenty copies of U01.

**Read FIRST:** `CONTINUE-HERE.md` owner resumption notice, `docs/MULTI-WINDOW-WORK.md`, `docs/IMPLEMENTATION-KICKOFF-20261008.md`, `docs/AI-FIRST-PRODUCT-AND-HUMAN-COMMUNICATION-20261008.md`, `docs/AI-OPERATOR-ACTION-AND-TASK-CONTRACT-V1-20261008.md`, `docs/HUMAN-CHAT-AND-CONTEXTUAL-AI-CONTRACT-20261008.md`, `docs/20-WINDOW-INTEGRATION-AND-ACCEPTANCE-20261008.md`, then relevant domain and R/C contracts. **Do not use the 20-window document as a substitute for source inspection.**

## 0. Immediate operating rules: all 20 can work, zero duplicate owners

1. **No global source freeze.** The former consolidation pause (2026-10-08 13:44Z) is historical; owner lifts it explicitly as of this guide. ChatGPT Work #497 remains a **draft handoff/partial integration** and its touched paths/semantics remain protected until reconciled; if Work resumes, current five-minute path claims override old snapshots. Every window should begin on **fresh main**, not copy Work's unreconciled patchset as if merged.
2. **One writer per exact path and migration sequence** across ALL branches, including existing R/C PRs. U scopes below are *suggested exclusive new module roots*, not a license to overwrite files already claimed on a live branch. Inspect `main`, open/draft PR file lists, `docs/workstreams/`, applicable recently updated heads, R/C known collision pairs and published claims. When a PR implements similar scope, **recover/reuse** rather than reimplement. A five-minute ownership lease expires on inactivity but does NOT abandon unmerged source: reconcile existing diffs and request owner coordination before rewriting.
3. **One canonical operator contract (U01), one task engine (U02), one Flutter Assistant presenter (U03), one Gateway action adapter (U04), one final shared Gateway composition owner (Work/R-C integration), one root navigation owner (R17/C08), one financial owner (R05/R06/R07/R08/C06), one messaging schema owner (C01/C02/C03/C04/C05), one Firebase/R14 integration owner.** No window can add a competing auth system, payment ledger, DM schema, router, microphone runtime, service registry or generic remote execution.
4. **Isolation:** U windows implement **complete independently verifiable components** in new subdirectories (see each scope), with mock-free application paths where possible and real adapter/integration tests; they may publish new contract interfaces/fixtures for cross-lane consumption. Shared `services/gateway/src/main.ts`/`app.ts`, gateway auth/composer, DB migration registry/sequence, `apps/mobile/lib/src/router/app_router.dart`, bottom tabs, global pubspec, Firebase native files and wallets/ledger are **integration-only**. Changes requiring them must be proposed as exact compositional patches in handoff and applied by designated owner after tests. Do not hide unfinished attachment to product behind a claim of DONE.
5. **Concurrency protocol:** Each U PR publishes a unique branch `work/uNN-<slug>-20261008`, a **fresh claim + exact touched path list** in `docs/workstreams/uNN-<slug>-20261008.md`, base and head SHA, upstream PRs reviewed, tests and conflicts. All 20 windows should stay within their module scopes. A stale lease is neither an exclusive permanent file lock nor carte blanche to erase important work.
6. **When blocked:** CI #457 quota, absent providers, Mac/iPhone, native Android or DB runner cannot justify waiting or calling a false PASS. Finish all implementable owned layers, write realistic negative tests and test scripts, and record exact unexecuted commands once. `PARTIAL_IMPLEMENTATION` if code or source wiring still absent; `IMPLEMENTED_UNVERIFIED` only if owned complete code exists but actual tests blocked. **Every feature PR remains DRAFT/UNMERGED until executable full proof and safe integration.** Product cannot release from docs or green mocked tests.
7. **Dependency behavior when launching all 20 simultaneously:** U01 publishes proposed typed v1 interfaces/examples first. Other windows may implement independent modules against the V1 document and pin a declared revision; U02/U03/U04 cannot silently invent conflicting schemas. R/C interfaces not merged → consume typed draft fixtures/adapters, mark real composition pending. No idle duplicate task-taking; each window finishes its owned slice.
8. **Platform:** Flutter consumer only, five-tab destination unchanged; Gwani/Gwana one header-switchable private Assistant, human chats do not become AI chats. Developer tokens/keys never appear to users. iOS/Android native changes use normal signed binary + later verified Shorebird, no OTA native bypass. Backend owns permissions/receipt truth.

## 1. Two rings and dependency overview

**Ring A: independent contract, task, memory, teaching, artifact, privacy and user-experience modules** (U01, U02, U05, U06, U07, U10, U11, U12, U13, U17, U18, U19, U20). Start immediately against fresh main; build tests and adapters and review existing R/C drafts.

**Ring B: platform integration-dependent modules** (U03, U04, U08, U09, U14, U15, U16). Start in parallel building scoped source/tests, but strictly consume U01 v1 and R/C existing APIs; never promise live integration until canonical composer and required R/C source are merged/verified.

| U | Owner/result | Suggested isolated ownership root (not auto-lease) | Key inherited dependencies |
| --- | --- | --- | --- |
| U01 | Universal operator capability contract and security/compatibility fixtures | `packages/operator-contract/**` | Agents/Tools/Gateway/Identity; C07 |
| U02 | Durable task and operation journal with reconciliation | `packages/operator-tasks/**`, `adapters/storage/postgres/src/operator_tasks/**` | U01, R/C domain receipts |
| U03 | Single Assistant task-center Flutter UI and server state | `apps/mobile/lib/src/operator_workspace/**` | U01–U02, C07, R17/C08 |
| U04 | Server-side cross-product capability adapters and authorization | `services/gateway/src/operator_actions/**` | U01–U02, R04, C01–C06, finance owners |
| U05 | Opt-in scoped agent memory/personal preferences and review | `services/gateway/src/operator_memory/**`, `apps/mobile/lib/src/operator_memory/**` | U01, existing memory/security, R12 |
| U06 | Teaching/lesson continuity and actual progress UX | `packages/skills/src/teaching_extensions/**`, `apps/mobile/lib/src/learning/**` | U01/U05, existing teaching assistant |
| U07 | Persisted verified work artifacts/file handoff | `services/gateway/src/work_artifacts/**`, `apps/mobile/lib/src/work_artifacts/**` | U01/U02, storage/privacy |
| U08 | Explicit selected-human-message AI assist bridge | `services/gateway/src/human_ai_assist/**`, `apps/mobile/lib/src/human_ai_assist/**` | U01, U03, C01–C05, C07 |
| U09 | Private Gemini Live voice/task continuity and quiet parity | `apps/mobile/lib/src/operator_voice/**`, `services/gateway/src/operator_voice/**` | U01–U03, R02, R11/C07 |
| U10 | Human-chat composer and everyday thread polish | `apps/mobile/lib/src/human_chat_ux/**` | C02/C04/C05, R17/C08 |
| U11 | Scoped DM search, pins/bookmarks and revocation | `services/gateway/src/human_dm_search/**`, `apps/mobile/lib/src/human_chat_search/**` | C01–C03/C05, privacy |
| U12 | Accessible private media preview/player/attachment UX | `apps/mobile/lib/src/human_media_ux/**` | C04, R02 media boundaries |
| U13 | Personal DM notifications/mute/unread privacy policy | `services/gateway/src/human_dm_preferences/**`, `apps/mobile/lib/src/human_chat_preferences/**` | C03/R14, C01 |
| U14 | Talk Host preparation operator and invited guest review | `services/gateway/src/talk_host_copilot/**`, `apps/mobile/lib/src/talk_host_copilot/**` | U01/U04, R04/R17/C01 |
| U15 | Live Talk AI stage copilot: bounded context and host safety | `services/gateway/src/talk_agent_live_copilot/**` | R02/R09/R15, LiveKit and AI Seat |
| U16 | Permissioned Talk post-session summaries and follow-up | `services/gateway/src/talk_post_session/**`, `apps/mobile/lib/src/talk_post_session/**` | R13 replay, U07, R10 earnings |
| U17 | Twin interview/training/preview/knowledge owner experience | `services/gateway/src/twin_training/**`, `apps/mobile/lib/src/twin_training/**` | R03/R19, U05/U07 |
| U18 | Twin trust, verified quality, cost/commission visibility | `services/gateway/src/twin_quality/**`, `apps/mobile/lib/src/twin_quality/**` | U17, R06/R10/R19/creator ledgers |
| U19 | Hausa/English, low-end UX, onboarding/benchmark suite | `apps/mobile/lib/src/experience_quality/**`, `apps/mobile/test/experience_u19/**` | R11/R16, C05, Voice |
| U20 | Cross-feature contract/evidence, releases and incident readiness | `tools/product_qualification/**`, `docs/workstreams/u20-*.md` | All; Work #497, CI #457, Shorebird |

**Important:** suggested module directories intentionally avoid current shared Flutter `router`, Gateway `main.ts`, Firebase and ledger. They are not substitutes for real final integration. More than one new Postgres module MAY exist; only the designated migration integrator chooses final migration numbers and edits registry, with all chains and constraints tested together.

## 2. Twenty precise assignments (one window each)

### U01 — Canonical capabilities and safe action protocol
**Mission:** turn AI app-use from ad-hoc system-message directives into a real versioned, auditable action language consumable by Gwani, Gwana, user taps and typed requests.
- **Deliver:** actual buildable `packages/operator-contract` schemas/types/validators/fixtures with capability ID/version, argument schema, domain authorization prerequisites, per-action read/prepare/execute/confirm/reconcile classification, client negotiation, error and receipt reference; typed adapters for existing `agent_shell` action and billing/crypto directive formats *without editing their active source*. Define compatibility table for 5 tabs and server-driven cards, no free-form executable tool.
- **Tests:** reject forged user/tenant/Host/DM membership, unknown ID/version/extra fields, replayed approval, incomplete consent and untrusted model output; compile cross-module fixtures and show one version-negotiation failure with safe client fallback.
- **Integration:** U02/U03/U04/U08/U09 consume this one contract; propose exact wiring path to Work instead of changing `main.ts`, C07 or canonical finance handlers.
- **Do not:** duplicate `@masanawa/tools` executor, grant new authority, mutate wallet/DM.
- **Handoff:** `docs/workstreams/u01-operator-contract-20261008.md`.

### U02 — Durable task engine, recovery and approval state
**Mission:** app-level AI tasks survive retries, persona switches, app restarts and multi-device access; completed = verified.
- **Deliver:** one authorized task/step state machine + Postgres repository and additive proposed migrations, per-user/tenant indexes, append-only events, optimistic versioning and task operations, idempotency, separate read-only vs irreversible classes; status lookup, unknown/reconciling, expiry/cancel and audited task list. New Gateway service module (without shared route composition) or contract route wrapper with authenticated admission. Preserve actual domain operation/receipt ID linkage, no fake acknowledgements.
- **Tests:** transaction concurrency same task/action, denied account/member, process restart, lost commit response, duplicate device confirmations, stale approval, logout/revoke, unknown outcome and replay. Run ephemeral PostgreSQL where possible; record exact skipped DB test evidence.
- **Do not:** store model-provided receipt as final, modify financial ledger/migrations registry, mark async provider unknown successful.
- **Handoff:** `docs/workstreams/u02-durable-operator-tasks-20261008.md`.

### U03 — One Assistant workspace with full task cards
**Mission:** users see the operator performing authorized work in **single Gwani/Gwana Assistant**, not just chat bubble and dead button.
- **Deliver:** isolated Flutter task-center/controller/widgets consuming U01 events and U02 readbacks; Active/Needs approval/History within Assistant (no bottom-tab change); draft edit, plan steps, approval identity/terms and expiry, progress, file/receipt links, cancel/retry/Resume, inaccessible capability and private contextual return-to-origin. Preserve header persona switch and state using C07's isolated controller, not a second Assistant store; wire through adapter harness until R17/C08 owner composes.
- **Tests:** widget & controller real DTO fixture flows voice/text/taps, outage/restart, uncertain response, account switch, screen reader/large font, Talk→Assistant→Talk, no double confirm. Flutter tests cannot claim server operation success.
- **Do not:** edit root router, C07 source in another PR or claim model action as accepted.
- **Handoff:** `docs/workstreams/u03-assistant-task-center-20261008.md`.

### U04 — Scoped platform-service action adapters
**Mission:** one registry maps actual Masanawa functionality to the operator, rather than free-text "please go click Wallet".
- **Deliver:** Gateway isolated typed adapters (and test harness) for account capabilities, Talks discover/draft/host/invite, consent-safe People/DM draft+review/send, Wallet/agent directory/balance/eligibility and read-only profile/settings; financial quotes and internal crypto ONLY delegate to existing R/C-owned authenticated quote/approval endpoints with actual eligibility. Implement exact typed status mapping, quota/rate/amount/approval class, user-scoped audit and "not qualified" fallback. Reuse existing APIs; don't implement new financial ledger, DM schema, Talk admission logic.
- **Tests:** auth denied, non-Host, blocked person, unauthorized Twin, revoked quote, unsupported jurisdiction, downstream 5xx/timeout, duplicate post, forged AI tool call, actual readback on completed operation where repo allows. Backend integration executable with injected real service/test DB when possible.
- **Do not:** write gateway `app.ts`/`main.ts`, bypass C02 registration or send messages from unreviewed model text.
- **Handoff:** `docs/workstreams/u04-operator-service-adapters-20261008.md`.

### U05 — Reviewable opt-in personal memory
**Mission:** agents retain useful user-approved preferences and task contexts without surveillance.
- **Deliver:** existing `@masanawa/memory`-backed projection/adapters for consented remember/correct/forget/list, separate preference vs active task checkpoint vs research record; source/time/scope/TTL/provenance and deletion/revocation; Gateway service isolated, Flutter private Manage memory sheet. Must reuse canonical memory authorization instead of creating unrelated store; no automatic capture of all DMs, financial secrets or private Talk audio.
- **Tests:** opt-out, correct/delete after restart, cross-account and Twin/public isolation, prompt injection in retrieved memory, revoked source, retention, absent memory safe behavior, user-visible review.
- **Do not:** promise memory from module presence, persist full human DM by default, change `packages/memory/src/index.ts` without owner.
- **Handoff:** `docs/workstreams/u05-opt-in-agent-memory-20261008.md`.

### U06 — Teaching that completes actual learning
**Mission:** make teaching skills concrete, progressive, multilingual and useful across days.
- **Deliver:** extend canonical skill teaching/agent teaching checkpoint adapters, lesson plan with topic/goal/level, worked examples, exercises, answer evaluation and corrections, adaptive "repeat/simpler/slower", progress summary and return after device/session switch. Flutter learning progress/lesson cards within Assistant/Agent conversation; document/shareable notes use U07 interface, no fabricated qualification/certification.
- **Tests:** Hausa/English and mixed prompt, wrong learner answer, lesson continuity, failed model response/garbled state, isolation, invalid hidden tag, long content bounds, restart. Do not rely solely on prompt examples to claim teacher-quality.
- **Do not:** replace existing `agent_teaching_assistant.ts` while current R/C owners active; publish adapter integration diff for Work.
- **Handoff:** `docs/workstreams/u06-teaching-depth-20261008.md`.

### U07 — Work artifacts, files, truthful outputs
**Mission:** downloadable real work from the same chat, not text claiming an unattached PDF.
- **Deliver:** secure bounded artifact creation/storage contract, owner and sharer capability, actual file metadata/checksum/MIME/size, provenance, version, preview, signed read/revoke/delete/expiry, virus/content validation and durable generate→ready/failed/readback. Flutter file/result part UI with real upload/download state, safe failure and share permission. Reuse existing file/media/object store capabilities and build adapters, don't duplicate core object storage authorities. At least one real supported format end-to-end in local tests.
- **Tests:** fake result without file must fail, 401/403/expired download, mismatched checksum, size type injection, revoke then stale URL, resumed interrupted generation, cross-account access, permissioned share and disabled offline download.
- **Do not:** ship raw model URLs or promises of "generated document" without persistent artifact.
- **Handoff:** `docs/workstreams/u07-trustworthy-work-artifacts-20261008.md`.

### U08 — Selected-message AI help bridge
**Mission:** human DMs get opt-in "Ask Gwani", translate, draft reply, task/event/Talk preparation; AI never becomes invisible DM member.
- **Deliver:** bounded selection token+message IDs, current C02 membership/block/revision recheck, precise disclosure and consent notice, private Agent task context, no blanket DM history access, ephemeral redaction, generated draft and reviewed send via existing C02 idempotent endpoint. Flutter long-press selected message action sheet and safe original-thread return **as isolated widget/adapter**, not existing shared message screen edit. Include optional opt-in transcription adapter for permitted voice note only.
- **Tests:** nonmember, edited/deleted/revoked selected ID, stale link after block, malicious injection in text, transcript rejected, never auto-send, correct sender/receiver, consent revoked mid-action, no other messages in model context.
- **Do not:** build a new DM database or weak plaintext "AI automatically understands all chats".
- **Handoff:** `docs/workstreams/u08-selected-dm-ai-assist-20261008.md`.

### U09 — Native private voice operator and seamless switching
**Mission:** real Gemini Live voice, typing and taps retain the **same task/confirmation**, without public Talk audio leakage.
- **Deliver:** isolated native audio task-to-turn bridge, start/stop/interrupt/barge-in/reconnect, private session status and explicit mic activation, safe audio focus between public LiveKit Talk/DM recorder/private Gemini, Hausa/English code-switch correction and uncertain recipient/amount review; Flutter voice UI plus typed/tap parity to U03 task contract.
- **Tests:** denied mic/offline/reconnect, private/public simultaneous audio focus, ear/speaker/Bluetooth path via device test instructions, persona switch mid-speech, kill/resume task, no stale quote approval from ASR; live device and provider tests must stay unverified if unavailable.
- **Do not:** browser TTS substitute, always-on mic, fork existing R02 LiveKit worker, fake audio synthesis.
- **Handoff:** `docs/workstreams/u09-private-live-voice-operator-20261008.md`.

### U10 — Everyday human chat composer polish
**Mission:** make C02/C05 real chats feel simple and responsive, even with AI off.
- **Deliver:** compact Flutter human-only composer, multiline/emoji/media triggers, mic-versus-send behavior, local per-thread draft, reply quote, edit/delete UI where C02 server supports, simple pin/archive/unread controls via capability gating, accurate outbox/ACK/retry, offline/reconnect state, back/scroll preservation. Reuse real C02/C04/C05 adapters and business models; isolate components under dedicated folder for C08 final composition.
- **Tests:** keyboard/IME/small screens, duplicate tap, draft rehydrate/account switch, accepted vs delivered vs read, replying tombstone, retry after killed app; no direct money via text send.
- **Do not:** edit C02 `human_dm` implementation/central router or present unsupported UX buttons.
- **Handoff:** `docs/workstreams/u10-chat-polish-20261008.md`.

### U11 — Permissioned human DM search and organization
**Mission:** users find messages, contacts and things they shared without leaking private data.
- **Deliver:** isolated search module over canonical C02 messages, actual tenant/current member authorization, query sanitization/rate/pagination, server-deletion/blocked/tombstone/revocation awareness, filter contact/date/type, protected local search entry if C05 allows. Star/bookmark/pin metadata with per-user privacy and reliable sync **only if** backing storage implemented. Flutter search UI as isolated component; no AI index access.
- **Tests:** A/B/C unauthorized index access, guessed UUID, blocked member/media, account switch, removed/deleted message and stale search result, Unicode Hausa/Arabic/emoji, 100k-message pagination/benchmark, revision conflicts.
- **Do not:** add parallel C02 schema or edit shared DB registration; migration identifier elected by later integrator.
- **Handoff:** `docs/workstreams/u11-chat-search-privacy-20261008.md`.

### U12 — Voice notes and attachment excellence
**Mission:** C04 secure media should feel easy and reliable on low-end phones.
- **Deliver:** accessible Flutter private voice note record→pause/stop→preview→bounded upload→progress→retry→private playback; image/doc safe previews and verified file type, optional compressed/data-saver quality only with security and original retention policy, persistent referenced media status from C04. Handle audio focus and mic denial; no automatic background capture.
- **Tests:** real C04 DTOs, wrong MIME/oversized, flaky upload/orphan/duplicate, permissions, stale signed URL, blocked user, partial cached media, lifecycle background/focus, screenreader.
- **Do not:** invent S3 policy/API or rewrite C04 active Gateway routes; coordinate separate native permission review with R02/R14.
- **Handoff:** `docs/workstreams/u12-human-media-ux-20261008.md`.

### U13 — Notification, mute, privacy and unread reliability
**Mission:** genuine human messaging notifications without wrong-account disclosure.
- **Deliver:** per-human-chat mute/read/privacy policy service and account-scoped Flutter settings projection; R14/C03 FCM/APNs adapter seams, badge/unread reconcile and notification deep-link target validation; a user can mute chat, choose privacy-safe previews, block sender and re-open correct permitted thread after OTP refresh.
- **Tests:** muted/background/killed, duplicate event/FCM, revoked contact, stale deep link, logout/account switch, multiple devices, lock-screen redaction, unread/read cursor ordering; device-level FCM/APNs checks when possible.
- **Do not:** edit Firebase native files/CI, overwrite C03 realtime core or store private text unencrypted in push payloads.
- **Handoff:** `docs/workstreams/u13-chat-notification-trust-20261008.md`.

### U14 — Talk Host preparation by operator
**Mission:** an ordinary person can host a compelling Talk without writing a script.
- **Deliver:** operator prepare/edit topic/title/questions, suggest only real available authorized Experts, discover invited human from accepted contacts, preview seat price, Host's review/approve invite/publish. Draft and step actions bind exact Talk ID and host scope; local Flutter prep cards and explicit "Go Live" (no auto-publication).
- **Tests:** unauthorized/non-Host and blocked person, revoked draft/expired quote, option list revision, no automatic paid Seat, nil Experts truthful, failed invitation status, process resume, typed/voice parity adapter.
- **Do not:** overwrite R04/R09 live admission or public Talk router; Work later wires Host action.
- **Handoff:** `docs/workstreams/u14-talk-host-copilot-20261008.md`.

### U15 — On-stage agent usefulness and safety
**Mission:** AI Expert improves real human-hosted live discussions safely.
- **Deliver:** isolated bounded live-stage context helper, host-suggested questions, optional Host-facing "next question"/fact-check suggestion and real approved AI Seat turn selection/ack; audience/Host roles, paid authorization, turn budget, explicit stop/rejoin, privacy-safe event summary and no AI-to-AI infinite loop. Reuse current R09 stage context and R02 worker as authority; do not mutate those active files.
- **Tests:** forged stage comment, private DM/money leakage, non-admitted AI, absent Host, mute, duplicate LiveKit turn, costly reaction flood, hold/rejoin, under/over fee limits; real two-device audio deferred if no media environment.
- **Do not:** make generic Agent voice autonomously broadcast, auto-buy Seat, or self-moderate beyond Host controls.
- **Handoff:** `docs/workstreams/u15-live-talk-agent-copilot-20261008.md`.

### U16 — After-Talk replay, insights and follow-up
**Mission:** audio Talks produce usable, truthful ongoing value.
- **Deliver:** rights-checked replay summary/highlights and host-owned next-Talk suggestions only when R13 recorded media exists and Host/participant consent & retention permit; bounded transcript provider/model processing with privacy/safety filters; persisted result/file ref via U07, clear unavailable if no recording/storage; optional approved share/invites.
- **Tests:** no replay/recording permission, ended/expired/tombstoned asset, cross-user access, replay size/cost, malicious transcript prompt injection, generation failure/recovery, no generated share without permission, creator settlement not fabricated.
- **Do not:** write R13 replay pipeline/ledger or infer consent merely from public Talk status.
- **Handoff:** `docs/workstreams/u16-talk-replay-insights-20261008.md`.

### U17 — Twin creation/training and preview
**Mission:** owner creates a genuinely helpful Twin in one conversational interview, not a long internal admin form.
- **Deliver:** owner-only voice/text/tap interview for role/expertise/style/boundaries/consented files; preview test conversations using published cost and real agent strategy, draft → review → publish permissions with real owner authorization, changes versioned and rollback-safe; "Direct Twin" owner safety preserved; no public Talk auto-create. Flutter guided Twin management and account-switch protection.
- **Tests:** impostor owner, non-consented identity cloning, unscoped memory/knowledge, conflicting persona draft/revision, absent funds & routing policy, language correction, publish fails honestly, no unrelated user can train/read owner info.
- **Do not:** fork Character identity/persona version schema or override R19 safety.
- **Handoff:** `docs/workstreams/u17-twin-training-20261008.md`.

### U18 — Twin quality, creator economics and trust UX
**Mission:** user sees whether Twin helps and earns real money, not vanity counters.
- **Deliver:** accurate owner-visible session/task result and failure, owner feedback/corrections, per-Twin quota, commission attributed to real eligible transaction, available vs pending earnings, charged provider/token cost and policy, inactivity/malicious use controls; privacy-aggregated analytics with consented details only; Flutter owner dashboard and dispute/support path. Reference canonical R06/R10/creator ledger without replicating financial authority.
- **Tests:** fabricated earnings rejected, gift/payout/transfer mismatch, replayed attribution/commission, privacy-safe feedback, non-owner denied, account switch, budget exhaustion/reroute policy, cancelled/unknown transaction no success.
- **Do not:** mutate official payout reconciliation or promise unconditional commission.
- **Handoff:** `docs/workstreams/u18-twin-quality-economics-20261008.md`.

### U19 — Access, localization, onboarding and low-end performance
**Mission:** Masanawa useful on a budget Android, to a Hausa/English user and someone who cannot speak/read comfortably.
- **Deliver:** isolated optional "try useful task" onboarding/safe tutorial, specific Hausa/English localization and amount/phone/time/number UX fixtures, talk/chat/assistant silent/voice route test harness, first-use no token prompt, measurement harness for p50/p95 cached chat/Assistant/Talk entry, network bytes/RAM/frame battery and poor data. Accessibility semantics/touch targets/large text, RTL capability fallback; record known design-language conflict (older green requirement vs newer owner blue preference) as pending owner visual sign-off, **no palette reset**.
- **Tests:** cold/warm/airplane+restart, 1k chats/100k histories, large fonts, Talk audio permission denied, keyboard, Arabic/emoji/Hausa Unicode, numeric mishear correction, accessibility traversal; measured device evidence separately.
- **Do not:** change global router/theme or assert budget targets without real device.
- **Handoff:** `docs/workstreams/u19-access-performance-20261008.md`.

### U20 — Contract test crosswalk, rollout safety and final Work reconciliation kit
**Mission:** stop 20 branches becoming an unmergeable tangle; make release QA provable.
- **Deliver:** reproducible scripts/harness under `tools/product_qualification` to inventory PR heads/changed paths (read-only), validate canonical U01 fixture compatibility for each lane, list migration filenames without applying production, run golden K01–K12 + J01–J11 + R/C checks by environment, baseline release metrics/schema compatibility and dangerous financial/DM/privacy regression. Document test commands, dependencies, stubs vs actual external connectors and security sign-off; align first Shorebird patchable baseline to already merged canonical docs, no production patch executed.
- **Tests:** harness itself against fixture PR inventory, failing deliberately on duplicate migration/shared-file collision, unknown action version, unexecuted test misreported as PASS, missing required external DB/Android/FCM/voice/finance credential. Produce Work-ready merge ordering and risk ledger.
- **Do not:** modify GitHub Actions spending/runners, push release, change Firebase/signing/actual production deployment, merge other PRs, or claim an integrated device pass from isolated branches.
- **Handoff:** `docs/workstreams/u20-qualification-handoff-20261008.md`.

## 3. Explicit dependency/admission graph

```text
Existing R/C source + real contracts
       ├── C01 contact → C02 DM → C03 realtime → C04 media / C05 cache
       ├── C07 private Assistant + R17/C08 final shell
       ├── R02 LiveKit/native audio + R09 Talk agent + R13 replay
       ├── R05–R08/C06 ledger/provider & risk / R14 Firebase
       └── R03/R19 identities + Twin ownership/creator balances
                    ↓
U01 canonical operator actions ── U02 task journal ── U03 Flutter task UI
           │                  │                │
           ├─ U04 service adapters ── U14 Host copilot / U15 stage / U16 replay
           ├─ U05 memory ── U06 teaching ── U07 artifacts ── U17 Twin ── U18 quality
           └─ U08 selected DM AI ── U09 private voice
C02–C05 ── U10 chat polish / U11 search / U12 media / U13 notifications
R11/R16/C05 ── U19 accessibility, low-end speed and onboarding
                       ↘ U20 contract/CI/device/OTA release matrix
                                 ↘ ONE final Work integrator + owner release gate
```

A dependency not available in merged main is a **source integration blocker**, not a reason to invent fake behavior; implement owned adapter code and tests against real exported contracts from nominated existing PR, record exact prerequisite branch SHA, and leave draft. Merge order is not "all U PRs in number order": stabilize C/R foundations and U01/U02 first; then adapters and experience layers; then device/provider/rollback acceptance.

## 4. Ready-to-copy instruction for EACH window

> Continue `Baatiku/masanawa` from the latest `main`. Owner **lifted the global development pause** on 2026-10-08; check the new top of `CONTINUE-HERE.md` and `docs/20-WINDOW-AI-CHAT-EXECUTION-20261008.md`. You are **UXX** [replace with exact lane name U01–U20, one only]. Read `docs/AI-FIRST-PRODUCT-AND-HUMAN-COMMUNICATION-20261008.md`, `docs/AI-OPERATOR-ACTION-AND-TASK-CONTRACT-V1-20261008.md`, `docs/HUMAN-CHAT-AND-CONTEXTUAL-AI-CONTRACT-20261008.md`, `docs/20-WINDOW-INTEGRATION-AND-ACCEPTANCE-20261008.md`, R01–R19/C01–C08 and affected canonical contracts. Inspect latest `main`, live PR heads/changed files, Work #497, existing R/C source and five-minute ownership leases BEFORE coding. Claim only the UXX isolated new module paths and unique `docs/workstreams/uXX-...md`; never overwrite shared Gateway composition, navigation, money ledgers, migrations registry, Firebase or another PR. Implement the whole owned scope end-to-end insofar as canonical dependencies exist: durable storage, API, authenticated security, Flutter/state, voice+type+tap where applicable, error/restart and tests. Do not use fake success, mocks as integration evidence, hardcoded identity or duplicate financial/DM runtime. Source left disconnected due to unmerged upstream PR must be labeled PARTIAL_IMPLEMENTATION and include exact proposed composition integration diff. If CI, DB, provider or device execution is blocked, finish implementable code, write tests, document exact unexecuted checks once; do NOT endlessly retry or claim verified. Commit and push substantive code, create **draft/unmerged PR** with SHA-specific handoff in `docs/workstreams/`, actual test output and precise remaining Work action. Do not merge or deploy. When the UXX scope is complete, do not seize another U/R/C lane unless owner assigns it.

**Window numbers should be given explicitly at launch.** Otherwise multiple agents may choose the same attractive U01 task. Each receives *one* UXX. Suggested bootstrap is to launch U01 first, then launch the remaining 19 as U01 publishes the v1 schema; launching all at once is allowed if they strictly use the published contract document and avoid shared-file composition.

## 5. Completion/hold rules

**For any UXX, three separate statuses must be reported:**
- `SOURCE`: PLANNED / PARTIAL_IMPLEMENTATION / IMPLEMENTED_UNVERIFIED / VERIFIED_E2E.
- `INTEGRATION`: isolated component only / composed in a reviewed branch / reconciled with main / deployed and verified.
- `EVIDENCE`: commands actually executed and result, plus exact missing DB/device/provider/cross-branch checks; CI #457 is not a test pass.

**Completion of all 20 source scopes is not automatically 80% product completeness.** The user's desired 80% is a useful effort target, but functionality share must be measured by **K01–K12 outcomes**, not lines of code/PR count; partial disconnected endpoints, fake payments/voice/media or independent unit tests without composed identity/security are NOT a passing milestone.

**Keep all implementation PRs draft/unmerged** until code/DB/API/mobile/security/client evidence is actually run against the exact integrated SHA. A later single Work reconciliation window inventories exact current heads, elects duplicate branches and merges only verified changes. Shared root paths and migration numbering must be integrated in the final controlled window or by a separately explicitly delegated owner who publishes a reviewed diff.

**User approval is still required** before spending money, changing production providers, billing or crypto enablement, altering real users/keys, irreversible production schema/app-store release, changing action approval policy or promising unapproved chats/calls/E2EE.

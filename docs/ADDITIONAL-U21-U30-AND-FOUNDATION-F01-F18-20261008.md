# Corrected 48-lane allocation: U01–U30 product improvements + F01–F18 foundation recovery

**OWNER-REQUESTED CORRECTION · 2026-10-08 · PLANNING/RECOVERY, NO SOURCE OR DEVICE VERIFICATION.** The initial twenty U lanes remain intact. Additional **ten** product gaps are assigned U21–U30. **Eighteen F lanes** explicitly recover and complete every outstanding R01–R19/C01–C08 core requirement and associated current draft PRs. A "lane" is a scope/accountability slot, **NOT** an order to run 48 simultaneous writers. Use only explicitly available exact-path leases; high-risk shared integration is serialized. The 79 unchecked historical tasks are separately mapped to these lanes or future-gated in `LEGACY-150-TASK-RECONCILIATION-20261008.md`.

**Source order:** `CONTINUE-HERE.md`, `UNFINISHED-SCOPE-RECONCILIATION-20261008.md`, `CONTACTS-AND-ADDRESS-BOOK-EXPERIENCE-20261008.md`, this document, existing `20-WINDOW-AI-CHAT-EXECUTION-20261008.md`, `AI-OPERATOR-ACTION-AND-TASK-CONTRACT-V1-20261008.md`, `HUMAN-CHAT-AND-CONTEXTUAL-AI-CONTRACT-20261008.md`, `IMPLEMENTATION-KICKOFF-20261008.md` and relevant R/C/foundation contracts. Each new window must re-inspect current `main`, 60-at-audit open PRs, scope leases and exact files before claiming.

## 0. Launch/ownership safety policy

- **Already launched U01–U20 windows keep their unique scopes**. Do not rename or reset them. They now read updated contacts and R/C recovery crosswalk. U21–U30 are **new optional development windows**, best launched next as capacity allows.
- **F01–F18 are not parallel rewrites:** each is a **recovery and final integration** of already required R/C work. Adopt the latest actual PR branch, preserve existing commits and tests, inspect claim age, then fill genuine owned gaps. If another implementation currently owns the same paths, work on nonoverlapping tests/handoff until ownership transfers. A recovery PR stays draft if any necessary device/CI/DB/provider evidence is unavailable.
- **Exclusive single-point integration:** one shared Gateway app.ts/main.ts composer and auth owner; one migration registry/sequencer; one R17/C08 Flutter root router; one R05–R08/C06 ledger/custody/quote owner; one R14/Firebase native owner; one GitHub Actions owner. The designated final Work integrator may own these sequentially on resumed Work; F lanes may not concurrently edit them without explicit written coordination.
- **New product roots only:** U21 `apps/mobile/lib/src/contact_hub/**`; U22 `apps/mobile/lib/src/device_contacts/**`; U23 `apps/mobile/lib/src/contact_invites/**`; U24 `apps/mobile/lib/src/message_requests/**`; U25 `packages/operator-scheduling/**` and `services/gateway/src/operator_scheduling/**`; U26 `apps/mobile/lib/src/channel_linking/**`; U27 `apps/admin_mobile/lib/src/operator_admin/**` plus isolated admin service; U28 `services/gateway/src/agent_research/**`; U29 `services/gateway/src/customer_resolution/**` and isolated UI; U30 `services/gateway/src/unified_discovery/**` plus isolated Flutter discovery components. These are **suggested** until live claim, and new files must not overwrite current C/R named code.
- Every implementation requires authentic backend auth, canonical DB/storage or existing relevant data interface, Flutter flow, typed errors/reconciliation/permissions, realistic unit+integration security tests, login/account switch and restart/offline; missing composition must be **PARTIAL_IMPLEMENTATION**, not DONE. No mocks, skipped real writes or invented outputs in production paths. Tests may mock providers for isolated failure cases but do not constitute end-to-end evidence.
- App UI remains exactly **Talks · Chats · Assistant · Wallet · Agents**. Contacts is a nested Chats screen, not a sixth root. F01 theme color conflict requires owner final decision; no unauthorized brand redesign. E2EE/groups/video/person calling, full phonebook server matching, local device takeover, unlimited crypto countries and advertising are not auto-approved by these scopes.

## 1. Ten NEW user-facing workstreams

### U21 — Human Contacts Hub / New Message entry (P0)

**Why:** C01 #468 has a contact-management screen but not the complete accepted-people directory and real one-tap Chats composition. **Owner of Contacts *presentation only***; F14 owns C01 identity/consent and F12 owns root router.

**Deliver:** a compact full-screen contacts list nested under Chats→New message. Accepted Masanawa contacts shown with actual avatar/name/@handle, Favorites, search filter, alphabetical index where accessible, contact requests (incoming/outgoing), Add by exact @handle, real action-state banners, chat eligibility and profile preview; empty/offline/sync/busy/revoked states; compose real DM through **C02's actual conversation-open API**, no AI Character substitution. Real safe `people` DTO adapter to draft C01 `HumanContactsController`; avoid copying C01's entire screen/transport or creating a competing contact table. Split recent chats from contacts, preserve scroll/draft on back and typed privacy-safe person identity. Show phonebook opt-in entry only if U22 device code is actually available.

**Acceptance:** A/B real users accept contact, A sees B in list even before first message, taps B opens exactly one authorized C02 thread and can send text; B avatar and handle update on restart; revoke/block makes Message unavailable; hidden account and wrong tenant not visible. 10,000 accepted contact fixture has bounded memory/pagination and fast indexed search; denied OS Contacts permission leaves exact @handle directory fully usable. App route/deeplink and Back history tests must be handed to F12 R17/C08, no direct router edit. **Handoff:** `docs/workstreams/u21-contacts-hub-20261008.md`.

### U22 — Optional on-device address book and permission safety (P0/P1)

**Why:** Users expect the phone's contacts to be visible, but blanket upload is unsafe and a new native plugin is a signed-binary change, not Shorebird-eligible.

**Deliver:** explicit "Find phone contacts" opt-in, clear rationale/OS permission handling Android/iOS, local-only list of names and phones with bounded cache, de-duplication, country-aware normalization without false E.164, multi-number selection, accurate "Invite" for unmatched entries, updates/revocation/account switch purge, no external transmission of address book without separately reviewed consented matching protocol. Use OS Contacts APIs through vetted Flutter plugin **only with reviewed native/dependency changes owned by native release integrator**; keep module independently testable and adapter-bound until credentials/build permissions available. Device screenshots/logging must never leak numbers.

**Acceptance:** declined/granted/revoked/limited permission, 10k entries & Unicode/multiple numbers, low-RAM scroll, local-only privacy audit, iOS plist/Android manifest/store declaration, user-visible Invite. **Do not** implement raw-number bulk lookup, upload unsalted hashes, auto-sync or claim a user on Masanawa from unverified number alone; *privacy-preserving server matching is separately SECURITY-GATED.* **Handoff:** `docs/workstreams/u22-device-contacts-opt-in-20261008.md`.

### U23 — Invitations, referrals, share and acquisition without phonebook surveillance (P1)

**Deliver:** safe system share of real public HTTPS links for public Talk, approved human profile, Expert/Twin page and new-user invitation; installed app deep link and web/store fallback with controlled identity/OTP, share-target user choice, spam limits and optional expiry. User can invite a device-only contact without generating a fake thread. **No referral earnings promised unless financial owner adds actual credited eligible program**; use ordinary share first. Consent prohibits automatic in-app message or contact acceptance on click.

**Acceptance:** A shares to unregistered B, B sees safe landing, signs in normally, may request A via C01, correct return route; invalid/tampered/expired link fails safely; no exposing private DMs/numbers or accidental creator referral payment. Android share sheet + web fallback unit/device tests. **Handoff:** `docs/workstreams/u23-invite-share-acquisition-20261008.md`.

### U24 — Message requests, blocked contacts and human privacy controls UX (P0)

**Deliver:** actual request inbox counts, Accept/Decline/Report/Block/Cancel for C01 request revisions, muted and blocked user management with R15 identity rules, contact/DM thread access affordances, discoverability policies and clear safety explanations; no send until current server permission. Friendly UI in Chats/Contacts with no duplicate local policy engine. Reuse `HumanContactsScreen` request actions and F14 C01 storage; product UI can be mounted by F12 only.

**Acceptance:** race between A cancel and B accept, simultaneous block/report/revoke, expiration/reauth, new device readback, exact invalid state, no delivery/search/media/notification leak to blocked contact; blocked sender cannot circumvent via direct deep link, stale cache or AI tools. No automatic import or public abusive contact enumeration. **Handoff:** `docs/workstreams/u24-message-requests-privacy-20261008.md`.

### U25 — Opt-in proactive operator tasks / real scheduled worker (P1, gated)

**Deliver:** server-authorized durable schedule/occurrence model and worker with per-user timezone, idempotent tick/lease/heartbeat, cron or relative schedules, quiet hours, frequency/spend guard, cancel/pause/readback, alert/failed delivery and account deletion cleanup. Flutter Assistant "Reminders" only when real scheduler is composed; allowed first tasks: remind user of their own Talk, follow up on a pending task without irreversible action, notify approved lesson continuation or available artifact. **No model-initiated message to third party or purchase/crypto payment.** Reuse U02 task identity and R14 notifications.

**Acceptance:** timezone/DST, skipped/double tick, worker crash and two nodes, paused/expired task, denied notification, source account deletion, user cancellation with future trigger revoked, no duplicate push or money write. If Worker composition and durable DB tests unavailable, leave UI hidden and status PARTIAL_IMPLEMENTATION. **Handoff:** `docs/workstreams/u25-proactive-task-scheduler-20261008.md`.

### U26 — WhatsApp/Telegram linked-assistant channel UX and continuity (P1)

**Deliver:** customer-scoped linking/unlinking/recovery/status in settings, verified phone/Telegram identity proof via existing provider adapters, optional channel preference, bounded privacy disclosure, help text, current Gwani/Gwana safe task continuity as allowed by session authority and understandable failure. Do NOT conflate messages arriving on WhatsApp/Telegram with app human DMs; users never paste developer tokens. Reuse R15/F08 webhook signature/ingress guard and C07/U01 tasks. Provider secrets remain server-side, no undocumented consumer WhatsApp personal-account automation.

**Acceptance:** account A cannot claim B's channel, forged webhook header, replay, disabled provider, wrong phone, Telegram contact spoof, successful unlink revokes future access, financial actions require identical task approval and quote in appropriate private channel; no hidden cross-user memory/DM access. **Handoff:** `docs/workstreams/u26-linked-channels-20261008.md`.

### U27 — Admin controls for actual agent platform operations (P1, privileged)

**Deliver:** separated administrator-only Flutter admin surfaces and typed privileged Gateway contracts to view actual agent capability/version/tool assignment, Gwani/Gwana support defaults, enable/disable signed capabilities, publish/rollback agent profile revisions, quotas/cost and creator funding visibility, audit/readback and diagnostic status. `apps/admin_mobile` already exists; **do not copy it into consumer five-tab shell**. Read real canonical agents/skills/tools/admin auth and existing ops contracts. Disable capabilities securely server-side without erasing wallets/ledger operations.

**Acceptance:** anonymous/consumer role denied, admin changes reflect server authoritative catalog and client negotiation, version changes cannot silently grant sensitive tool access, audit trail and undo where policy allows, device/role switch, no secrets in UI, no hardcoded Gwani IDs. Work integration of shared admin Gateway routing requires owner. **Handoff:** `docs/workstreams/u27-agent-admin-control-20261008.md`.

### U28 — Source-backed research, search and trustworthy explanations (P1)

**Deliver:** a bounded governed research action for agents with approved retrieval provider(s), explicit citation/source title/time, extraction/data sanitization, allowed URL/domain policy, rate/cost budgets, current-vs-general knowledge classification, multiple independent sources where important, user-visible results/summary cards and durable task continuation for multi-step work; store actual generated notes as U07 artifact only when physically produced. Do not claim web search without configured provider and fetched content. Guard prompt injection in retrieved pages, files and uploaded snippets as untrusted evidence.

**Acceptance:** source unavailable/404/contradiction, stale current facts, injected tool instructions, unsupported region, no-credit budget, dedupe/cache/expiry, signed task cancellation and real reference ID provenance; no unverified AI facts presented as researched. **Handoff:** `docs/workstreams/u28-evidence-research-20261008.md`.

### U29 — Customer support, payment uncertainty and safe escalation (P1)

**Deliver:** in-Assistant and Wallet/Chats contextual "Need help" action with real masked operation/transaction/error reference, read-only status and known resolution options, optional user-approved ticket/escalation to actual support inbox/workflow (do not silently leak private messages), push/result statuses, timeout/retry, reporting abusive content through R15. Clear "pending/not confirmed" path for provider-unknown transfers without duplicate charges. No auto-refund or false live-agent claims absent actual signed support service.

**Acceptance:** unauthorized operation lookup, masked sensitive info, duplication/nonce, refund/chargeback unknown, support workflow unavailable, account signout, customer evidence attachments permission, user consent before human sharing; real server receipt/request id. **Handoff:** `docs/workstreams/u29-real-customer-support-20261008.md`.

### U30 — Unified *public* discovery and safe cross-product search (P1)

**Deliver:** account-scoped/visibility-filtered **public** discovery for Talks, People, Masanawa Experts and published Twins, with explicit sections and entity distinctions; keyword/topic/language/live-now filters from actual current source, server pagination/ranking, current admission/pricing labels and ability to invite/contact/Ask Assistant by typed result. No private message search here (U11 owns DM search) and no unauthorized identity enumeration. Search result can lead to real public Talk or human profile/consent request, not automatic paid Seat.

**Acceptance:** hidden/blocked/deleted person, unapproved Expert/Twin, expired Talk, no live room, search abuse/rate caps, bad query, lazy slow-network scrolling and low-end Flutter UI, correct Guest vs AI labels, real API authoritative results and safe route. **Handoff:** `docs/workstreams/u30-unified-public-discovery-20261008.md`.

## 2. Eighteen EXISTING FOUNDATION recovery and integration scopes — R/C is not optional

These tracks attach to existing R/C owners and PRs; **do not spawn a new implementation of a preexisting module**. A foundation window should reopen the canonical PR (or a clearly identified reviewed continuation branch), run missing tests where available and fill exact code gaps while preserving original migration/DTO/contract. Some require central Work integration and must then be documented blockers, not source success.

| F | Canonical existing scope | Open PR source to preserve | Exclusive integration caution |
| --- | --- | --- | --- |
| **F01** | R01: theme/visuals/readability and unresolved green vs blue decision | #442 | Semantic theme tokens; do not reset palette without owner sign-off |
| **F02** | R02: native live audio, LiveKit/permission/race/Host token | #439/#448/#449/#456 | R09 stage voice, U09 Gemini private track, one LiveKit runtime |
| **F03** | R03+R19: approved 17 personas, support recovery and safe role responses | #441/#495/#499/#498, #448 | Catalog/identity version, no hardcoded new personas |
| **F04** | R04/R09/R10: Talk Host create/admit, AI stage events, gifts/settlement | #433/#452/#459/#471/#484, Work #497 | R06 ledger, no UI fake gift, U14/15/18 adapter seams |
| **F05** | R05/R06/R07: Wallet + Flutterwave funding/receipt/reconciliation | #440/#438/#447/#501 | Finance authority exclusively; do not duplicate ledger |
| **F06** | R08+C06: crypto custody, NOWPayments and internal transfer | #444/#454/#487 vs #490 | Provider payout/KYC/AML and one C06 double-entry schema |
| **F07** | R11: localizations, language/RTL/voice parity | #426/#482/#501 | Central locale files single owner, U19 tests |
| **F08** | R12/R15: account privacy/safety/channel webhook policy | #430/#443/#446/#450/#451/#488/#489 vs #491/#494/#496 | One block/report identity graph, R12 deletion/retention, U24/U26/U29 |
| **F09** | R13: authorized storage/recording/replay | #453/#503 | S3/LK egress, consent, U16 only processes qualified replay |
| **F10** | R14: Firebase/FCM/APNs device tokens and Activities | #436/#502/#461 and Work #497 | Native Firebase local values, no edits by U13 |
| **F11** | R16 + CI #457 + Postgres portability/readiness/backup/release | #455/#479/#485/#492/#500/#460 and Work #497 | No credentials/store release/production DB changes without authorization |
| **F12** | R17+C08: one five-tab Flutter shell, routes, nested Contacts | #445/#493 and Work #497 | **Only F12 may integrate global router and bottom tabs** after claim |
| **F13** | R18: account profile/avatar/handle/bio and person profile | #435 | Shared Gateway app/main with C01 #468; R18 avatar migration ordering |
| **F14** | C01: canonical contact admission/preferences/relationship & auth | #468 | Own C01 schema and API; U21/U24 must consume, not clone |
| **F15** | C02: canonical human one-to-one DM DB/API/Flutter | #472 vs #475 | **One 0017 migration**; C01 member policy; no second chat backend |
| **F16** | C03+C05: authorized realtime/outbox/cache/historical sync | #473/#483/#486 and #474 vs #476 | One journal/cursor and one encrypted account-specific local store |
| **F17** | C04: real private voice-note and attachment security | #478 | Same C02 membership; R02 mic and S3 private object authority |
| **F18** | C07: one Gwani/Gwana private Assistant + U operator integration | #480 and U01–U09, Work #497 | No second central Assistant, no bypassing R05–R08 money API |

### F01 — Visual consistency and brand resolution
Finish ALL root/feed/dialog/wallet/chat/Talk/loading/disabled contrast, tap targets and 320dp Android; test high font/RTL and system bars. R01 current docs say white/green, owner later mentioned blue; **raise explicit owner decision before irreversible rebrand**, preserve existing theme by default. Must not stall non-theme functionality. Handoff includes screenshot/device evidence, no claims from static color tokens alone.

### F02 — Real-time audio acceptance
Recover R02 existing source with authenticated LiveKit Host token/mic, human guest join/unmute, AI Seat participant, seat/permission/race and reconnect fencing; shared audio focus with private Gemini and DM recorder. Require two real phones (one budget), speaker/earpiece/Bluetooth, killed/background/permission denial, real charged/uncharged seat distinction. Native audio work needs device verification; don't mark DONE from tests using fake LiveKit events.

### F03 — Persona directory and trust
Idempotent bootstrap complete 17 approved current personas with profile/tone/pronunciation/voice, partial-seed repair and admin-edited protection; dynamic Agent/Twin availability and Gwani/Gwana default preference persisted through auth. R19 AI disclosure, safety and realistic role performance with human QA/admitted Talk voice. Validate persona switching never transfers approvals or falsely impersonates a human.

### F04 — Talks social economy
Create Talk by voice/text/taps, invite free human, eligible AI/Twin Seat quote, Host controls; bounded authorized events, gift provider/credit ledger settlement with idempotency, stage animation, creator pending earnings and reduced-motion. Recover existing R09/R10 draft code, avoid duplicate event publishers; test actual ledger readback and Talk stage A/B communication after disconnect.

### F05 — Fiat Wallet and Flutterwave
Implement/reconcile wallet projection and currency/account separation; actual NGN account funding quote and cash register, one quote-scoped funding intent, webhooks/idempotency, background reconciliation and receipts, four real qualified Flutterwave families (airtime/data/electricity/TV) individually, request validation/fees/refunds. Domain authorizer and money ledger never owned by Gemini model or Flutter. Voice/tap parity, unknown status, deposit failure, lost webhook, restart/duplicate confirmations, real provider sandbox + controlled verified merchant state.

### F06 — Crypto and internal transfer
Reconcile C06 #487 vs #490 ledger migration (one only), NOWPayments custody/available amount, payout 2FA/fee/network whitelist and fixed-IP relay, hosted fiat-buy region qualification, authenticated verified user B, quote expiry/risk limits/reauth, atomic balanced book transfer once, actual sender/receiver readback. Separate internal book move from irreversible external withdrawal and keep unsupported routes disabled. No real customer funds/payouts without owner authorization.

### F07 — Localization and accessible service terms
All five Flutter roots, Agent/Chat/Talk/Wallet prompts, server errors, Billing/Crypto exact receipt/fees, Hausa/English/RTL/currency/time/phone formats, screenreader/tap fallback. Dynamic voice language separate from UI locale. Old four-tab localization PR #426 must **adapt to five-tab** rather than resurrect old nav. Uncertain numbers must be reconfirmed.

### F08 — Real privacy, blocks, reporting and deletion
One coherent block/report/mute/identity enforcement across C01 contact, C02 human DM and media, Talk discovery/seat/gift/replay, Expert/Twin/creator, WhatsApp/Telegram hooks. Durable report categories, actor/reference masked evidence and moderator follow-up. R12 fully authenticated account deletion/revoke push/channels/media/keys/retention (financial audit exempt as legally required) and external route. Resolve duplicate persona reporting #489/#491 carefully; no dead report/forgotten request.

### F09 — Legitimate replays
Only Host/permitted participant can record/advertise; S3 object existence, egress success, actual ready-first replay, playback signing expiry and revocation, retention/deletion, offline/slow playback, privacy/consent; U16 must fail if replay absent. Test actual storage/provider environment and real Android media route.

### F10 — Correct FCM and Activity
Recover Work #497/Firebase #461 unmerged native config with secret-free build values handoff; connect Gateway device token registration/unregistration/account auth, backend FCM, foreground/background/terminated behavior, typed deep links to correct human DM/Talk/receipt only after current user auth, no sensitive preview. Duplicate/multi-device/revoked token safety; Android real handset and iOS APNs qualified independently. U13 cannot modify Android native files.

### F11 — Release/infra/CI/backup and security verification
Stabilize Gateway typecheck/lifecycle test, Flutter analyzer/test failures, actual required CI runner/Actions quota, real isolated Postgres schema migrations in deterministic order, production-safe status/apply CLI, encrypted verified off-account backup+restore, PG18/pgvector roles, readiness /readyz vs /healthz, deploy SHA/DNS, mobile production signing/APK/AAB, Android/iOS store rules, crash observability, schema/ledger recovery, Shorebird signed staging/rollback after stable base. Never issue production migration, cutover, credential changes or payments without owner approval and actual environment. This is a coordinated release/infra integration lane; can be split only into explicit nonoverlapping read-only subclaims by final Work.

### F12 — One Flutter navigation/composition owner
Exactly Talks, Chats, Assistant, Wallet, Agents; Chats human-only plus U21 Contacts/New Message, Assistant one attributed Gwani/Gwana, Talks Explore/Live FAB, Wallet real balance/cards and Agents Expert/Twin. Restore aliases/back/drafts/account switch/deep links/small screen; semantic merge of #493 vs #497 without losing later owner override, Firebase or drawer. Compose C01/C02/C03/C04/C05 and U03/U08/U10/U21 only after their actual APIs exist; no placeholder UI pretending server has deployed.

### F13 — Actual person/profile account updates
R18 avatar upload/crop/remove, WebP/S3 authorized content and cache invalidation, name/handle/bio conflict validation, unique handle/privacy, accurate per-person display in Contacts/Talk/Chat/Profile, race-safe update and device restart. Semantically reconcile R18 #435 shared Gateway files with C01 #468; deleting avatar revokes old signed link and cache. An AI cannot silently edit profile without authorized review.

### F14 — Contact admission owner
Preserve C01 #468's exact-handle lookup, accepted/incoming/outgoing model, privacy policies, block/revoke and migration. Define stable relationship pagination, presentation DTO contract needed by U21, request-revision conflicts, consent/rate/anti-enumeration; coordinate requested API extension rather than U21 implementing duplicate. Actual two-account SQL/Flutter tests and C02 send-time admission. **F14 does not itself grant device phonebook access**, which U22 owns.

### F15 — Human DM truth owner
Elect #472 vs #475; choose one migration 0017, typed authenticated person conversation/membership/message IDs, idempotent send/read/edit/delete/tombstone, durable pagination and privacy plus actual Flutter conversation. AI-character storage never used. Compose C01 permission and R15 restriction once; verify A/B/C real SQL, concurrent sends and cross-device history; no fake message delivery/read.

### F16 — Human realtime and protected offline cache
Elect coherent C03 journal/pruning version and C05 local encrypted indexed store/queue once. Authenticate event subscription, lost cursor resnapshot, private unread read/reconcile, push hooks, versioned ordered history, local optimistic outbox and bounded media caches. Real low-end device metrics after compose; no full-history startup download. U10/U11/U13 must consume existing transport contracts, not create second sync engine.

### F17 — Secure person voice/attachments
Recover #478, compose with C02 membership and C03 events, private S3 upload/read per recipient, strict streaming/type/size/duration/CRC, server revoke after block/delete, orphan cleanup, mobile record/preview/retry/playback with text fallback. Cross public Talk/Gemini audio focus tests and long-signed-URL isolation. U12 improves appearance but must not replace security backend.

### F18 — Assistant owner and universal operator integration
Recover C07 #480 single Assistant workspace, Gateway agents preferences and durable message state, attach U01 single typed registry, U02 task journal, U03 cards, U04 adapters, U05/06/07, U08 opt-in DM, U09 native live audio, with actual C02/C01/R04/R05/R08 domain authorization. Preserve Gwani/Gwana in-chat switch, source-attributed messages, same task ID; financial and human messages need exact human review/receipt. **Do not create a second ungoverned gateway agent service** or claim cross-product operation until actual composed API readback.

## 3. Sequencing and where extra windows can safely begin

| Wave | What may start | Gate before shared integration |
| --- | --- | --- |
| **A — immediate** | Keep already launched U01–U20 independent coding. Launch U21 Contacts Hub using C01 PR #468 read-only contract; U22 device adapter/permissions design, U23 invitations, U24 privacy UI, U28 research, U29 support, U30 public discovery. F tracks may work on *non-overlapping tests/handoff/recovery* only. | U01 contract pinned; C01/C02 source inspected; no overlapping PR changes |
| **B — dependency-aware** | U25 schedules after U02 task schema, U26 after actual R15 channel adapter, U27 after existing admin authorization/capability registry. F14/F15/F16/F17 and F03–F09 recover existing PR branches with new five-minute claim, not new competing schemas. | Single trusted C01/C02/C03/C04/C05 model, valid API authorization; financial owners |
| **C — controlled composition** | F12 sole Flutter router, F18 sole Agent integration, F10 sole Firebase native, F11 central CI/DB/infra, F04/F05/F06 financial/Talks authors. | One Gateway composer, migration sequencer, lane agreement and release branch |
| **D — real verification** | All J01–J11 and **K01–K20** on integrated SHA, device/provider/DB/voice/FCM/privacy, rollback and safe release. | Signed builds, real provider/LiveKit/Firebase and explicit owner go/no-go |

**No "launch all 48 now" instruction.** If only twenty windows can run, prioritize U01–U04, U08–U13, U21, F14/F15/F16 where **existing branch ownership is available**, F12/F18 once dependencies stabilize, and R02/R05/R06 secure core recovery. Existing planned U01–U20 can continue without being interrupted, then choose next slots by dependency.

## 4. Mandatory handoff for additional windows

Each U21–U30/F01–F18 window uses `docs/workstreams/uNN-<slug>-20261008.md` or `docs/workstreams/fNN-<slug>-20261008.md`, publishes actual five-minute claim and exact source paths after checking live PRs, base/head SHA, relevant R/C/legacy crosswalk, conflicting drafts, owned code layers, typed contract version, actual tests vs deferred commands, and integration steps. Use a **new draft PR only where source isn't already owned by existing PR**; otherwise continue that exact PR/branch (including test commits and updated handoff) instead of making a second overlapping implementation. If exact shared code is controlled by another lane, implement isolated changes/tests and hand off a semantic composition diff. Never mark `VERIFIED_E2E` on isolated synthetic fixtures, nor merge unsafe source.

**V1 secure default for contacts:** actual in-app Masanawa directory is essential; **device phonebook is optional but fully supported where user consents**; server addressbook matching remains future SECURITY-GATED. The user can always type exact @handle and message accepted humans without exposing their phonebook.

## 5. Explicitly deferred, not lost or covertly shipped

Full E2EE, groups/direct person calls/video, full phonebook cloud matching, personal WhatsApp account scraping, SIM/SIP/USSD/call automation, background camera perception, full Studio video/lipsync, general plugin marketplace, arbitrary third-party app/device automation, universal fiat remittance and unapproved advertising/subscriptions **remain separate future approvals**. The 79-row master task audit assigns them archival owners/gates but they do not block the core first mobile release unless they are explicitly part of current R/C acceptance.

**End state:** completed source in all allowed scopes, a *single* coherent authorized backend/mobile runtime, one audited human DM/Contacts system, one Agent task engine, one financial ledger, verified Talk audio and privacy, real Android test and signed Shorebird-ready release baseline. Remaining deferred tasks are visible in the legacy crosswalk, not mistakenly counted as completed.

# U01–U20 integration, execution evidence, threat tests and Work handoff

## ADDITIONAL TESTS K13–K20 — real human Contacts and pending foundations (2026-10-08)

K01–K12 do not cover the complete Contacts lifecycle. [Full Contacts contract](CONTACTS-AND-ADDRESS-BOOK-EXPERIENCE-20261008.md) adds K13 (Chats→Contacts and two-user real chat), K14 (voluntary local-only phonebook/permission/revoke), K15 (cross-device accepted people), K16 (request/block/anti-enumeration), K17 (invitation and safe signup), K18 (large/Unicode/budget-handset directory), K19 (contact identity vs Agent/DM/Wallet), K20 (deletion/revocation/no wrong-account cache). [Re-audit](UNFINISHED-SCOPE-RECONCILIATION-20261008.md) and [F01–F18](ADDITIONAL-U21-U30-AND-FOUNDATION-F01-F18-20261008.md) make every R01–R19/C01–C08 prerequisite explicit, including all remaining provider/DB/device/CI checks. Do not mark K13–K20 passed from UI-only fixtures, and do not infer E2EE or server-uploaded phone matching.


**2026-10-08 · Mandatory release evidence overlay; tests NOT executed by this document.** This supplement exists so twenty simultaneous windows produce **reconcilable code**, not twenty independent demos. Source truth remains R01–R19, C01–C08 and the canonical platform data/security/product contracts. Independent development is reopened by owner instruction; production deploy and unsafe PR merge gates are **not** waived.

## 1. Immutable baseline and existing debts (do not hide)

Baseline `main` on this plan: `3613b590e9df54178397bce97bdd2874766817b3`. Current Work integration draft PR #497 `071447f5b886629df1e02d008a310ff6c8f80da2` reports recovered backend 1209 pass, 1 fail, 143 skipped, baseline ~74 Gateway typing errors; recovered Flutter 443 pass, 11 fail, analyzer exit nonzero; full DB/device/provider/real app release **not qualified**, Actions #457 quota exhausted. Those tests are **branch- and environment-specific reports** from Work, not proof that live main has same fixes. Source recovery did preserve Firebase #461 and `docs/FIREBASE-LOCAL-COMPILATION-HANDOFF.md` on Work branch, not present on current main.

**Known competing/stacked PRs requiring a single elected source:** C01 #468 + R18 #435 shared Gateway; C02 #472 vs #475 (one schema 0017, do not apply both); C03 #473/#483/#486 continuation; C04 #478; C05 #474/#476; C06 #487 vs #490; C07 #480; C08/R17 #493; Firebase #461. Reinspect live heads and closed PRs, since this snapshot ages; preserve useful source/test diffs and avoid cherry-pick duplicates. Original #497 has existing claims on shared `CONTINUE-HERE.md`, Firebase, common router and gateway; the new owner-resumption notice supersedes **only the blanket stop**, not its code ownership or its evidence.

## 2. Evidence vocabulary — use exactly, not "done"

| Field | Allowed values | Meaning |
| --- | --- | --- |
| Source completeness | PLANNED / PARTIAL_IMPLEMENTATION / IMPLEMENTED_UNVERIFIED / VERIFIED_E2E | Whether actual owned implementation exists and applicable tests have executed |
| Verification | NOT_RUN / FAILED / FOCUSED_PASS / FULL_RELEVANT_PASS / DEVICE_PROVIDER_PASS | Immutable command + source SHA, duration, environment and complete count/failure needed |
| Integration | ISOLATED / CONTRACT_ALIGNED / COMPOSED_UNVERIFIED / COMPOSED_VERIFIED / DEPLOYED_VERIFIED | Source integration level independent of tests |
| Release | BLOCKED / INTERNAL_QA / STAGED / APPROVED / RELEASED_VERIFIED | App-store/prod gates separate from PR status |
| Money | DISABLED_UNQUALIFIED / SANDBOX_QUALIFIED / MARKET_AND_CUSTODY_QUALIFIED | Never infer from pricing catalog or app surface |
| Voice | SOURCE_ONLY / DEVICE_AUDIO_QUALIFIED | Real input/output and routing on handset, not voice mocks |

**No test result without:** run command, exact git commit SHA and base, OS/SDK/Node/Flutter/compiler, data setup/secret provenance names (not values), pass/fail/skip counts, return code and linked logs. Distinguish scoped widget/unit vs Postgres integration vs complete Android/iOS, provider sandbox vs live funds. Tests authored but not run are **NOT_RUN**; a deployment health endpoint only is not feature proof.

## 3. Required tests at each boundary

### Domain/API and data

- **Persistence:** schema/migration forward, old data compatibility, rerun idempotency, backup/restore, one authoritative owner path; use disposable PostgreSQL with real constraints and query plans/indexes for 100k messages where applicable. Model-based interfaces cannot replace DB concurrency proof. Do not apply migrations on production for this plan.
- **Authorization:** no client-supplied canonical user/tenant/Host/DM member/recipient; session token rotation, logout and two-account switch; IDOR attempt to guess other account's task/message/file/ledger; deny blocked/deleted/revoked access at API, socket, media and search after readback.
- **Idempotency:** duplicate action ID, lost response after DB commit, worker restart, concurrent devices, webhook replay, quote expiry, different payload same key, stale persona/device approval all fail safely. Financial unknown remains **pending reconciliation** and cannot be retried under a new key.
- **Tool safety:** model output, human DM, downloaded file and remote web snippets are untrusted. Prompt injection cannot switch actor, call unauthorized tools, reveal credentials, read others' messages or generate fake receipt. Capability schema rejects unknown fields and incorrect stage/role/region.
- **Interface compatibility:** U01 v1 fixtures compiled by consumer adapter U02/U03/U04/U08/U09; Flutter rejects future/new server action gracefully; Gateway supports eligible older signed/OTA client and refuses unsafe downgrade. No new nonversioned API added without explicit lifecycle registry/compatibility plan.

### Human chat and media

- Two true authenticated accounts (not AI character surrogate) send/receive/respond, background/kill, reconnect, new device authorized history, correct read/ACK semantics; unauthorized third party B/C cannot retrieve any message/media/search result.
- Cached list and thread remain available offline; outbox resumes once; stale server cursor and tombstone are authoritative; account-specific cache cleans on logout/account change and block; notification doesn't show text by default on lock screen.
- Permission and attachment bounds/CRC/type/signed URL expiry are enforced server-side even when client metadata lies; media never rerouted to public Talk. Long-message emoji/Unicode/RTL and keyboard small-screen overflow test.
- Contextual agent receives only deliberately selected message(s), explicit disclosure, user review before sending text; no passive prompt on unread human DMs; blocked sender and stale signed content are denied.

### Audio and Talk

- Distinct private Gemini Live, public LiveKit Host/Seat and private DM recording: deliberate mic grant, audio focus, cancel/interruption, role-to-track privacy, reconnect, new room, app background, Bluetooth/speaker/earpiece, Hausa/English mixed language, barge-in and denied mic → text/tap.
- Host creation/invite/approval, real Expert paid quote, host absence, no AI Seat charged merely for selection, no AI-to-AI self-farming; approve/turn/mute/leave/replay and audience permissions tested on two actual phones when available.
- Replay summary only when correct recording consent/retention and object exist; no fabricated highlights/earnings; exact sharing authorization and deletion effects.

### Wallet/creator

- Read-only balances honest with currency+network, available vs pending and market/provider qualification. No operator model or DM Send arrow can debit account.
- Quote identity/terms expiry, fresh user approval and required reauth, atomic idempotent financial debit/credit and real receipt; refunds/provider unknown, duplicate webhook, crash after provider before DB, stale approval, payout gating and actual costs. Sandbox and live evidence separate. Existing R05–R08/C06 source owner remains financial authority.
- Twin owner-only training/publish/Direct Twin/billing attribution; quota/funding, commission pending vs available, no paid results without actual settlement. Creator analytics cannot expose another user's private transcript.

### Accessibility, performance, release

- Text/tap parity for each voice intent; screen reader semantics, large text, correct tap target, RTL/emoji, intentional first-use mic prompt, no developer token. Real Hausa pronunciation/code-switch check on intended device; numbers and irreversible terms carefully reviewed.
- Benchmark cold startup/usable frame, cached human inbox/thread p50/p95, RAM/disk/bytes on named budget Android; compare baseline to candidate with same data/network/device. Target warm list <1 s p95, cached thread <500 ms p95 where achievable and document deviations rather than fake.
- Flutter build/analyze/test on actual integrated source; Android signed APK/AAB identity, Firebase/Gemini/LiveKit, OTA Shorebird compatible baseline and signed QA patch when later authorized. iOS needs signed physical iPhone/APNs/TestFlight and store review; Shorebird can't patch new native/asset/engine or magically update a non-Shorebird APK.
- CI #457 quota failure doesn't mean all tests pass; do **not** change billing, GitHub Actions workflow permissions or skip tests to paper over blocker. Use other permitted local executor with transparent evidence.

## 4. Cross-feature K journeys — tie to concrete lanes

| Journey | Producer lane(s) | Fully connected proof / handoff required |
| --- | --- | --- |
| K01 Host Talk + invite exact person | U01–U04, U14; C01/R04/R17 | Host authorization, real Expert selection/quote, exact contact consent, Talk and invite refs, cancel/restart |
| K02 Persona switch + one task/approval | U01–U03, U09; C07/C08 | Gwani↔Gwana attributed conversation, same task, stale confirmation rejected, no duplicate action |
| K03 True product capability/eligibility | U01/U04; R05–R08 | Unsupported market/disabled rail honest; no hallucinated product; exact live catalog/readback |
| K04 Explicit DM→Assistant→DM | U08/U10; C01–C05 | Selected IDs/consent only, no other message exposure, draft only until review and send |
| K05 Offline human text + voice once | U10/U12; C02–C05 | A/B physical devices, offline outbox, server membership, one ACK, protected media |
| K06 Chat search, mute, block, notification | U11/U13; C01/R14 | revoked search/media, accurate unread, correct account/deep link and lock screen privacy |
| K07 Voice multilingual and no forced speaking | U03/U09/U19; R02/R11 | native Gemini and private/public track segregation, Hausa/English digit correction, silent tap parity |
| K08 Consent memory and resume study | U02/U05/U06 | opt-in remember/correct/delete, fresh device task/learning checkpoint readback |
| K09 Real output with secure share | U07/U06; storage/security | file exists, permissioned download+checksum, revoke, no fake file claims |
| K10 Host + live agent + replay | U14–U16; R02/R09/R13 | two-device public audio, seat limits/pricing, consented replay availability and no fabricated money |
| K11 Twin owner interview and quality | U17/U18; R03/R06/R10/R19 | owner only, preview/test, gated publish, accurate commission/cost/balance/revocation |
| K12 Opt-in reminders and safe follow-through | U02/U03/U13/U20 | user-created schedule/timezone opt-in, never auto-send/spend, cancellation & restart readback; **requires separate scheduled worker implementation/owner review** |

**K12 is an architectural readiness/opt-in follow-up target, not fully owned as a production scheduler in this 20-window round.** U02/U13 can create contracts/stubs? **NO inert user-facing reminder buttons**; record as DEFERRED if worker, scheduler, timezone, background job, consent lifecycle not genuinely implemented. Avoid "all K complete" unless independently verified. U20 must honestly flag K12 NOT_IMPLEMENTED when appropriate.

## 5. Work merger's concrete return path when user's Work quota resets

This plan enables parallel source progress but **does not presume Work can run now**. Later one authorized Work integration window should:

1. Fetch current `main`, current PR list and each U01–U20 draft (base/head SHA, changed files, claims/evidence); recover Work #497 exact integration tree, Firebase #461, original R01–R19/C01–C08 branches and closed superseded PRs; do **not** trust today's snapshot over then-current heads.
2. Group by source truth: #497 shared Gateway/Flutter fixes/Firebase; C01 #468+R18 #435, C02 #472 vs #475, C03 stacked PRs, C04 #478, C05 #474 vs #476, C06 #487 vs #490, C07 #480 and R17/C08 #493. Choose one authoritative schema/route/composition and preserve genuinely useful tests from alternate implementation.
3. Take U01 **as contract anchor**; compare every U lane's pinned contract version and reject schema drift. U02 task/event storage+status next; U04 adapter binds real R/C APIs; U03 mounts into C07's **single** Assistant with R17/C08 root; U08 attaches strictly opt-in to C02 message selection; U09 uses native voice under R02; U10–U13 attach to C02–C05 and R14; Talks U14–U16 to R04/R09/R13, Twins U17–U18 to R03/R19/creator; U19 quality and U20 contract/metrics.
4. Inspect **all migration filenames** globally and use a single integrated forward history; don't apply duplicate `0017`, split unverified C02 copy or partially compose non-existent routes. Run migration upgrade from real previous schema in disposable PG then auth/ledger/DM race/recovery tests. Validate Gateway main.ts registration and server process startup/readyz, not just isolated unit compile.
5. Resolve accumulated TS types/lints/Flutter failures without bypass. Execute `pnpm install --frozen-lockfile`, relevant `pnpm test:ci` and typechecks/builds; from `apps/mobile` `flutter pub get && flutter analyze && flutter test`, Android release build and actual device tests; install real Firebase local defines after approval, test FCM/notification deep links, LiveKit Gemini voice, escrow/signing. CI #457 infrastructure needs real executed jobs; don't claim green merely from exhausted quota.
6. For each K01–K12 and J01–J11, record full **entry → action → auth → DB/provider/media/event → receipt/readback → outage/restart/retry → exit/return** and negative privacy checks. Real provider/market/finance tests need explicit account and owner permission; don't move customer money casually.
7. **Only merge PRs with full applicable executable evidence.** Others remain draft with exact blocker; no blanket branch cleanup. If technical debt remains, quantify by specific missing code or test, not an "80% done" number. Keep a final published release qualification ledger and branch disposition audit.
8. **Shorebird only after** canonical Flutter source integrated and native device baseline proved; follow existing policy and qualification runbook. No new app framework or silent forced update.

## 6. Mandatory per-window handoff file schema

Each U window must create exactly `docs/workstreams/uNN-<specific-name>-20261008.md` on **its own branch**, at beginning claim and final exit update. Every handoff must include:

```markdown
# UXX — feature
Owner window: UXX; current scope/lease timestamp UTC; status
Base main SHA: ...
PR URL: ... (DRAFT); head SHA: ...
Prior art reviewed: existing R/C PRs, refs/SHAs; what was reused
Exact files touched: new modules, tests, migration proposal; list by layer
Contract versions: U01 V1 SHA; public APIs and auth/role/tenancy schemas
Implementation ledger: DB, migration, API, auth, Flutter, voice/tap, retry,
                         metrics, tests; COMPLETE / PARTIAL / BLOCKED each
Integration seam: exact shared composer/router/DB registry additions Work must do;
                  failure if not composed; no isolated test claimed E2E
Tests actually RUN: exact command, commit SHA, environment, counts, exit/logs
Tests NOT RUN: exact command, external blocker, required executor/device
Threat review: IDOR, prompt injection, stale quote, media/audio leak, duplicates
Capabilities outside scope: e.g. E2EE, unsupported provider, proactive jobs
Ownership conflicts and dependencies: active PRs and accepted resolution
NEXT WORK: concrete ordered merge/test/activation actions
User-facing outcome evidence: linked actual J/K or R/C test, no screenshots-only
```

Require `git diff --check`, compile if tools available, targeted deterministic tests, schema/lint/fixtures, final PR changed-file inventory; no uncommitted code or chat-only handoff. Include negative tests and complete acceptance/failure states. Work cannot reconstruct undocumented intent across 20 windows.

## 7. Pre-merge collision and refusal policy

A U PR must be **blocked/reworked** if it:
- touches shared Gateway root, global Flutter router, common money ledger or Firebase without delegated single owner;
- duplicates C02 DM migrations/approval, changes R09 LiveKit/safety domain without elected owner, or replaces existing C07 Assistant with a second screen;
- introduces blank mock-success UI, client-priced/provider fake transfers, other-person DM model ingestion, remote arbitrary code, always-on microphone or new E2EE claim;
- has zero actual source integration and calls itself completed, or treats a report of disabled CI as PASS;
- exposes signing/private/FCM/Gemini/NOWPayments secret or production identity in source, logs, source-generated files;
- silently changes the existing green/blue branding decision or app shell without explicit owner-approved UX decision;
- claims financial, media or app-store readiness without the required real provider/device/security proof.

## 8. Quantifiable progress rather than fabricated percentages

Report at least these metrics per K journey: server-truth completed/failed/unsupported count, unsafe side effects count, authorization bypass count, app restart recovery outcome, accessibility parity, median/p95 time-to-usable-result and real device/network condition. A journey without integrated Gateway ↔ Flutter ↔ DB/media ↔ readback is **NOT VERIFIED**. Record source completeness counts and integration gates separately.

**20 windows producing 20 PRs is an engineering-output milestone, NOT 80% verified application functionality.** Work integration may be large because composition, migrations and real-device verification remain cross-cutting. Prioritize eliminating duplicate partial systems and delivering truly useful work over maximizing code change volume.

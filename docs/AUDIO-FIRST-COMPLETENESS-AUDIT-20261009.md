# Completeness audit — 2026-10-09

Status: specification and evidence-gap audit, not exhaustive certification. No honest claim of “every little detail handled” is possible from documents alone. Local app changes/APK are unavailable here; code, device, provider and operational behaviour still require inspection and executed evidence.

## Confirmed decisions

Bottom navigation: **Chats · Rooms · Talks · Gwani · Wallet**. **Talks is centre/default** on ordinary authenticated home launch. **Gwani** is the former Assistant consumer label. Calls are nested in Chats. New chat opens Masana & Contacts. These are settled owner requirements; remove the previous navigation-placement uncertainty from new work.

Existing proposed defaults such as three-minute posts and approved-merchant P2P remain explicitly reversible. MSN precision/backing/liquidity/rates and secure financial authorization are activation decisions to establish, not arbitrary coding defaults.

## What has actually been checked

- Current product/screens/money/contracts/window documents inspected against the owner's latest instructions.
- Fourteen proposed lane boundaries and dependency graph structurally checked in the prior update; recheck after changes.
- All 76 old R/C/U/F IDs have recovery ownership, not completion evidence.
- Prior update preserved runtime/config/submodule entries unchanged and archived original instructions.
- No local APK inspection, physical-device audio test, live escrow settlement, financial provider qualification or production restore is established by this audit.

The existing screen tables define the major surfaces and common states. They are not yet all route-specific implementation schemas, pixel-perfect designs, instrumented device evidence or proof of every product edge case. AF00 verifies affected detailed contracts before dispatching dependent UI.

## Gaps and closure evidence

| Gap | Current state and required decision/implementation | Owner | Closure evidence |
| --- | --- | --- | --- |
| Local improvements | Unavailable: preserve local branch/head/dirty diff, signing/version/build/APK checksum before replacing screens | AF00 | Source comparison and reproducible build with improvement dispositions |
| Navigation correctness | Order/default/name now confirmed; implementation pending | AF00 | UX-A03: cold launch/auth, centre index 2, labels, semantic storage migration, old routes, deep links, Back and resume |
| Screen-specific contracts | Common states/table present; each concrete route still needs actual API fields, enabled rules, sheet dismissal/draft/retry and binding review | AF00 + feature owners | Requirement→screen→control→contract→negative test map with no inert actions |
| MSN economics | Precision, issue/retire authority, backing, rate policy, spread/fees, treasury liquidity and limits not externally qualified | AF01 | Adopted financial contract, balanced migration fixtures, sufficient liquidity and reconciliation proof |
| Legacy balances | Cr and fiat fields cannot simply be renamed; existing customer obligations require classification | AF01/AF03 | Versioned migration/reconciliation, no lost funds, exact decimals and rollback |
| Fiat funding | Currency/method eligibility, settlement finality, refund/chargeback and confirmed-payment/conversion-failure obligation unresolved in actual providers | AF01 | WF-A01 real adapter/DB proof and recoverable pending/refund path |
| Crypto eligibility | Each asset/network/pair, minimum, fee, confirmation/reorg/address/memo, custody and withdrawal capability needs qualification | AF01/AF03 | WF-A02/A03/A07; disallowed choices cannot execute |
| Phone numeric password | Owner requested; no ownership verification implied. Password strength, guessing defence, secure recovery/linking and wallet step-up need concrete implementation | AF08/AF01 | WF-A09, no account takeover by number claim, secure reauth/recovery and enumeration tests |
| P2P merchant lifecycle | Onboarding/eligibility, payment methods, offer create/edit/pause, available MSN limits and counterparty risk need controls | AF02/AF01 | Role-separated offer/order tests; rate/terms snapshotted; offer edits cannot alter active orders |
| P2P settlement/disputes | Claim/screenshot is not bank proof. Exact/partial/wrong/late/third-party payments, irreversible versus reversible methods, paid-timeout races and fiat reimbursement need qualified policy | AF02 | WF-A05/A06 with frozen escrow, receipt matching, two-party/operator authority and no double release |
| P2P operations | Review staffing, audit/evidence retention, decision reasons, notification privacy and feature-disable behaviour needed | AF02/AF13 | Minimal real dispute console/runbook; disable creation while resolving existing orders |
| Chat transfer states | Financial success and chat delivery are separate; asset precision, stable recipient identity, pending/failed cards and retries need implementation | AF06/AF01 | WF-A04: identical Wallet/Chat service/receipts, no duplicate debit or false transfer success |
| Gwani purchase catalogue | Exact service options/network/recipient validation, insufficient funds, quote expiry, consent invalidation and uncertain fulfilment require real bindings | AF04/AF01 | UX-A06/A07 through menu-only, conversational-only and mixed-mode flows |
| Recorded versus live audio | Recorder/codec/file permissions, upload/readback, streaming/provider and speaker failures must be independent | AF05 | Local clip plus two-device UX-A05; staged typed errors without generic microphone blame |
| Background audio/calls | Interruption, audio focus, microphone ownership, Android foreground-service/notification policy, Bluetooth and lifecycle recovery unqualified | AF05/AF11/AF10 | Physical-device background/lock-screen/reconnect tests; permission denial and next recording succeeds |
| Talks publishing/social | Trim/length/size/processing/draft retry, publish/delete/moderation races, deduped played-time counts, block visibility, comments and storage retention need implementation | AF09 | UX-A08/A09 against real media/DB and two accounts, bounded data/storage |
| Rooms membership | Public/private/invite/request policy, ownership/admin transfer, kicked user revocation, history visibility and recording consent require explicit controls | AF10 | UX-A10 outsider/removed-user denial, durable history and optional live-session qualification |
| Masana editorial quality | Retain actual personas/voices; factual sources, AI/fiction disclosure, user reports, sensitive topics, originality/content rights and multilingual emotion/pronunciation need review | AF12 | CR-A01: generated and listened-to samples, safe factual attribution, no empty/duplicate posts |
| Creator scheduling/cost | Timezone, frequency, budget, retry/lease, moderation queue, pause and publication uniqueness need actual worker/ops bindings | AF12 | Worker restart/idempotency and cost-limit tests; production schedule cannot exceed budgets |
| Privacy/security lifecycle | Sessions/caches/media URLs, encryption promises, minors/market eligibility, delete/export, financial retention, report/block and support escalation need current threat/privacy review | AF00/AF13 | PF-A01/A02 and role/IDOR/revocation tests; no unsupported E2EE or verification claims |
| Provider/legal/operations | MSN/P2P/custody payment acceptance, applicable market qualification, fraud/transaction limits, incident/support/liquidity/restore readiness unresolved | AF01/AF02/AF13 | Account/market-specific documented eligibility and WF-A10 real recovery evidence |
| Release/accessibility | APK signer/Firebase/native permission consistency, low-end devices, large text/RTL, keyboard, screen reader, data use and rollback unqualified | AF00/AF08/AF13 | PF-A03/A04, exact APK/SHA, qualified deploy/restore and rollback |

## Small supporting surfaces that must not be omitted

Reuse existing surfaces rather than multiply top-level pages. Explicitly cover:

- Gwani: draft Back/Change/Cancel, funding handoff, processing/status and receipt/support.
- Wallet: internal Send versus external crypto withdrawal, asset/network details, funding pending/refund, conversion review, receipts/status and restricted capability explanation.
- P2P: eligible merchant offer create/edit/pause, payment-method review, order terms/deadline, claim/confirm, cancellation before payment, dispute/evidence/history and merchant suspension without abandoning escrow.
- Chats/directory: contact request/block/report, optional invitation/phonebook consent, failed voice preview/retry, recipient review, transfer receipt and call permission/ringing/ended states.
- Talks/creators: own drafts/uploads, saved posts, profile/follow, comments/report/block/delete, AI/source disclosure and generation/publication status for authorized operators.
- Rooms: creation/settings, membership/invitation/requests, roles/owner transfer, leave/kick/report, notification preferences and optional live recording consent.
- Settings: profile/avatar/language, linked credentials/recovery, device sessions, privacy/block list, notifications, support and deletion/export.

Each feature owner extends its isolated specification/contract and tests within its lane; shared routes, translations and canonical exports go through AF00. Avoid invented extra tabs.

## Launch behavior and defaults

Cold ordinary home launch opens Talks after auth. An explicit valid notification/deep link or incoming call opens its intended resource after authorization. Background resume preserves an ongoing call/order/recording/conversation; do not abandon it or resume public feed audio unexpectedly. New signup/signin without a pending target opens Talks. Offline Talks shows marked cached posts or an honest empty state without blocking navigation to Chats/Gwani/Wallet.

Global mic/media failures do not block working text or tap purchase paths. Gwani tab renaming changes presentation, not the canonical assistant task identity, current Gwana choice, billing executor or private/public boundary.

## Gate and completion standard

AF00 maintains the gap dispositions and publishes ready contract SHAs; AF13 records evidence. A feature can be source-integrated when its relevant executable checks pass on a safe merge target. External gaps remain explicit production activation blockers for their affected capabilities.

Use NOT_RUN / BLOCKED / FAIL / PASS_SIMULATED / PASS_REAL with immutable source/artifact identities. A completed ledger row, a screenshot, docs checker or APK build does not prove provider/device/escrow functionality. Re-audit after local-source recovery and every material integration; only executed journeys can close verified behavior gaps.

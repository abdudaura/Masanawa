# Current acceptance journeys

Updated 2026-10-09. These replace old public live-Talk-first journey requirements; historical originals are [preserved](archive/20261009/docs/WHOLE-PRODUCT-ACCEPTANCE-JOURNEYS.md). They do not mark any implementation complete.

UX-A01–UX-A12 are fully described in [screen specification](AUDIO-FIRST-SCREEN-SPECS.md). Ownership: A01/A02 AF08; A03 AF00; A04 AF07; A05 AF05/AF06; A06/A07 AF04/AF01; A08/A09 AF09; A10 AF10; A11 AF11; A12 AF06/AF01.

## Wallet journeys

| ID | Complete journey and negative cases | Accountable lanes | Required actual boundary evidence |
| --- | --- | --- | --- |
| WF-A01 | Fiat payment → verified settlement → MSN credit → receipt; duplicate/forged callback and conversion-failure obligation | AF01, AF03 | Real qualified fiat adapter + database |
| WF-A02 | Crypto instructions → chain/provider confirmation → holding; wrong network/minimum guidance | AF01, AF03 | Qualified custody/provider + database |
| WF-A03 | MSN ↔ crypto quote → authorize → reconcile → receipt; expired/changed terms and liquidity failure | AF01, AF03 | Qualified conversion execution + database |
| WF-A04 | Wallet and chat internal transfer → one posting → identical receipts; retries/recipient spoof/account switching | AF01, AF03, AF06 | Two accounts/devices + database |
| WF-A05 | P2P reserve → fiat claim → qualified confirmation → release; competing orders and paid/expiry race | AF01, AF02 | Database concurrency + qualified payment method |
| WF-A06 | Dispute → frozen escrow → authorized decision → one release/return; spoofed operator/screenshot and restart | AF02, AF13 | Role-separated accounts + database |
| WF-A07 | Crypto external withdrawal → authorization → provider status → reconciliation; unknown outcomes/duplicate submission | AF01, AF03 | Qualified withdrawal provider |
| WF-A08 | MSN available/pending/reserved display → receipt/history/status; ledger balances, precision and stale/offline protection | AF01, AF03 | Real database/readback |
| WF-A09 | Account recovery and transaction step-up; guessed numeric password/unverified phone cannot take over/receive by identity claim | AF08, AF01 | Real auth/session paths |
| WF-A10 | Backup/restore with pending deposits, conversions and escrow → reconciliation without double effects; rollback stops creation but settles existing work | AF00, AF13 | Disposable restore plus qualified staging |

## Creator and preserved-foundation journeys

- CR-A01 (AF12/AF09): actual sourced or clearly fictional script → Gemini audio → listening/duration validation → exactly one disclosed post → follow/play from another account. Confirm retry, duplicate schedule, budget exhaustion, admin pause and empty/failed audio.
- PF-A01 (AF00/AF13): edit avatar/profile → persisted readback across screens/restart; block/report applies to posts, contacts, Rooms/calls and media.
- PF-A02 (AF00/AF13): private cache/session/channel revocation on logout/account switch; account deletion retains lawful financial/audit obligations and resolves open escrow without deleting funds.
- PF-A03 (AF00/AF13): preserved Firebase/push/deep links and linked WhatsApp/Telegram flows against real configured dependencies; no private financial details in public/lock-screen previews.
- PF-A04 (AF13): low-end/small screen, large text/screen-reader, RTL, reduced motion, weak network/offline/permission denial and background/foreground recording/calls. Record actual device/OS, elapsed times and data usage; establish budgets from measurement.

## Evidence record

Every journey initially NOT_RUN. Record exact code SHA and APK checksum/package/version, environment/device/provider, seed account roles without personal data, command/steps, expected/persisted outcome, redacted evidence and result: NOT_RUN, FAIL, PASS_SIMULATED, PASS_REAL or BLOCKED with reason.

Relevant build/unit/contract/negative evidence supports source integration; real complete-boundary evidence supports VERIFIED_E2E. Deployed qualification and rollback are additional. A document-link checker, screenshot, health 200 or compiled APK cannot promote a financial/audio/provider journey to PASS_REAL.

The safe release gate includes funded liquidity/backing rules, provider/regulatory qualification, dispute staffing, balanced/reconciled ledger, identity/transaction authorization, full audio/media permissions, secure signed APK/Firebase continuity, backup/restore, monitoring/cost limits and rollback. Unknown/unexecuted dependencies stay explicit.

## Confirmed navigation acceptance extension

UX-A03 additionally requires exact ordered tabs Chats · Rooms · Talks · Gwani · Wallet, Talks centre/index 2 and ordinary authenticated home-launch default, renamed Gwani accessible label, no bottom Calls/Contacts/Agents tab, validated explicit-destination precedence, non-destructive resume, semantic old saved-tab migration and unchanged private AI/human route meanings. AF00 implements; AF13 verifies on device. See [completeness audit](AUDIO-FIRST-COMPLETENESS-AUDIT-20261009.md) for unresolved boundaries; none is automatically PASS.

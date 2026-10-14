# Owner mobile corrections: Wallet, Rooms, Data, branding and artwork — 2026-10-14

**Source:** explicit follow-up from the app owner's installed-APK feedback. Work on the existing owner corrections branch/PR #738; do not reset prior changes. **Status:** DESIGN APPROVED BY OWNER REQUEST, IMPLEMENTATION IN PROGRESS, NOT PRODUCTION QUALIFIED.

## Verified baseline / root causes

- Currently deployed Railway Gateway is old `642c7d3`; owner mobile corrections are on draft PR #738. An APK pointed to the old Gateway cannot qualify Wallet, Crypto, Calls or Rooms behavior.
- `GatewayWalletTransport.load` uses `Future.wait` for Credits `/v1/wallet` and NGN `/v1/wallet/ngn`: either endpoint failure empties the entire Balance tab; separately keep NGN unknown, not zero.
- Crypto API/controller has its own capability/status error and may not have provider or ledger qualified. Make this independent, with clear retry/action-specific states. Never fabricate holdings.
- 26 SVG portraits/banners are bundled cartoon illustrations; no verified collection of 26 requested original photo portraits is present in the inspected asset folder. Existing `avatarUrl` takes precedence but missing URLs show cartoons; require identity-bound, HTTPS artwork. Do not misstate SVGs as delivered originals.
- Bootstrap support names are `Mallam Gwani Bodi` and `Malamah Gwana Sulafat`, conflating voice names with display names. Correct to **Gwani** and **Gwana**; preserve Bodi/Fola/Sulafat only in voice metadata as authorized. Match and update old bootstrap names without duplicating identities or replacing admin-custom labels.
- Current Rooms discussions are anchored to a lesson/question; `RoomHomeScreen` fetches both and exposes three tabs and a long intro. This cannot be a single room chat until Room-level messages and teacher replies are implemented through existing authenticated membership and worker contracts.
- Existing billing screen is dropdown-heavy, blocks initial load if history fails, and duplicates amount entry for fixed-value bundles; replace with network → number → authoritative bundles → confirm → receipt, with separate wallet funding route.
- `MasanawaWordmark` currently uses brandStrong rather than common `brand`; Chats/Calls/Wallet use grey `surfaceBg`.

## Wallet design (2 tabs, one Wallet root)

### Balance
1. Clean white screen, retained canonical green accent and header. Primary hero: **NGN available** (verified ledger in kobo), not Credits/MSN. If NGN endpoint unavailable show **Balance unavailable**, never ₦0.00 or a pretend balance. Credits/MSN separately labeled only when activated.
2. Compact account card: named bank, account name, dedicated NUBAN, copy action and activation/verification status. If no provider-assigned account: **Get bank account** (consent/identity details) or **Finish verification**; no fake numbers, no raw BVN logging/storage.
3. Small actions **Fund**, **Send** (only permitted), **History**. Fund opens bank account instructions/requery or existing independently qualified funding method. Transfers confirmed with amount, recipient, idempotency and receipt; no unqualified withdrawals.
4. Paginated server-backed history with statuses, time, amount, receipt/detail/retry; empty, offline, auth expired and provider maintenance states preserve screen structure.
5. Authenticated account fencing and reconciliation: no balances, account numbers or history from previous user when switching accounts. Optimistic balance changes prohibited.

### Crypto
1. Independently load supported asset positions; balances are custody-backed. Compact asset list with symbol/network, exact amount, fiat equivalent only if authoritative; empty/unavailable are distinguishable.
2. Open asset detail with **Receive/Deposit**, **Buy**, **Convert**, **Send/Withdraw** only if server capability allows. Show network, fee/minimums and confirmation before irreversible action.
3. Pending/completed/failed intent history with provider reference and retry-safe reconciliation. Provider outage does not remove the Balance tab.
4. Reuse existing NOWPayments custody and ledger/contracts, no second accounting table or wallet; keep monetary flags OFF until live qualification.

## Paystack dedicated virtual account integration
- Registered live Nigeria Paystack business and explicit customer consent required. Identity validation (bank account/BVN as applicable to merchant category), asynchronous account assignment webhook, current provider bank list. Do not issue all sign-ins silently or display account number until confirmed assigned.
- Backend: authenticated `POST /v1/wallet/funding-account` opt-in, `GET` status, account-fenced unique customer mapping, provider ref, assigned bank/account name/NUBAN. Idempotent create/assign/retry and no duplicate provisioning on repeated taps.
- Verify signed Paystack `charge.success` webhook HMAC and provider transaction/server-side amount/currency/account reference. Durable provider transaction journal; exactly-once credit to existing canonical NGN ledger and recovery/requery for delayed notifications. Handle pending identity validation, failure, duplicate/replayed callbacks, other-user account, and operational incident.
- **Important:** Railway currently lacks Paystack key and approval evidence, so no live account issuance until configured and permission checks pass. Never silently switch billing provider: Flutterwave remains source for data plans and fulfillment.
- Paystack references: https://paystack.com/docs/payments/dedicated-virtual-accounts/ ; https://paystack.com/docs/api/dedicated-virtual-account/ .

## Data Bundles
- Entry in both individual and Room chat header, as literal **Data Bundles** text (not SIM icon); small-screen header adjusts.
- Show Nigerian operator logos **only if licensed/bundled assets are available**; otherwise labelled brand monograms, not fabricated image logos. Detect prefix locally as suggestion only; number portability means user confirms the network. 080/081 etc are not proof of current operator.
- Select from Flutterwave-backed, currently returned billers; phone number field, then scrollable catalog of bundles with price and Daily/Weekly/Monthly filters based on validated provider metadata. Do not fabricate duration from missing metadata; explicitly display unclassified provider items.
- Tap plan opens confirmation (network, recipient, size, exact NGN total/fees). Show canonical NGN wallet balance and shortfall; if insufficient, go to Fund wallet, preserve selection; canonical quote/confirm, idempotent dispatch, receipt, pending/refund reconciliation.
- No red raw error banners. Friendly inline retry status and accessible empty states; backend category must remain MOBILEDATA-only.

## Rooms
- Discover card: profession-only name, teacher name as separate chip/tag below, price/free badge, trial duration/terms only if authoritative, membership count. White surfaces and restrained green accents, no long description.
- Single-tap: joined/entitled users go directly to **Room Chat**; nonjoined see a *compact info/join sheet*, visible price/trial, no document style. Join/entitlement confirmation then enter chat.
- Chat: WhatsApp Channel-inspired list with teacher messages distinguished, member text messages and threaded teacher replies, composer, server timestamps/status, paging, moderation/report, read-only states, account fencing, permission denial and retry; no Lessons/Questions/Discussions tabs and no target dropdown.
- **Backend dependency:** current discussion API only accepts lesson/question parent. Add proper room-level messaging with authenticated room membership/entitlement and worker teacher replies, stable idempotent message IDs, persistence, replay and account segregation. Do not pretend existing lesson dropdown is the requested chat.
- Header: title, teacher info, Data Bundles text, compact room info/leave menu.

## Branding, backgrounds, personas, portraits
- Use canonical `MasanawaColors.brand` on wordmark/icon actions (not `brandStrong` or custom hardcoded greens). Light theme surfaceCard = white for Chats, Wallet, Calls; preserve dark-theme semantics.
- Gwani/Gwana visible names contain no voice-label suffix; existing saved records matched/migrated carefully without duplicating characterId. Voice assignment metadata remains separate.
- Real portrait assets must be proven present (source or server URLs), matched by stable character IDs, and displayed consistently in list, chat, profile/Rooms. Unknown image: neutral initials instead of pretending SVG cartoons are the final portraits.

## Acceptance / release sequence
1. Source + widget tests for branding, names, white surfaces, Wallet independent failure modes, account fencing, Room cards and navigation, Data selection/confirmation.
2. Gateway/PG tests for Paystack consent/webhook/credit once, provider catalog, read-side and Room messages/teacher replies; negative account and financial cases.
3. Exact-commit CI (Flutter full focused, Gateway compile/typecheck, real PostgreSQL), APK version/signature/provenance; establish baseline for unrelated analyzer failures without weakening checks.
4. Deploy matching Gateway revision to existing Railway service only after financial flags/auth/migrations/health and rollout safety checked. Readiness + authenticated wallet, chat, Rooms/data endpoints + actual Android device tests. Crypto and funding remain disabled with honest status where providers unavailable.
5. Merge compatible, tested development work to main; never claim release E2E from a build or unit test alone.

## Progress log
- Initial source inventory completed; this plan saved before subsequent changes. Feature implementation and real provider qualification are separately tracked.

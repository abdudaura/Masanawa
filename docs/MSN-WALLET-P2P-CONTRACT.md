# MSN Wallet, P2P and Purchase Contract

Status: authoritative target design; implementation and provider qualification remain to be verified.

This document supersedes product instructions that describe a spendable NGN wallet, direct platform fiat withdrawals, credit-branded balances, or crypto sales through P2P. It does not assert that existing implementations are complete.

## 1. Implementation authority

Inspect and extend the existing MSN work in PR #576, quote/consent work in PR #454, and the repository’s canonical commerce authority before implementation. Verify their current merge status, exact commits, contracts and tests.

Reuse the existing ledger, authorization, quote, transaction and receipt infrastructure. Do not create a second ledger, independent chat balance, or competing purchase execution path.

Amounts, transaction status and eligibility are server authoritative. UI labels and assistant text cannot establish financial completion.

## 2. Product rules

| Operation | Behaviour |
|---|---|
| Fiat funding | Confirmed fiat payment purchases MSN automatically. Fiat is never a spendable user wallet asset. |
| Crypto funding | Supported asset/network deposits credit that crypto holding after required confirmation. |
| Crypto holding | Users can retain supported crypto independently of MSN. |
| Conversion | MSN ↔ eligible crypto using a current executable quote. |
| Internal transfer | Users can send MSN or eligible crypto to another platform account. |
| Platform fiat cashout | Unavailable. |
| P2P | Users buy or sell MSN against fiat paid between counterparties. |
| Crypto P2P sale | Unavailable; convert eligible crypto to MSN first. |
| Billing | Use the canonical purchase service and its supported MSN settlement path. |

“All crypto” means assets and networks explicitly qualified by the platform. Unsupported assets must never appear as executable choices.

## 3. MSN definition and accounting

Before money movement is enabled, configure and document:

- MSN denomination and precision.
- Issuance and retirement authority.
- Backing and custody model.
- MSN pricing and conversion policy.
- Liquidity requirements and treasury limits.
- Deposit, conversion, transfer and P2P fees.
- Refund and chargeback treatment.
- Whether MSN is an internal accounting unit; do not imply an on-chain token without an implemented token.

**Proposed default:** MSN is an internal ledger asset. Adoption requires reconciliation with PR #576.

Use exact integer atomic amounts or the established exact-decimal representation. Floating-point arithmetic, silent truncation and client-calculated final settlement amounts are prohibited.

Ledger postings distinguish available, pending and reserved balances. P2P escrow reserves seller MSN; it does not credit the buyer until release. Financial history is append-only, with corrections expressed as linked compensating entries.

Maintain a balanced ledger transaction for every issuance, transfer, reservation, release, conversion, fee and refund. Provider identifiers, internal operation IDs and reconciliation records link to the same canonical transaction.

## 4. Funding and conversion

### Fiat funding journey

Select supported currency/payment method → enter amount → review rate, fees and MSN received → authorize → complete provider payment → processing → MSN receipt.

A provider success redirect is not proof of settlement. Authenticate provider events and verify status through the established provider adapter. Process duplicates exactly once.

Record fiat payment details for settlement, reconciliation and refunds without exposing a spendable fiat wallet.

A confirmed payment followed by conversion failure becomes a visible pending funding operation. Preserve the obligation and retry or refund according to provider capability; do not silently lose the deposit.

### Crypto funding journey

Select asset and network → display deposit address, memo if required, minimum and confirmation requirements → awaiting deposit → confirming → credited.

Address and network must come from the server. Show mismatched-network and minimum-deposit guidance before payment. Handle chain reorganizations through the established custody/provider policy.

### Conversion journey

Select source and destination → amount → executable quote → review → authorize → processing → receipt.

Quotes include atomic source/destination amounts, fees, rate, expiry and eligibility. Expired quotes require a refreshed review and consent. Conversion executes only when liquidity is available; insufficient liquidity produces a recoverable unavailable state.

Do not imply atomic provider execution where unavailable. Track intermediate execution, recover failures and reconcile partial outcomes.

## 5. MSN-only P2P escrow

**Proposed initial scope:** approved merchants, supported bank/payment methods, fixed-price offers and one active counterparty per order. No auctions, margin trading or crypto order book.

### Order journey

Offer → amount → review → atomically reserve seller MSN → buyer receives payment instructions and deadline → buyer claims payment sent → receipt verification or seller confirmation → escrow release → receipts.

Payment instructions are bound to the order. Changes require a controlled cancellation/new order rather than silently replacing account details.

### State transitions

| State | Allowed next states | Rule |
|---|---|---|
| `RESERVING` | `AWAITING_PAYMENT`, `FAILED` | Create order and reserve MSN atomically. |
| `AWAITING_PAYMENT` | `PAYMENT_CLAIMED`, `CANCELLED`, `EXPIRED`, `DISPUTED` | Deadline/cancellation can return escrow only if no payment claim or unresolved payment evidence exists. |
| `PAYMENT_CLAIMED` | `RELEASE_PENDING`, `DISPUTED` | Buyer claim and screenshots are not proof. |
| `RELEASE_PENDING` | `COMPLETED`, `DISPUTED` | Valid receipt evidence/confirmation authorizes exactly one ledger release. Retry transient execution failures. |
| `DISPUTED` | `RELEASE_PENDING`, `REFUND_PENDING` | Escrow stays frozen; authorized adjudication records evidence and reason. |
| `REFUND_PENDING` | `CANCELLED` | Return reserved MSN exactly once after an authorized resolution. |

Terminal order outcomes cannot be overwritten. Any correction uses an auditable resolution linked to the original order.

Timeout and payment-claim handlers must contend on the same order version/lock. Once payment is claimed, expiry must not automatically release MSN back to the seller.

The buyer can mark paid; the seller or qualified verification service can confirm receipt; an authorized dispute operator can resolve disputes. Every endpoint enforces actor, order membership and valid current state.

Fiat reimbursement after an erroneous payment is separate from returning escrowed MSN and must remain explicitly tracked.

### Automation limits

Automate reservation, deadlines, reminders, provider status checks, release, receipts and reconciliation. Bank transfers without reliable verification and disputes require review. Do not promise fully automatic resolution from screenshots.

## 6. Internal transfers and chat

Wallet and chat invoke the same canonical transfer service.

Chat attachment → Send money → asset → amount → optional note → recipient review → authorize → processing → transfer receipt card.

Bind the recipient to a stable account ID, not display name or unverified phone number. Show sufficient identity context before confirmation.

**Proposed default:** internal crypto transfers move ledger entitlement without an on-chain withdrawal, subject to the established custody model. External crypto withdrawal is a separate, qualified flow.

Transfer cards display server status and reference the canonical receipt. Chat delivery failure does not reverse a completed transfer. Transfer failure does not produce a success card.

Never expose balances or private receipts in public Talks or Rooms.

## 7. Gwani purchases

The Gwani screen’s centrally arranged vertical billing menu and free-form composer share one server-backed purchase draft.

Select service → progressively select options → supply missing values through menu, text or voice → review → explicit authorization → execute → receipt.

Preserve selected choices with Back/Change controls. Changing recipient/product/amount invalidates the prior quote and consent.

The assistant can propose a transaction and resolve missing information. It cannot authorize user spending. Reuse PR #454 consent semantics and the canonical commerce executor.

Review includes recipient, product, provider where relevant, MSN debit, fees, expected delivery and quote expiry. Ambiguous recipients require clarification.

Retries, reconnects and channel changes must continue the existing operation instead of creating another purchase. Uncertain provider outcomes show “Checking status” and reconcile before retrying execution.

## 8. Authentication and authorization

Phone plus numeric password does not prove ownership of that phone number. Store it as unverified until a qualified verification mechanism succeeds.

Do not use unverified numbers for recipient ownership, trusted contact discovery, recovery or P2P trust. Apply server-side rate limiting, secure password hashing, session management and account-enumeration protection.

A short login PIN must not be the sole authorization control for wallet spending. Use the repository’s established secure transaction authorization and recovery mechanisms. Never silently weaken authentication to accommodate a PIN UI.

## 9. Screen contract

| Screen | Required content |
|---|---|
| Wallet home | Available MSN, hide balance, optional indicative fiat equivalent with timestamp, Add/Send/Convert/P2P, crypto holdings, recent activity. |
| Funding | Currency/asset and method/network selection, amount, limits, quote, payment instructions and status. |
| Conversion | Source/destination, available source amount, quote, expiry, fees, review and authorization. |
| Transfer | Stable recipient identity, asset, amount, optional note, review and authorization. |
| P2P home | Buy MSN/Sell MSN/My orders; compact offers with rate, limits, payment method and reputation. |
| P2P order | MSN/fiat amounts, counterparty, escrow status, instructions, deadline, contextual actions and support. |
| Receipt | Operation ID, amount/asset, fees, timestamps, status, counterparty/provider reference and support entry. |
| Dispute console | Role-controlled queue, evidence, ledger/provider context, audit trail and reasoned resolution. |

Every screen supports loading, empty, offline, permission/authentication failure, validation failure, provider unavailable and retry states where applicable.

Offline screens may show cached information with freshness clearly stated. They cannot claim fresh balance or successful financial execution. Preserve drafts; require revalidation on reconnection.

## 10. Verification gates

Required tests:

- Balanced postings and exact amounts across all asset precisions.
- Simultaneous spending/reservation cannot exceed available funds.
- Duplicate requests, webhooks and retries create one financial effect.
- Expired/altered quotes and replayed consent cannot execute.
- Forged provider callbacks and success redirects cannot credit funds.
- Funding conversion failure preserves a recoverable obligation.
- P2P timeout versus paid-claim races cannot release escrow incorrectly.
- Buyer/seller/operator permissions prevent unauthorized state transitions.
- Screenshot upload cannot independently release escrow.
- Dispute and settlement retries cannot double-release or double-refund.
- Chat and Wallet produce identical canonical transfers and receipts.
- Gwani menu/text/voice journeys share the same draft and consent.
- Account takeover, guessed PIN and unverified-number recipient cases.
- Real provider sandbox qualification, then controlled production qualification.
- Device journeys, reconnects, interrupted app lifecycle and accessible controls.

No end-to-end capability is complete without evidence of its actual provider, ledger, device and receipt path.

## 11. Operations and launch eligibility

Operate reconciliation for ledger, custody, funding providers, conversion execution and P2P escrow. Alert on unmatched events, stalled operations, negative balances, treasury shortfalls and overdue disputes.

Provide reversible feature switches per asset, network, funding method, conversion pair and P2P payment method. Disabling creation must not prevent existing orders from settling or being resolved.

Keep provider secrets server-side and redact logs. Record authorization and resolution audit trails with access-controlled evidence retention.

Before live enablement, document payment-provider acceptance, custody responsibilities, applicable legal/regulatory qualification, liquidity readiness, dispute staffing and rollback procedures. A generic payment account does not establish approval for the MSN/P2P model.

## 12. Research and qualification pointers

- [Google Gemini speech generation documentation](https://ai.google.dev/gemini-api/docs/speech-generation): qualify supported models, expressive delivery, audio formats, language pronunciation and current pricing for Masana audio posts. This is not evidence of tested integration.
- [CBN official circulars and guidelines](https://www.cbn.gov.ng/documents/circulars.html): retrieve and review the official “Guidelines on Operations of Bank Accounts for Virtual Assets Service Providers (VASPs)” dated December 2023, alongside current applicable rules. This reference does not establish approval, exemption or eligibility for MSN, custody or P2P.


## Additional settlement boundaries

Seller confirmation and operator resolution require secure authenticated authorization bound to the exact order revision. Payment evidence must match amount, currency, recipient and reference; address third-party payments and reversible rails through qualified policy before enabling that method. A screenshot is supporting dispute evidence only. Escrow protects the MSN leg; it cannot guarantee bank-payment finality or resolve chargebacks automatically.

P2P creation can be disabled while existing escrowed orders remain accessible for settlement/dispute. Dispute operators cannot arbitrarily move unrelated funds. Account deletion must preserve legally required finance/audit records and provide a resolution path for open escrow, pending funding and uncertain withdrawals without deleting financial obligations.

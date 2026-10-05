# Masanawa Twin Economy Contracts

Status: canonical product/domain requirements, 2026-10-05.
This document specifies invariants, not exact implementation APIs.

## Canonical ownership

Reuse `packages/commerce` for monetary truth.
Do not create another wallet package/service.

Reuse Identity/Agents/Memory for twin ownership/profile/runtime.
Do not create a twin runtime.

## User-visible balances

Normal Wallet projection:

- Spendable Credits
- Pending Earnings
- Available Earnings

Crypto asset balances remain exact asset-specific balances and must not be silently
merged into Credits.

Internal reserves/Agent Float may remain where already required by current Commerce, but
they are not a normal consumer balance.

## Credit transfer

Required command facts:
- sender User/account;
- recipient User/account;
- amount;
- currency/unit;
- RequestId/idempotency key;
- source account;
- destination account;
- provenance/origin class;
- createdAt;
- receipt.

Rules:
- transfer is atomic debit+credit;
- no overdraft;
- same request replays same result;
- same key/different fingerprint conflicts;
- transfer does not mint value;
- transfer does not create acquisition commission;
- self-transfer is rejected or no-op by explicit policy;
- reversal must be a new append-only ledger event, never row editing.

## Gift / blessing

Gift is a transfer with explicit social/economic intent and separate receipt/reason.

Rules:
- source value already exists;
- recipient is the twin owner/eligible creator account;
- gift itself does not create another acquisition commission;
- platform fee, if introduced, must be explicit quote/policy;
- self-gift and circular abuse do not create earnings multipliers.

## Originating twin attribution

Attribution must be a durable fact separate from fulfillment executor.

At minimum:
- originating Character/twin;
- owner User;
- customer User/session where known;
- source event (share link, conversation, purchase);
- attributed operation/order/funding ID;
- policy revision;
- timestamp/expiry;
- self-attribution flag/rejection;
- settlement/reversal references.

Attribution may produce commission only for policy-approved events.

## Acquisition commission

Do not hard-code 1%.

Use versioned policy:
- event type;
- rate/basis points;
- minimum/maximum;
- eligible origin;
- exclusions;
- effective time;
- region/product conditions;
- reversal behavior.

Qualifying examples may include:
- external wallet funding first admitted through a twin;
- actual eligible platform purchase through a twin.

Non-qualifying:
- internal Credit transfer;
- self-funding through own twin;
- gift transfer;
- refunded/reversed funding;
- circular movement;
- synthetic test traffic.

## Commerce purchase through twin

Customer stays in the twin conversation.

Financial path remains canonical:
quote -> payment/authorization -> fulfillment -> receipt -> settlement.

Originating twin attribution is additional settlement input; it never changes provider
truth or allows model text to set amounts.

## Paid feature trial policy

Paid features use one reusable, versioned trial policy.

Required fields:
- feature key;
- policy revision;
- enabled/disabled;
- duration in days;
- optional usage cap;
- effective time.

Initial default: **7 days**, enabled, with no default usage cap. Admin may later change
duration, enablement or cap without an app release.

Trial starts on first qualifying admitted use, not account signup. The server records the
policy revision, start and expiry. A client timer is not entitlement truth.

A trial-covered operation must settle at zero customer charge. Once the trial expires or
its configured cap is exhausted, a new normal paid quote/consent is required.

## Paid twin voice

Voice is a distinct paid product from free text.

Server financial truth must include:
- quote/pricing revision;
- payer;
- twin/owner attribution;
- charging unit (e.g. minute/usage block);
- spend cap;
- session identity;
- admitted start time;
- usage evidence;
- final charge;
- owner revenue share;
- platform revenue;
- refund/reconciliation state.

Client timers are presentation only and cannot be canonical billing evidence.

Interrupted/ambiguous sessions must reconcile before final settlement.

## Paid access to real owner

This is not ordinary AI work fulfillment. It is a scheduled human-access product.

Required durable state:
- request ID;
- requester;
- owner;
- twin attribution;
- requested modality;
- duration;
- schedule/window;
- quoted price/policy revision;
- payment hold/reservation;
- status;
- acceptance/expiry timestamps;
- attendance/completion evidence;
- settlement/refund;
- dispute/reconciliation.

Suggested states:
`requested -> accepted -> scheduled -> active -> completed -> settled`

Terminal alternatives:
`declined | expired | cancelled | no-show | refunded | disputed`

State transitions must be deterministic and replay-safe.

## Payment hold

Use canonical Commerce reservation/ledger semantics rather than claiming legal escrow if
the provider/account structure is not actually escrow.

UI may say "held until the session happens" only when the implementation guarantees the
funds are reserved and refundable under policy.

## Activity projection

Activity is derived/read-model data, never financial truth.

Sources:
- twin visitor/session events;
- Commerce ledger/settlement;
- voice metering;
- owner-access state;
- gifts;
- attribution.

A missing/stale Activity row must never change balances or settlement.

## Suggested append-only schema additions

Exact migration owner decides physical names. Likely Commerce-owned durable entities:
- credit_transfer_commands/receipts;
- attribution_records;
- monetization_policy_revisions;
- voice_usage_sessions;
- owner_access_requests;
- owner_access_reservations/settlements;
- gift receipts or ledger reason metadata.

Identity-owned:
- public twin profile/discoverability/share identifier.

Read-model/analytics:
- twin activity projection.

Do not edit applied migrations. Add new ordered migrations only.

## Fraud and abuse requirements

Before production:
- self-attribution prevention;
- circular transfer detection/limits;
- gift abuse limits;
- rate/spend caps;
- chargeback-aware earnings holds;
- negative-balance/recovery policy;
- owner-session no-show policy;
- duplicate-device/session voice abuse checks;
- test/admin traffic exclusion;
- clear audit trail.

## Admin controls

Admin must be able to change policy without app release:
- acquisition commission percentage;
- commerce commission policy;
- voice pricing and owner share;
- owner-session platform fee bounds;
- feature availability;
- transfer/gift limits;
- hold/expiry windows.

Changes are versioned/effective-dated; historical transactions keep the policy revision
used at admission.

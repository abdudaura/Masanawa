# Durable channel ingress custody

Status: Task 097 contract implementation.

## Purpose

The WhatsApp/Telegram ingress adapters already authenticate and normalize provider
webhooks into bounded `ChannelIngressRecord` values. This contract defines the durable
persistence semantics those records require before a webhook may be acknowledged.

## Replay identity

`dedupeKey` is the durable replay identity.

For any one key:

- no existing row -> store the record;
- existing row with identical `evidenceHash` -> exact duplicate/replay;
- existing row with a different `evidenceHash` -> conflict.

A conflict must abort the whole atomic batch. Partial batch persistence is not acceptable.

## Atomic store contract

`AtomicChannelIngressStore.admitAtomic(records)` must:

1. evaluate the entire normalized batch against durable state;
2. roll back all new rows if any dedupe/evidence conflict exists;
3. return exactly one observation for each requested unique record;
4. echo the exact dedupe key and evidence hash;
5. mark each observation as `stored` or `duplicate`.

The adapter wrapper validates the store response before reporting success. Missing,
duplicated, mismatched or invalid observations fail closed.

## Webhook outcome

`createDurableChannelIngressAdmission()` implements the existing
`DurableChannelAdmission` interface.

- if at least one row is newly stored, outcome is `persisted`;
- if every row is an exact durable replay, outcome is `duplicate`;
- exact duplicates inside one webhook batch are coalesced before the store call;
- conflicting evidence inside the same incoming batch is rejected before storage;
- an empty normalized batch is a no-op duplicate.

The existing webhook admission layer already redacts persistence failures and returns a
retryable unavailable error rather than acknowledging uncertain storage.

## Authority boundary

Durable channel ingress is transport evidence only. It does not prove that an external
phone/Telegram id is a Masanawa User, does not select a Character/Relationship and does
not grant Tool, payment or workflow authority.

Proof-backed channel identity resolution and deterministic canonical routing remain
separate later steps.

## Persistence implementation

A PostgreSQL adapter should implement this contract in one transaction with a unique
constraint on the account-scoped durable replay key and immutable evidence hash. This
slice intentionally does not register a migration root or edit shared storage/deployment
composition.

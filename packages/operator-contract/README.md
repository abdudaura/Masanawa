# U01 — Operator contract V1 (isolated draft)

Pure, side-effect-free protocol package for the proposed private Gwani/Gwana operator. Runtime JavaScript is paired with TypeScript declarations branded with existing `@masanawa/contracts` identity types. Imports are via `@masanawa/operator-contract` once Work adds the workspace dependency to the selected Gateway/Assistant owners; **there is no route, persistence or executor registration in this PR.**

## Server integration (not installed)

1. Parse all model/client proposals with `parseOperatorProposal` before attempting domain discovery. Never permit model-provided user, tenant, account, approval or receipt.
2. Obtain `VerifiedPrincipal`, country and interaction scope **exclusively from current server authentication**; call `authorizeOperatorProposal` with an actual current capability catalog, owner policy and resource/DM-membership authorization callback. Callbacks must reauthorize again at execution (TOCTOU).
3. U02 persists task ID, append-only events and idempotent operations; the caller binds `requestId` to the same authenticated account/operation and reads status on timeout. U01 only validates the event cursor and phase transitions; it cannot guarantee concurrency/idempotency alone.
4. For send/money, U02/domain owner issues an unguessable approval ticket and persists it with exact canonical terms, identity, revision, expiry and state. On explicit review, lookup the issued ticket by exact identity from trusted storage, then invoke `verifyIssuedApproval`. **Never pass model/client-supplied `issued` as authoritative.** Mark ticket consumed atomically in DB and delegate to domain owner; `admitTaskExecution` is a secondary phase gate, not authorization. Do not treat a spoken “yes” as a ticket.
5. `advanceTaskPhase` requires verified domain receipt/readback to represent success; an uncertain provider response is `reconciling`. Event deltas must be contiguous and scoped; missing page triggers full authorized resnapshot.
6. `selectOperatorCard` degrades unsupported/old app versions to inert explanatory text. It never embeds links, scripts, actionable tokens or grants in the projection. U03 attaches separately verified server action capabilities when integrated.

## Responsibility and limitations

- Contract code and deterministic tests only: no implicit currency exchange, actor signing, provider request, DM access, native audio, SQL, asset storage or Flutter composition.
- C07/R17/C08, U02/U03/U04, Firebase and financial ledgers remain owned independently.
- Input size, deep object, prototype/secret key and exact capability+version checks are only the first security boundary; each domain validates its complete payload schema with live auth and nonce/idempotency semantics.
- Tests: `node --test packages/operator-contract/test/index.test.mjs` from repo root with Node >=24, plus `pnpm --filter @masanawa/operator-contract typecheck` after workspace install. No production wiring or device evidence is claimed.

# Crypto production integration — 2026-10-05

Owner/window: ChatGPT integration continuation explicitly requested by user.

Branch: `work/crypto-production-integration-20261005`
Base: current `main`.

Transferred integration scope:
- integrate PR #124 crypto backend and PR #130 mobile wallet onto current main;
- integrate the production-session financial authority from PR #128 without reintroducing developer tokens;
- wire shared Gateway financial routes/runtime composition previously deferred to PR #100;
- preserve current main changes and do not overwrite unrelated active work;
- reuse the existing NOWPayments fixed-egress relay at 209.38.107.173 only.

Owned for this integration branch:
- crypto-specific new files from PR #124 and PR #130;
- minimal merge edits to current shared Gateway/Postgres/mobile package/index/config files required to expose those capabilities;
- this claim.

Source checkpoints:
- backend PR #124: `cb21805ea58e1dbe6e52340ed72ca49cec463320`;
- mobile PR #130: `7c16aa600a9f17a408f95ed4e222f5d6f7a80763`;
- production auth PR #128 remains the source for normal-session authority semantics.

Rules:
- no fixed developer token for production financial routes;
- deposits, withdrawals, conversions and Buy remain fail-closed unless runtime evidence qualifies them;
- no second relay/server;
- no secret values committed;
- run available CI/typechecks/tests, and record zero-step runner failures honestly.

# Crypto payment recovery continuation

Owner: crypto/payment continuation window, explicitly requested by user 2026-10-04.
Base: 78b53596ad6a0bd36d45e258d2c26b23c25f49fa
Branch: work/crypto-payment-recovery-20261004

Scope transferred from financial-ops: services/gateway/src/financial_service.ts only, plus new services/gateway/src/financial_replay.ts, services/gateway/src/financial_replay.test.ts and this claim. No Flutterwave relay, billing, deployment, Commerce storage, mobile, shared composition or provider adapter edits.

Current step: recover missing replay validation before provider dispatch. Existing service returns an old intent even when operation, asset, amount or withdrawal address changed. Both early replay and concurrent dispatch reuse must validate exact terms.

Remaining broader gaps: conversion/account capability qualification; segregated custody reconciliation; deposit status recovery after missing webhook; payout account credentials and verification; confirmed quote/fee flow; end-to-end mobile/channel acceptance. Not represented as complete.

Implementation/tests/deployment: pending. Production deployment remains with the Flutterwave integration window.

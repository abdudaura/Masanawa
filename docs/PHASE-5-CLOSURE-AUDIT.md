# Phase 5 Tools and Providers Closure Audit

Status: **PENDING** — implementation evidence is strong, but the current provider
failure/telemetry/credential-custody head still requires a complete Foundation CI gate
and final adapter-boundary review before Phase 5 can close.

Scope: canonical Tool/Provider registry, readiness/selection, consequential execution,
credentials, external receipts/reconciliation, provider failure typing and telemetry.

## Canonical ownership

- `packages/tools` owns Tool definitions, capability registry and deterministic
  execution envelope.
- `packages/providers` owns Provider identity, readiness/selection, provider failure
  taxonomy and provider execution observations.
- `packages/security` owns authority/approval and credential custody/resolution
  contracts.
- `packages/events` owns Operation idempotency, external receipt evidence and
  reconciliation.
- `packages/telemetry` owns privacy-safe telemetry attribute policy.
- PostgreSQL adapters persist canonical state; they do not become a second authority.
- donor runtimes and provider SDKs do not own Tool, Provider, Security or Operation truth.

## Merged implementation chain

| Slice | PR | Merge |
| --- | --- | --- |
| Tool/Provider registries and deterministic selection | #37 | `b3f2e8ce33aeb4ed125bd40af78f10a454174bbd` |
| Consequential execution and reconciliation | #38 | `21141266ab15e2111b8f78c6df365100a60a017a` |
| Durable external receipts and replay | #39 | `8d531188e2f9d7c38f50cc883e3425096b5408ad` |
| Typed Provider failures and privacy-safe telemetry | #42 | `be814fee91b8b551b00e2d9900d2970680297b3d` |

Merged Provider failure/telemetry slice: PR #42, merge
`be814fee91b8b551b00e2d9900d2970680297b3d`.

Active credential-custody slice: PR #45, branch
`phase5-credential-custody`.

## Phase 5 acceptance matrix

### 1. Explicit provider selection never silently falls back — PASS

Evidence:
- ProviderId and exact key/version selection are mutually exclusive and validated;
- explicit missing, unsupported or non-ready providers fail closed;
- default selection is a separate deterministic path;
- registry tests prove an unavailable explicit Provider is not replaced by a ready
  fallback.

### 2. Unhealthy/unready providers are excluded from execution — PASS

Evidence:
- readiness is separate from immutable Provider registration;
- default selection considers only `ready` observations;
- stale readiness updates are rejected;
- explicit degraded/unavailable/disabled selection fails closed.

### 3. Tool/Provider version identity cannot be overwritten — PASS

Evidence:
- exact registration replay is idempotent;
- ProviderId rebinding and key/version rebinding conflict;
- ToolVersionId and Tool key/version rebinding conflict;
- Tool execution is pinned to exact ToolVersionId rather than implicit latest.

### 4. Consequential execution revalidates present authority — PASS

Evidence:
- invocation carries canonical external AuthorityContext;
- current policy/revocation is checked immediately before dispatch;
- PostgreSQL integration proves revoked and stale-policy authority stop dispatch.

### 5. Exact retry cannot duplicate a side effect — PASS

Evidence:
- consequential Tools require operation-bound idempotency;
- deterministic authority-scope and request fingerprints bind one Operation;
- exact replay reuses durable Operation state and external receipts;
- PostgreSQL acceptance proves a successful replay does not redispatch.

### 6. Ambiguous post-dispatch outcomes reconcile instead of blind retry — PASS

Evidence:
- dispatch exception/unknown and incomplete-dispatch replay transition into
  `unknown/reconciling`;
- reconciliation cases use `safeRetry=false`;
- receipt persistence failure also reconciles rather than optimistically succeeding;
- PostgreSQL fixture proves a durable reconciliation case is created.

### 7. Credentials are referenced, scoped and excluded from public execution data — PENDING FINAL GATE

Implemented on PR #45:
- Provider definitions expose slot metadata only;
- Tool invocation/fingerprints carry canonical CredentialRefId bindings, never plaintext;
- Security resolution request binds tenant, Provider, Operation and slot identity;
- CredentialSecret renders as `[REDACTED]` on string/JSON surfaces;
- PostgreSQL stores encrypted envelopes plus generation/scope metadata;
- plaintext is passed only into an injected cipher and never persisted;
- exact scope is required for resolution;
- generation-CAS rotation and revocation are implemented;
- PostgreSQL integration coverage verifies ciphertext-at-rest, tenant/provider/slot
  isolation, stale-generation rejection, rotation and revocation;
- cipher/KMS failure is redacted to the same safe credential-unavailable surface;
- inaccessible/out-of-scope/decrypt-failed references all fail through a safe
  `credential.unavailable` authorization surface.

Required before PASS:
- exact latest PR #45 head must pass PostgreSQL integration + production build.

### 8. Timeout/rate/cost/readiness failures are typed — PASS

Evidence:
- PR #42 defines typed Provider failure kind/phase/dispatch-certainty contracts;
- post-dispatch failures cannot claim safe not-dispatched certainty;
- timeout, rate-limit, availability, authentication, cost and transport failures map
  to canonical PlatformError categories;
- Provider usage is bounded and normalized;
- implementation head `3de2dcc749409b6be680fa5d7f01e820bd967792` passed
  Foundation CI run 346 and PR #42 merged as
  `be814fee91b8b551b00e2d9900d2970680297b3d`.

### 9. Tool/Provider telemetry has correlation identity without secret data — PASS

Evidence:
- Provider execution telemetry carries Provider, capability, ToolVersion and Operation
  identity plus bounded usage/failure metadata;
- Telemetry's privacy-safe allowlist rejects arbitrary provider keys including
  credential/API-key fields;
- invocation payloads, outputs, receipt bodies, raw exceptions and CredentialRefIds are
  not telemetry fields;
- telemetry sink failure is observational only and cannot change Tool truth;
- PR #42 implementation passed Foundation CI run 346 and is merged.

### 10. Adapters cannot bypass canonical registry/security policy — PASS

Evidence:
- package architecture forbids alternate Tool/Provider ownership;
- consequential execution resolves exact registered Tool/Provider before dispatch;
- credential material is available only through scoped Security resolution;
- PostgreSQL adapters implement canonical ports rather than their own Tool/Provider
  registry;
- repository-wide scan of adapters/runtime, services/gateway, services/worker,
  services/ops and PostgreSQL composition found no concrete external provider SDK
  execution path outside the canonical Tool executor;
- current services expose health/readiness/database composition only, so there is no
  hidden alternate provider runtime to preserve.

Future provider adapters remain required to enter through these same canonical ports.

## Reliability and privacy gates

Already PASS from merged slices:
- tenant-scoped Operation reads/transitions;
- immutable receipt observation identity;
- external receipts precede local settlement;
- unknown/partial states are durable and reconcilable;
- receipt-store failure is not converted into success;
- telemetry sink failure is non-authoritative;
- raw credential decrypt errors are redacted at the Security boundary.

Pending:
- PR #45 exact-head Foundation CI for encrypted credential custody;
- final documentation-head CI after this audit is changed to PASS.

## Closure rule

Do not advance to Skills/Workflows until every matrix item above is PASS and the final
documentation head passes Foundation CI. If PR #45 reveals a real failure, fix the
implementation first; do not weaken these acceptance statements.

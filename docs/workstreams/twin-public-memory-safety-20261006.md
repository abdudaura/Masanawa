# Twin public-memory safety — TWIN-093

Owner/window: ChatGPT continuation window / 2026-10-06
Branch: `work/twin-public-memory-safety-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`
Task: TWIN-093 — protect private owner memory from public Twin responses.
Roadmap references: `docs/TWIN-TRANSFORMATION-TASKS.md`, `docs/TWIN-MULTI-WINDOW-EXECUTION.md`, PR #148 representational-memory handoff.

## Exact owned paths

- `docs/workstreams/twin-public-memory-safety-20261006.md`
- `packages/memory/src/public-twin-context.ts`
- `packages/memory/src/public-twin-context.test.ts`

## Excluded/shared paths

Not owned and must not be edited from this window:

- `services/gateway/src/app.ts`
- `services/gateway/src/main.ts`
- mobile router/chat/transport/APK paths
- production environment/configuration
- migrations and PostgreSQL repository schemas
- `packages/memory/src/index.ts` root export seam unless ownership is explicitly extended
- Identity, Commerce, Billing, Crypto, Workflow and provider-owned paths
- PR #136 production integration paths

## Dependencies

- Existing canonical Memory model, scope predicates and context compiler on current `main`.
- Existing PR #148 / merged-main `representation.ts` public-Twin scope invariant.
- Final Gateway/runtime composition remains with the shared production owner.

## Current state

CLAIMED. No implementation changes have been made beyond this claim.

Implementation target: add a single fail-closed public-Twin context compiler that only accepts the represented Twin's explicit `character-shared` scope, rejects caller-supplied broader predicates/private scopes, validates every candidate before context compilation, preserves canonical Memory provenance, and proves leakage resistance with focused tests.

Last update: 2026-10-06.

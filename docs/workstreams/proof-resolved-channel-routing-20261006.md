# Proof-resolved deterministic channel routing — Production Task 098/100 bridge

Owner/window: ChatGPT continuation window / 2026-10-06
Lease acquired under the merged five-minute stale-claim rule.
Branch: `work/proof-resolved-channel-routing-20261006`
Base: PR #316 head `8bae1c1ec8bfaeb8697e101392e922c13f853e9c`

## Reclaimed stale prerequisite

- PR #310 deterministic proof-resolved channel routing

Its router and focused tests are preserved without rewriting the stale branch.

## Exact owned paths

- `docs/workstreams/proof-resolved-channel-routing-20261006.md`
- `services/gateway/src/channel-routing.ts`
- `services/gateway/src/channel-routing.test.ts`
- `services/gateway/src/channel_resolved_routing.ts`
- `services/gateway/src/channel_resolved_routing.test.ts`

## Explicitly excluded

- shared Gateway router/composition
- webhook transport adapters
- runtime/AgentRun admission
- mobile/APK
- production config/credentials

## Acceptance

- raw provider/channel identifiers never select Character or Relationship;
- proof-backed channel identity resolution must return one canonical User first;
- unlinked/unusable subject fails closed before platform-agent selection;
- deterministic router then uses only explicit User preference or exactly one Tenant default support Character;
- canonical active Relationship is reused/provisioned for that exact User+Character;
- final route preserves binding revision and routing source for downstream evidence;
- cross-Tenant/mismatched identity evidence fails closed.

State: CLAIMED.

Last update: 2026-10-06.

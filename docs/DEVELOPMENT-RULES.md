# Development Rules

## Before coding

1. Read CONTINUE-HERE.
2. Identify active phase.
3. Find or create the relevant Feature Ledger row.
4. Confirm canonical subsystem owner.
5. Read donor evidence listed on the row.
6. Check ADRs.
7. Define/extend contracts and tests before implementation where practical.

## Branching

Do not commit substantial feature work directly to main. Use focused branches and PRs. Foundation bootstrap may establish initial repository state, but normal work is PR-based.

## Source donor policy

- Never copy whole donor directories.
- Never create donor-branded architecture inside Masanawa.
- Adapt behaviors and patterns into canonical contracts.
- Track direct Apache-source adaptations in provenance.
- Treat CyberVerse GPL code as architecture reference by default.

## Code organization

- domain logic belongs in packages;
- transport/orchestration belongs in services;
- presentation belongs in apps;
- external side effects sit behind tools/providers/workflows;
- tests may import internal implementations; production packages must respect dependency boundaries.

## Behavioral preservation

When porting a capability:
- mine source tests;
- record hidden behaviors;
- write Masanawa parity fixtures;
- distinguish behavior parity from code parity.

## Errors

Use typed error classes/codes at boundaries. Do not make workflow decisions by parsing human error strings.

## Configuration

- configuration schema validated at startup;
- no implicit production defaults for secrets/financial providers;
- feature flags are explicit and observable;
- provider selection does not leak into domain entities.

## Data changes

- migration first;
- no manual production schema edits as the canonical process;
- reversible/expand-migrate-contract changes for important production data;
- destructive migrations require explicit review and backup/recovery plan.

## Side effects

No provider action without:
- validated input;
- idempotency plan;
- timeout;
- retry policy;
- reconciliation behavior;
- trace/correlation ID.

## Completion

A feature is not complete until its ledger status/evidence is updated.

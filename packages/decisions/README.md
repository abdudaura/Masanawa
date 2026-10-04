# @masanawa/decisions

Canonical bounded Decision/JEV value contracts.

Use this package to define and validate typed interpretation/classification
questions, bounded provider packets, trace references and closed-set results.

Do not use this package as an authorization, workflow state, payment truth,
provider receipt or side-effect boundary.

## Main helpers

- `createDecisionDefinition` — validates, normalizes and freezes a versioned schema.
- `createDecisionRequest` — bounds and freezes a JSON-like provider packet and trace.
- `assertDecisionRequestMatchesDefinition` — prevents schema/request drift.
- `createDecisionResult` — validates exact answers, ranges, confidence and evidence refs.

See `docs/DECISION-JEV-CONTRACTS.md` for the architecture boundary.

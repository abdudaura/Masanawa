# Workflow Operation truth

Status: Task 093 foundational implementation

## Boundary

Task 093 binds Workflow Tasks to Masanawa's canonical Operation execution truth.

Workflow state does not duplicate provider-side result truth, raw receipt payloads,
or reconciliation state. Those remain owned by the canonical Events/Providers
boundary.

## Binding

A Workflow Task may bind canonical OperationIds by a bounded role:

- `primary`
- `verification`
- `compensation`

Each binding is pinned to:

- Tenant;
- Task;
- WorkflowRun;
- WorkflowVersion;
- exact graph signature;
- canonical OperationId.

A Task/role pair is immutable after admission. Exact replay reconciles to the
existing binding; a changed Operation under the same role is rejected.

The audit `boundAt` timestamp is intentionally excluded from the semantic
binding fingerprint so lost-response replay can reconcile even if the caller
reconstructs a later timestamp.

## Tenant integrity

The PostgreSQL schema validates the Task identity/version/graph binding through
a composite foreign key.

A database trigger additionally verifies that the referenced
`events.operations` row belongs to the same Tenant. Direct SQL therefore
cannot create a cross-Tenant Task↔Operation binding.

## Live projection

`loadWorkflowTaskOperationTruth` reads current canonical truth at query time:

- Operation state from `events.operations`;
- ExternalReceiptIds from `events.external_receipts`;
- active reconciliation status from `events.reconciliation_cases`.

Only receipt IDs are projected into workflow context. Provider payloads, raw
receipts, provider references and reconciliation implementation details are not
copied into workflow tables.

## Deterministic workflow disposition

The package-level projection helper maps canonical truth as follows:

- Operation `succeeded` → `succeeded`;
- Operation `rejected|failed` → `failed`;
- Operation `partial|unknown|reconciling` → `reconciliation-required`;
- active reconciliation `open|checking` → `reconciliation-required`;
- active reconciliation `needs-attention` → `needs-attention`;
- all other non-terminal states → `pending`.

Ambiguous provider outcomes never project as success and are never treated as
automatic retry authority.

## Reconciliation rule

A workflow may observe that an Operation requires reconciliation, but it does
not perform blind provider retry based on that observation.

The canonical provider/reconciliation layer remains responsible for proving
whether a side effect occurred and whether retry is safe.

## Acceptance coverage

Focused PostgreSQL acceptance covers:

- exact Task↔Operation binding;
- replay with a changed audit timestamp;
- changed Operation conflict under the same role;
- live terminal Operation-state projection;
- canonical receipt ID projection;
- ambiguous Operation → reconciliation;
- needs-attention reconciliation projection;
- cross-Tenant Operation binding rejection.

## Completion boundary

Task 093 remains open until PostgreSQL 18 acceptance executes and the canonical
production task evidence advances.

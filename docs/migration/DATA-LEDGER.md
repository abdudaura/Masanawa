# Data Ledger

Inventory semantic state concepts before designing tables.

Do not mirror donor schemas mechanically.

## Required fields

| ID | Concept | Source(s) | Scope | Mutability | Sensitivity | Canonical owner | Migration need | Notes |
|---|---|---|---|---|---|---|---|---|

## Initial canonical concepts

Identity:
- character;
- character identity version/Constitution;
- voice reference;
- appearance/avatar reference;
- character relationship;
- expertise binding.

Interaction:
- platform user;
- channel identity;
- conversation/session;
- turn/message;
- user-character relationship.

Memory/world:
- memory record(type+scope);
- reflection/summary;
- world event;
- life state;
- routine;
- story arc;
- commitment.

Capability:
- capability;
- tool definition/version/readiness;
- skill definition/version/readiness;
- skill dependency;
- character expertise/binding.

Work:
- task/work item;
- workflow instance;
- workflow transition;
- approval;
- idempotency record;
- external attempt/receipt.

Finance:
- quote/order;
- payment;
- ledger entry;
- provider transaction;
- reconciliation;
- refund/chargeback.

Social/studio:
- social account;
- planned post;
- publish attempt/receipt;
- content project;
- script/storyboard/shot;
- render job;
- asset/provenance.

Presence:
- realtime session;
- media endpoint/session metadata;
- avatar session metadata.

Operations:
- platform event;
- audit event;
- trace;
- evaluation;
- provider health;
- incident/needs-attention item.

Phase 0 must map every donor table/file/database concept to one of: canonical concept, derived/cache, provider metadata, legacy-only/retire.

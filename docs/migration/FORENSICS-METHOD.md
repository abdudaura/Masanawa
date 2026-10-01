# Phase 0 Forensics Method

## Objective

Produce a complete normalized inventory without prematurely designing from one donor's folder layout.

## Pass 1 — Source map

For each source:
1. top-level tree;
2. architecture docs;
3. package manifests;
4. database schemas/migrations;
5. configuration/env variables;
6. runtime entry points;
7. tests;
8. external integrations;
9. deployment files;
10. user/admin interfaces.

Record subsystem map before judging relevance.

## Pass 2 — Feature extraction

For each subsystem identify:
- user-visible capabilities;
- internal capabilities;
- lifecycle/state machines;
- failure/recovery behavior;
- permissions;
- scheduled/proactive behavior;
- persistence;
- observability;
- configuration;
- extension points.

Create Feature Ledger rows.

## Pass 3 — Behavior mining

Read tests and edge-case code. Create Behaviour Ledger rows for invariants, failure semantics and subtle UX behavior.

## Pass 4 — Data extraction

Map every durable/derived state concept into DATA-LEDGER. Mark:
- source of truth;
- cache/index;
- transient state;
- secret;
- audit;
- legacy.

## Pass 5 — Integration extraction

Find:
- SDK imports;
- URLs/endpoints;
- env variables;
- webhook handlers;
- provider-specific database columns;
- retry/reconciliation code.

Record INTEGRATION-LEDGER.

## Pass 6 — Security/license extraction

Record:
- trust boundaries;
- auth assumptions;
- sensitive data;
- executable extensions;
- licensing/provenance constraints.

## Pass 7 — Deduplication

Only after all four source-specific inventories exist:
- group equivalent features;
- identify strongest structure;
- identify stronger secondary behavior;
- choose donor roles;
- assign canonical Masanawa destination;
- classify A/B/C.

## Pass 8 — Coverage proof

Use repository searches for major nouns/systems and compare against ledgers. No unclassified production directory, database domain or integration should remain unexplained.

## Parallel-work format

Each analyst should return:
- source revision;
- directories/files inspected;
- feature rows proposed;
- behavior rows proposed;
- data rows proposed;
- integration rows proposed;
- unresolved questions;
- obvious duplicate/conflict candidates.

This format allows multiple sessions to work without losing continuity.

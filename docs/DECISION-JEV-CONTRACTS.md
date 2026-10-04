# Decision / JEV contracts

Status: Task 083 foundational implementation  
Package: `@masanawa/decisions`

## Boundary

JEV is Masanawa's bounded typed decision fabric for repeated interpretation and
classification over explicitly prepared state. It is not a conversational
persona, a source of business truth, a permission engine, or a side-effect
executor.

The contract follows the prior ChatWithStars JEV architecture while moving the
stable boundary into Masanawa. The durable workflow engine remains separately
owned by `packages/workflows`.

## Non-negotiable rule

A Decision/JEV result may recommend or classify. It cannot:

- authorize a Tool, payment, destructive mutation or external communication;
- make an ineligible Character, Skill, Tool or provider eligible;
- replace current-authority checks;
- replace provider receipts, reconciliation or deterministic business truth;
- silently mutate a workflow or AgentRun;
- expose free-form chain-of-thought as a platform contract.

Consequential work must still cross the canonical authorization, approval,
Operation, provider and receipt boundaries.

## Canonical value model

A `DecisionDefinition` owns:

- stable `decisionClass`;
- namespaced `schemaVersion`;
- `low | medium | high` interpretation risk;
- `shadow | active` rollout state;
- one or more typed questions;
- an explicit deterministic fallback.

Question kinds are deliberately closed:

- `choice` — one value from a declared closed set;
- `noul` — a boolean bounded decision;
- `score` — a finite number inside a declared range.

A `DecisionRequest` carries only a bounded JSON-like packet plus canonical
Tenant, request/correlation, optional Task/WorkflowRun and bounded Operation
references. It does not carry authorization as data and does not grant any
capability.

A `DecisionResult` must answer every declared question exactly once, may carry
a calibrated confidence in `[0,1]`, and may include bounded opaque evidence
references.

## Boundedness and deterministic normalization

The package rejects:

- oversized decision classes, instructions, packets, strings, arrays and maps;
- excessive nesting;
- non-finite numbers;
- non-plain object payloads such as Date/class instances;
- malformed class/question keys;
- schema versions not namespaced to their decision class;
- invalid runtime casts for risk or rollout;
- incomplete, additional or out-of-domain answers;
- score values outside the declared range;
- excessive Operation or evidence references.

Object and question keys are normalized with host-independent lexical ordering.
Input collections are copied, deduplicated where appropriate and frozen so later
caller mutation cannot change the admitted decision snapshot.

## Shadow-first use

New decision classes should normally begin in `shadow` mode:

1. define the bounded schema and deterministic fallback;
2. run beside existing deterministic/general-model behavior;
3. capture disagreement and downstream outcome evidence;
4. evaluate accuracy/calibration/latency/cost by schema version and language;
5. explicitly approve activation;
6. retain rollback to fallback.

This package defines values and validation only. Provider invocation, policy
storage, replay telemetry, persistence, evaluation datasets and workflow state
belong to later tasks/owners.

## Task 083 completion boundary

This work implements the persistence-neutral typed value boundary for Task 083.
It does **not** by itself complete Task 083. Completion still requires the
canonical production task owner to integrate the package into the repository's
verification path, resolve the shared lockfile importer, run required checks,
and advance the canonical task record with evidence.

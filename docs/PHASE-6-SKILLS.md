# Phase 6 — Skills

Status: ACTIVE  
Started: 2026-10-02  
Current production task: **070 — Skills acceptance**
Task 069 implementation PR: #74, merged; closure branch: `task069-close`

Phase 5 Tools and Providers is closed by PR #45, merge
`0fe123e18a9163386c4ab10331139265ce26b64e`.
Credential-custody implementation head
`7d53562fe29f5aae6a3e69c495757ce22658df3a` passed Foundation CI run 365,
the final Phase 5 documentation head
`b6e5e1cdfddc9c7c9f2da8411c58c8f03c4785d4` passed run 368, and merged-main
run 369 passed the complete Foundation CI gate.

## Canonical ownership

- `packages/skills` is the sole canonical Skill/SkillVersion authority.
- `packages/tools` remains the atomic execution authority; Skills compose Tools and
  subskills but do not bypass Tool security/idempotency/reconciliation.
- `packages/security` remains the authority/approval owner.
- `packages/workflows` is Phase 8 durable multi-step business state and is not pulled
  forward into the Phase 6 foundation merely to implement Skills.
- source Markdown/files/repositories are authoring/import formats and candidate
  evidence, never production truth.
- production SkillVersion state is versioned/certified canonical state.

## Donor boundary

Primary structural donor: OpenJarvis.

Adopt:
- manifest/normalization discipline;
- catalog/manager;
- exact dependency/subskill graph;
- SkillTool adapter later in Phase 6;
- provenance/trust metadata;
- invalid/cyclic skill isolation;
- trace metadata;
- optimization overlays only as non-authoritative candidates.

OpenClaw contributes:
- immutable managed revisions;
- content-derived revision evidence;
- deterministic source precedence for import candidates;
- visibility and exact revision pinning;
- stale-edit conflict behavior.

Microsoft Agent Framework contributes:
- progressive disclosure;
- composable skill sources;
- safe resource/script boundaries and traversal defense;
- interoperability concepts.

ChatWithStars contributes:
- certification/readiness;
- activation and negative examples;
- risk/approval/pricing/idempotency/reconciliation policy;
- Character expertise binds certified SkillVersions only.

Reject:
- filesystem discovery order as production truth;
- donor runtime ownership;
- imported skill activation without certification;
- implicit latest-version selection where reproducibility matters;
- skill text/model intent as authorization;
- workflows hidden inside conversational skill state.

## Task 059 — canonical Skill / SkillVersion schema

The preserved pre-roadmap foundation was reconciled rather than merged wholesale. Task 059 separates stable logical `Skill` identity (`SkillId`, key, creation time) from immutable normalized `SkillVersion` content (`SkillVersionId`, exact version, activation/governance/schema/provenance/certification fields). Version-owned nested content is frozen after canonical normalization. The preserved dependency-aware registry remains useful groundwork for later Skills tasks but does not make Tasks 060-070 complete.


## Task 060 — Skill manifest validation and import format

Task 060 introduces a versioned native manifest validated with the repository's TypeBox stack and a bounded `SKILL.md` compatibility importer. Source files remain untrusted authoring evidence: successful import produces a quarantined candidate with deterministic content fingerprint and provenance, not a canonical/certified SkillVersion. Resource paths are relative-POSIX and traversal-safe; scripts are skipped by default and require explicit import opt-in, which still does not authorize execution. Capability/Tool requirement semantics remain Task 061 and dependency-graph semantics remain Task 062.

## Task 061 — capability requirements and Tool references

SkillVersions now declare provider-neutral required Tool capabilities and explicit named Tool references. A reference may remain capability-bound for runtime selection or pin an exact immutable `ToolVersionId`; it never pins a Provider. Normalization requires every Tool reference capability to be declared and every declared Tool requirement to have a reference. Resolution is fail-closed against the canonical Tool registry when capabilities are unknown, no matching ToolVersion exists, or an exact ToolVersion pin does not provide the declared capability. Provider selection remains owned by the Tool/Provider runtime boundary.

## Task 062 — Skill dependency graph and conflict validation

The canonical Skill registry validates exact immutable SkillVersion dependency graphs before mutating registry state. Batch registration is order-independent and atomic: missing dependencies, cycles, configured depth overflow, duplicate identity/version bindings and logical Skill identity conflicts all fail closed without partially activating the batch. Logical Skill keys and stable `SkillId` values are one-to-one across versions, preventing a key from silently changing identity or an identity from changing keys. Exact replay of an unchanged SkillVersion remains idempotent.

## Task 063 — Skill execution planning and composition

The Skills package now composes a deterministic immutable execution-plan snapshot from the canonical registry. Planning reuses the already-validated exact SkillVersion DAG: dependencies appear before dependants, shared dependencies are included once, the requested root is last, and every direct dependency is represented by an earlier step ordinal. Planning is fail-closed on readiness for the root and every exact dependency, while ready model-hidden SkillVersions may participate as dependencies without becoming advertised. The plan aggregates required Tool capabilities but does not select Providers or execute Tool/subskill calls; those remain later execution-boundary work.

## Task 064 — SkillTool and subskill execution boundaries

The Skills package now exposes fail-closed execution bindings rather than a second execution engine. A Skill step may bind only a Tool reference declared by its exact SkillVersion; capability-bound references must resolve to an exact registered ToolVersion at execution time, exact pins cannot be overridden, and the resulting canonical ToolInvocation deliberately carries no Provider selection so authorization/idempotency/provider handling remain owned by packages/tools. Subskill calls may target only exact direct SkillVersion dependencies represented by earlier steps in the already-validated execution plan; arbitrary, sibling, unrelated or transitive bypass dispatch is rejected. Authority context is propagated unchanged and boundary inputs are canonical immutable JSON.

## Task 065 — Skill provenance, trust and publisher metadata

Canonical Skill provenance now preserves exact source-system/reference/revision/content-hash evidence together with normalized publisher identity and a separately attributed trust verdict. Imported Skills require an exact source revision rather than an implicit latest/unknown source. Publisher metadata records a stable publisher key, display name, publisher kind and optional evidence reference. Trust verdicts record tier, evaluator, evaluation time and normalized reason codes; they are descriptive admission evidence only and do not grant Tool, Provider, authority or subskill execution rights. Imported bundles carry this metadata into quarantine unchanged in meaning and normalize it before candidate publication.

## Task 066 — risk and capability classification

Skill classification is now an enforceable envelope over canonical Tool requirements, not a parallel risk taxonomy. The classifier publishes immutable provided/required Tool/required authority capability sets together with Skill risk, side-effect and sensitivity classifications. Every ToolVersion that a declared Skill Tool reference may resolve to must fit inside that envelope: Tool risk cannot exceed Skill risk, Tool side effects cannot exceed the Skill side-effect class, Tool sensitivity cannot exceed Skill sensitivity, and every Tool authority capability must be explicitly surfaced by the Skill. Classification remains Provider-neutral and records exact candidate ToolVersion identities only.

## Task 067 — rehearsal and certification evidence

Canonical Skill certification now carries immutable rehearsal evidence rather than trusting summary counters alone. Each certification is bound to the exact `SkillVersionId`, an exact suite key/revision/content hash, certifier and certification time. Every rehearsal case has a stable case key, bounded category, pass/fail outcome, observation time and content hash/reference. Canonical certification fails closed unless case identities are unique, evidence predates certification, counters exactly match the evidence, every case passes, and both positive activation and negative-activation coverage are present. This is admission evidence only: it does not grant authority, select Providers, execute Tools or create Workflow state. Trace/run linkage remains Task 069.

## Task 068 — readiness, eligibility and exact revision pinning

Skill readiness is now compiled into an explicit exact-graph eligibility snapshot rather than inferred only when execution fails. Eligibility walks the exact immutable SkillVersion dependency graph and reports missing version/readiness or non-ready dependency blockers; model visibility and advertisement remain separate from execution eligibility. A Skill revision pin captures the exact root and dependency SkillVersion IDs, logical key/version values and content-derived definition hashes in dependency-first order. Resolving a pin verifies its own content hash and every exact definition, rejects graph drift, never substitutes a newer logical Skill revision, and rechecks current readiness rather than freezing operational state into the pin. Pins remain Provider-neutral and contain no authority, credential or workflow state.

## Task 069 — trace metadata and deterministic failure semantics

Skill execution now exposes deterministic privacy-bounded trace descriptors over the exact execution plan. Trace metadata identifies the root SkillVersion, exact step SkillVersion, ordinal, trace kind, content-derived plan hash and only the relevant exact Tool/subskill reference identity; it contains no Provider choice, prompts or arbitrary payloads. The platform telemetry allowlist admits these bounded Skill tags without making `packages/skills` depend on telemetry.

Skill failures are normalized into immutable deterministic evidence. Existing typed `PlatformError` code/category/retryability, correlation and Operation identity are preserved, ambiguous outcomes deterministically require reconciliation, retryable typed failures retain retry disposition, and non-retryable failures are terminal. Unknown exceptions are collapsed behind stable source-specific internal codes/messages so raw exception text does not leak. Tool/provider failure truth remains owned by its existing boundary and Skills do not invent a second retry/reconciliation engine.

Trace admission validates exact canonical IDs, bounded reference keys, content-hash format, step ordinal and kind-specific field combinations. Failure evidence copies and freezes only the admitted trace fields, so caller mutation and extra private payload fields cannot alter or contaminate a recorded failure. Ambiguity takes precedence over retry disposition even when a typed upstream failure is marked retryable.

## Task 069 merged acceptance

Task 069 implementation head `83ed96c693a307fb9fcebac7a593df680d8e1273` passed Foundation CI run 445 (328 tests). PR #74 merged as `1dd2363847c70a81ec1839377921bb461804db1e`; merged-main Foundation CI run 446 passed on that exact merge commit.

Local focused verification passed 84 Skills/telemetry tests, 37 Contracts/Tools/Providers tests and strict Skills/telemetry typechecks. Phase 6 remains active: Task 070 must add canonical persistence/restart and cross-package cloud/device Provider-neutrality evidence before closure.

## First canonical slice

Goal: establish the production SkillVersion identity/catalog/governance boundary before
parser/import/executor work.

Planned invariants:
- `SkillId` is stable logical identity and `SkillVersionId` is exact immutable
  certified revision identity;
- production registration requires certification evidence and positive + negative
  activation examples;
- definitions declare capabilities, exact SkillVersion dependencies, required Tool
  capabilities, schemas, authority requirements, risk/side-effect/sensitivity,
  billing/confirmation, idempotency/reconciliation and provenance/trust;
- consequential Skills inherit operation-bound idempotency/reconciliation constraints;
- user-billed Skills require explicit confirmation policy;
- registration is exact-replay idempotent and identity conflicts fail closed;
- batch registration validates the full dependency graph atomically, so missing/cyclic
  dependencies cannot partially activate healthy state;
- dependency depth is bounded;
- readiness/blocked/disabled state is mutable operational state separate from immutable
  SkillVersion content;
- model-hidden Skills may be exact dependencies but are never advertised to the model;
- advertised/executable Skills require ready dependencies;
- no implicit latest-version resolver exists in this slice.

Acceptance before moving deeper into Phase 6:
- strict TypeScript/unit/architecture/build gate;
- graph cycle/missing/depth/conflict tests;
- certification/governance tests;
- readiness/dependency eligibility tests;
- PostgreSQL-backed canonical Skill/SkillVersion persistence before source import is
  considered production-capable.

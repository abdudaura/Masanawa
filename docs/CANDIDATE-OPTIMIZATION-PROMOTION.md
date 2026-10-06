# Candidate optimization and promotion gates

Status: Production Task 143 isolated implementation.

## Purpose

Task 142 provides versioned evaluation datasets and baseline-vs-candidate regression
classification. Task 143 adds the learning/optimization lifecycle **without** allowing
evaluated candidates to silently change production behavior.

A candidate may describe a prospective change to:
- prompt;
- policy;
- configuration;
- Skill guide;
- routing.

The candidate record contains only stable target/version metadata and an immutable SHA-256
content hash. Raw private prompt/configuration payloads do not belong in this telemetry
record.

## Lifecycle

`proposed -> evaluated -> approved -> promoted`

or any non-terminal state may be explicitly rejected.

Every transition uses an expected revision. Stale writers fail closed.

### Proposed

A proposal records:
- candidate key;
- artifact kind;
- target key;
- base version;
- candidate version;
- content hash;
- proposal time.

It has no evaluation or approval authority.

### Evaluated

`evaluateOptimizationCandidate()` consumes Task-142 baseline and candidate evaluation
runs using the **same dataset key/version and case set**.

Default promotion gate:
- zero newly regressing cases;
- candidate dataset must fully pass;
- no minimum recovery count.

A stricter or explicitly bounded policy may require recoveries or tolerate a configured
number of regressions, but all thresholds are explicit evidence.

Evaluation alone never approves or promotes the candidate.

### Approved

`approveOptimizationCandidate()` requires:
- a passed promotion gate;
- exact current candidate revision;
- canonical AuthorityContext evidence;
- approval timestamp after evaluation;
- approval bound to the exact candidate content hash;
- approval bound to the exact evaluation dataset key/version.

This keeps model-generated/evaluator-generated output from approving itself.

### Promoted

`promoteOptimizationCandidate()` accepts only an already approved candidate and returns:
- terminal promoted candidate state;
- `CandidatePromotionRecord` with artifact identity/hash;
- evaluation evidence key;
- approval key and approving AuthorityContext;
- promotion timestamp.

The function **does not apply the artifact** to Agent, Workflow, Skill, Provider, routing,
policy or production configuration. A separate governed deployment/runtime owner must
consume the promotion record.

## Rejection

Candidates may be explicitly rejected with a bounded resolution note.
Promoted/rejected candidates are terminal for this lifecycle.

## No-silent-learning rule

There is no API in this module that:
- rewrites prompts;
- updates production configuration;
- changes Skills/Tools/Providers;
- modifies routing;
- mutates model weights;
- publishes candidate payloads;
- grants approval automatically.

Task 144 acceptance should prove that this separation remains intact when Plugins and
runtime composition are integrated.

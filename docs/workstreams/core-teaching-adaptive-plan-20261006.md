# Core Teaching adaptive lesson proposal — 2026-10-06

Status: active reclaimed Teaching slice
Owner/window: ChatGPT continuation window
Branch: `work/core-teaching-adaptive-plan-20261006`
Base: stale PR #96 head `41370298c0bf1e35d864cb70f8ae064b352e276d`
Task references: Core Teaching requirement in `CONTINUE-HERE.md` and `docs/SKILL-DESIGN.md`.

## Reclaimed context

PRs #94/#96/#205/#215/#220 were stale under the repository five-minute lease rule.
This branch preserves the full #96 Teaching runtime stack and continues only a missing
package-level capability. It does not overwrite those stale branches.

## Exact owned paths

- `packages/skills/src/teaching-plan.ts` (new)
- `packages/skills/src/teaching-plan.test.ts` (new)
- `packages/skills/src/index.ts` (single export only)
- `docs/CORE-TEACHING-ADAPTIVE-PLAN.md` (new)
- `docs/workstreams/core-teaching-adaptive-plan-20261006.md`

## Boundaries

- no Gateway/app/main/mobile/channel/payment/memory/migration/deployment edits;
- no second Teaching runtime or persistence authority;
- plan proposal remains provider-neutral and does not grant evidence/tool authority;
- final lesson plans must still pass existing `normalizeTeachingLessonPlan()`.

## Goal

Add a canonical bounded intake/proposal contract so Core Teaching can establish or infer
topic, learner level, goals, language/accessibility preferences and propose a short
adaptive sequence without forcing a lengthy questionnaire.

Current step: implement contract + deterministic validation + tests, then hand off to the
existing Teaching runtime owner for model/provider composition.


## Implementation checkpoint

Implemented on draft PR #297:

- confidence-gated explicit/inferred learner intake;
- explicit input precedence over inference;
- one direct clarification when the essential topic is still unknown;
- transparent defaults for non-blocking goal/language/modality fields;
- bounded, identity-free adaptive sequence proposal normalization;
- provider-neutral planner coordinator with an admitted maximum step count;
- proposal providers receive allowed resource keys only, not raw resource evidence;
- final materialization reuses canonical `normalizeTeachingLessonPlan()` and rejects
  unknown resource keys or unresolved intake;
- focused tests cover minimal intake, explicit-over-inferred precedence, low-confidence
  clarification, invalid inference confidence, duplicate/oversized proposals, final
  canonical materialization, provider-call suppression during clarification, maximum-step
  enforcement and resource-authority rejection.

Verification:
- PR #297 is mergeable.
- GitHub Foundation CI still terminates before producing a downloadable job log, matching
  the repository-wide runner failure. No test pass is fabricated.

Remaining integration:
- admitted Teaching runtime supplies the proposal provider/model;
- actual app/WhatsApp/Telegram/voice rehearsal remains with their owning integration lanes.

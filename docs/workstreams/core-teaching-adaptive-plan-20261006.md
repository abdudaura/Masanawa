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

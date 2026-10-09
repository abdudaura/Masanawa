# U06 — Teaching depth and lesson continuity (claim + handoff)

**Status:** CLAIMED / PARTIAL_IMPLEMENTATION, 2026-10-09 ~01:10 Africa/Lagos (UTC+01:00). Exclusive five-minute source lease renewed by commits. Branch `work/u06-teaching-continuity-20261009-gpt6`; base `main` SHA `5e758673ae91082520b21b3153da53791ae2cbf3`.

## Selection and exact ownership

Live U06 branch/PR search returned no existing work; U01–U05, U21–U30, F11 and numerous R/C recovery PRs are already represented. Preserve existing `services/gateway/src/agent_teaching_assistant.ts` (and its tests). Own only:
- `packages/skills/src/teaching_extensions/**` (lesson engine/contract, tests)
- `apps/mobile/lib/src/learning/**` (learning presentation/state)
- `apps/mobile/test/learning/**` (bounded Flutter tests)
- `services/gateway/src/operator_learning/**` (isolated authenticated route adapter and tests)
- `packages/skills/src/index.ts` (single additive export only)
- this claim/handoff file.

No edits to shared `main.ts`, `app.ts`, router, Android/iOS native, Firebase, financial ledger, migration registry, canonical agents, legacy teaching assistant, or other claimed U/R/C roots. Existing `@masanawa/skills` and Gateway teacher are normative dependencies, not targets for replacement. **Integration will require designated Gateway/Flutter composer**; isolated work is PARTIAL_IMPLEMENTATION until composed and exercised end-to-end.

## Intended complete bounded slice

Typed server-authoritative lesson state and checkpoint validation with scoped learner and session; explicit topic, goal, language, level, worked examples, exercises, answer feedback and next-step progression; restart/account-switch-safe Flutter readback/presentation. Error handling, malformed model results, replay and unauthorized state changes must fail closed. Reuse canonical U01 versioned operator action where available.

## Live review / next evidence

Review U06 exact requirements in `docs/20-WINDOW-AI-CHAT-EXECUTION-20261008.md`, `docs/AI-OPERATOR-ACTION-AND-TASK-CONTRACT-V1-20261008.md`, `docs/MULTI-WINDOW-WORK.md`, current `agent_teaching_assistant.ts`, package exports/build/tests before implementation. Update this file with changed source, tests executed, blockers, branch SHA and PR link before handoff. No merging, destructive edits or production calls.

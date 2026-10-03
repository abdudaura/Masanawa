# @masanawa/agents — canonical runtime boundary

Task 071 introduces the CharacterSession contract, authorized repository port and
Agents-owned PostgreSQL migration. Concrete storage stays in
`adapters/storage/postgres`; Gateway/Presence/Worker compose the public port.

A session is bounded User–Character continuity inside one tenant and private
Relationship. Character, CharacterVersion and Relationship truth remain Identity-owned.
Channel and Presence session IDs are replaceable projections. Exact SkillVersion
references retain selection without granting execution or freezing readiness.

`CharacterSessionRepository` exposes create/read/updateBindings/close/reset. Every
operation requires current authority and exact relationship scope. No unscoped catalog
or private transcript API exists. Reset atomically closes the prior session and admits
its successor with the same relationship and task/workflow/skill references; it clears
transport bindings. Expiry blocks continuation but preserves history. Clients must use
`isCharacterSessionOpen` before treating a record as active continuity.

See `docs/PHASE-7-AGENT-RUNTIME.md` for the persistence, lifecycle, authorization and
acceptance contract. AgentRun, strategies, context compilation and run fencing are
later Tasks 072–082. No donor kernel is a production dependency.

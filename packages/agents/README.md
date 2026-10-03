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


## Admin-configured mobile agents

The mobile product direction adds two independent Agents-owned configuration
records around existing Identity/Skills truth:

- `AgentPresentation` controls role label, about/greeting, user-app visibility
  and ordering for an existing exact CharacterVersion.
- `CharacterSkillAssignment` selects exact SkillVersion references for a
  Character independently of presentation.

A Character display name is still Constitution/CharacterVersion identity and is
changed through the Identity publication lifecycle, not by copying the name into
Agents. A role label is presentation only and never grants a Skill. A Skill
assignment is selection metadata only; runtime admission must revalidate current
Skill readiness/certification and Security authority.

PostgreSQL stores these separately in
`agents.agent_presentations` and `agents.character_skill_assignments`.
Concrete adapters use revision CAS so presentation and capability selection can
change independently without lost updates.

See `docs/MOBILE-AGENT-EXPERIENCE.md`.

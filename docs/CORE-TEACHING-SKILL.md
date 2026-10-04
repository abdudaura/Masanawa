# Core Teaching Skill contract

Status: implementation slice on the `skills-clones` workstream.

## Purpose

Core Teaching is one canonical Skill capability for eligible Characters. It supports
broad-topic adaptive teaching while preserving the existing Skills, Identity,
Relationship, Memory and Workflow authorities. It is not a second education runtime.

This slice defines the transport-neutral domain contracts needed by later runtime and
channel integration:

- Relationship-scoped learner context: topic, level, goals, language, accessibility
  preferences and text/voice modality;
- adaptive lesson sequences with manageable steps, examples, worked solutions and
  exercises;
- exact resource evidence with immutable content hashes and checked timestamps;
- practice/formative answer evaluation with misconception and alternative-explanation
  feedback;
- bounded progress handoff containing checkpoint, demonstrated understanding,
  misconceptions and next steps.

## Boundaries

The contract intentionally does **not** persist progress. A later integration owner must
write authorized progress through canonical Relationship-scoped Memory and/or durable
Workflow custody. Channel adapters must project the same contract into app, WhatsApp and
Telegram; no channel receives a separate teaching state machine.

Core Teaching cannot label its own formative result as verified certification.
Certification requires a separately authorized, certified assessment workflow.

A lesson resource reference is evidence, not authority. Current/specialist claims still
require the appropriate evidence-capable Tool/Skill path and explicit uncertainty when
evidence is insufficient.

## Next integration steps

1. Author and certify the exact Core Teaching SkillVersion + SkillGuide and subject
   resource/subskill revisions.
2. Bind runtime lesson execution to current Character Skill assignment/readiness and
   exact SkillVersion pins.
3. Persist progress through canonical private Relationship Memory/Workflow boundaries.
4. Render exercises/options through the server-owned chat-action contract.
5. Rehearse language switching, misconception correction, failed understanding,
   continuity, evidence uncertainty and privacy across app/WhatsApp/Telegram.

None of those integrations or production readiness is claimed by this domain slice.

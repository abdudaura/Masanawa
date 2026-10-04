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


## Canonical authoring bundle

`createCoreTeachingSkillBundle` now produces the exact canonical pair used by later
runtime admission:

- one `SkillVersion` with key `core.teaching`, capability `teaching.core`,
  private sensitivity, no billing, no hidden Tool/Provider/Offer authority, and an exact
  immutable `SkillVersionId`;
- one `SkillGuide` bound to that same exact `SkillVersionId`, with trigger-only
  discovery metadata and progressively disclosed teaching instructions/resources.

The factory accepts provenance and certification rather than inventing them. It fails
closed unless certification includes passed teaching-specific rehearsal evidence for:

- teaching activation and non-teaching rejection;
- language switching without losing lesson continuity;
- misconception correction;
- failed-understanding recovery;
- Relationship-scoped continuity;
- source/evidence uncertainty;
- Relationship privacy boundaries.

This makes the required teaching behaviors part of exact-version production admission
evidence instead of leaving them as prose-only aspirations.

Subject references remain optional Guide resources or future exact-version subskills.
Core Teaching itself intentionally declares no Tool dependency: current/specialist
claims must enter through an independently admitted evidence-capable Tool/Skill path
when needed rather than receiving implicit authority from teaching.


## Selectable exercises and subject disclosure

Teaching now has a transport-neutral selectable exercise card contract for free-response,
single-select and multi-select practice. Selectable cards require stable option keys but
intentionally contain no correct-answer field; correctness remains server/runtime
evaluation truth rather than something exposed to the client surface.

Subject material references are also explicit and mutually exclusive:
- a reviewed Guide resource uses a validated relative resource path; or
- a subject subskill uses one exact `SkillVersionId`.

These references do not grant execution permission. A later runtime owner must resolve
the exact subskill through canonical assignment/readiness/dependency admission before
execution. The same exercise projection can then be rendered by app, WhatsApp or Telegram
without channel-specific teaching logic.

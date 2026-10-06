# Core Teaching adaptive lesson proposal

Status: package-level implementation on PR #297.

## Why this exists

Core Teaching already had canonical lesson, exercise, progress, evidence and cross-channel
runtime contracts, but the runtime still expected a finished `TeachingLessonPlan` from
its caller. The product requirement says Teaching should establish or infer the learner's
topic, level, goals, language and accessibility needs and begin a useful adaptive lesson
without forcing a lengthy questionnaire.

This slice adds the missing provider-neutral planning boundary without creating another
education runtime.

## Contract

`resolveTeachingAdaptiveIntake()` combines explicit learner input with optional inferred
candidates.

Rules:

- explicit learner input always wins over inference;
- inferred values carry a bounded 0..1 confidence;
- inference below the policy threshold is not silently trusted;
- topic is the only blocking essential for the first useful lesson;
- when topic is missing or uncertain, the contract asks one direct clarification instead
  of collecting a long intake form;
- level may remain `unspecified`;
- a missing goal becomes a transparent default goal rather than another mandatory question;
- language defaults to `en` only when neither explicit nor confident inferred language
  exists, and the assumption remains visible to the runtime;
- text is the default presentation modality; voice is preserved when explicitly/inferred;
- assumptions are retained so the lesson/runtime can correct them conversationally.

`normalizeTeachingSequenceProposal()` validates a short proposed sequence independently
of identity and resource availability. It limits the first adaptive sequence to 24 steps,
requires unique stable step keys and applies the existing Teaching field bounds.

`materializeTeachingLessonPlan()` is the authority boundary. It refuses unresolved intake,
adds real SkillVersion/resource evidence, carries proposal uncertainty + intake assumptions
and finally calls the existing canonical `normalizeTeachingLessonPlan()`. Therefore a
proposal cannot bypass exact Relationship, SkillVersion, resource-provenance or final-plan
validation.

## Ownership boundary

The contract does not call an LLM/provider, search the web, persist learner state or choose
Tools. The existing admitted Teaching runtime may ask its provider to propose a sequence,
then pass that proposal through this contract. Current/specialist claims still use the
existing `TeachingEvidencePort`.

No Gateway/mobile/channel composition is claimed by this slice.


## Planner orchestration

`createTeachingAdaptivePlanner()` is the provider-neutral orchestration seam. It:

1. resolves the bounded intake;
2. returns clarification immediately when the topic is still unknown;
3. invokes the proposal provider only after intake is ready;
4. supplies only learner context, assumptions, a maximum-step bound and allowed resource
   keys — never raw resource references/evidence or provider credentials;
5. rejects a provider sequence that exceeds the admitted bound;
6. materializes the final plan through canonical resource and lesson validation.

The proposal provider therefore cannot mint resource authority. It may only cite resource
keys that the caller already supplied, and final plan normalization rejects unknown keys.

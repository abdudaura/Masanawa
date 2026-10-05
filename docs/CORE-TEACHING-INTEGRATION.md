# Core Teaching integration contract

Status: stacked integration slice over Core Teaching PR #94.

## Goal

Wire Core Teaching into Masanawa's existing runtime, persistence and presentation
authorities without creating a Teaching-specific Gateway, memory store, workflow engine,
channel protocol or client action system.

The integration owner is `TeachingRuntimeCoordinator` in `@masanawa/skills`. It is a
provider-neutral orchestration seam, not a new durable authority.

## Runtime flow

1. Runtime admits the exact Core Teaching SkillVersion through the existing Character
   assignment/readiness/AgentRun checks.
2. Runtime supplies an exact `TeachingLessonPlan` bound to the active Relationship and
   SkillVersion.
3. `resume()` asks `TeachingProgressPort` for durable progress using only that
   Relationship + SkillVersion key.
4. With no progress, the coordinator projects the first lesson step.
5. With progress, deterministic Teaching continuity chooses continue, reteach, advance
   or sequence-complete.
6. A selectable exercise is projected through `presentExercise()`; client-safe cards
   never contain the answer rubric.
7. A returned selection is evaluated against the server-side rubric.
8. Before feedback is published, `commitSelectionAttempt()` must atomically persist the
   exact selection attempt and resulting progress.
9. The caller-provided canonical `RequestId` is the replay identity. Persistence must
   return `replay` for an identical repeat and reject changed payload under the same ID.
10. Only after persistence succeeds does the coordinator return/publish authoritative
    feedback and the next continuation decision.

## Owner wiring

### PR #89 — Agent runtime/Gateway/mobile controller

Compose the coordinator only after existing Skill admission has established:
- active Character/Relationship/session/run scope;
- exact assigned SkillVersion;
- current readiness/certification;
- current authority and runtime limits.

The runtime owner supplies the durable `TeachingProgressPort` adapter. Its implementation
must write through canonical private Relationship Memory and/or Workflow custody rather
than a new education table unless a later ADR explicitly assigns such storage.

Do not trust client RelationshipId, SkillVersionId, lessonStepKey, exerciseKey or
RequestId without resolving them from the authenticated server session/action binding.

### PR #91 — chat shell/actions

Map `TeachingRuntimeProjection` to the existing server-authored ShellDocument model:
- `lesson-step` -> text/detail/progress content;
- `exercise` -> existing options/form components with opaque authenticated actions;
- `feedback` -> notice/detail/progress plus the next lesson projection.

The answer rubric remains server-side. Never serialize `correctOptionKeys` into the
ShellDocument or native encrypted action journal.

The existing ShellAction idempotency/reconciliation protocol remains canonical. The
Teaching `RequestId` must be derived/bound server-side from that confirmed action and
remain stable across retry/restart.

### PR #92 — WhatsApp and Telegram

Inbound option/button data remains untrusted opaque selection evidence. Gateway/runtime
must resolve it to the authenticated Teaching exercise binding before calling
`submitSelection()`.

WhatsApp/Telegram must not persist channel-local lesson truth. The same Relationship
progress is loaded when the user continues from app, WhatsApp or Telegram after verified
account linking.

Outbound text/audio/options are channel projections of the same Teaching runtime result;
channel delivery receipts are transport evidence, not proof of learner understanding.

## Replay and uncertain outcomes

A network timeout after `commitSelectionAttempt()` may leave the caller uncertain even
though progress was stored. The caller must retry with the same canonical RequestId.
The persistence adapter reconciles it as `replay`; it must never create a second attempt
or advance twice.

Changed selection payload under an already-used RequestId is a conflict and must fail
closed.

## Privacy

Learning progress is Relationship-private. Cross-Relationship resume, rubric submission
or persistence is rejected. Channel identity linking does not upgrade transport evidence
into memory authority.

## Still outside this slice

- actual PostgreSQL/Memory/Workflow adapter implementation in #89-owned paths;
- Gateway route/controller composition;
- ShellDocument renderer/controller binding in #91-owned paths;
- WhatsApp/Telegram outbound delivery or webhook composition in #92-owned paths;
- real app/WhatsApp/Telegram/voice rehearsal evidence;
- deployment.

Those owners received coordination comments from PR #96. This branch does not overwrite
their active work.


## Stable replay fingerprint

`fingerprintTeachingSelectionAttempt()` produces a canonical SHA-256 fingerprint over:
RelationshipId, exact SkillVersionId, lesson step, exercise and the normalized selected
option set. Multi-select order is normalized before hashing.

The durable progress adapter must persist `requestId + payloadHash` together. A retry
with the same RequestId and hash is an exact replay; a different hash under that RequestId
is a conflict. Receipt time is deliberately not part of the fingerprint, so a lost
response may be retried later without turning the same learner action into a second
attempt.


## Runtime admission binding

The coordinator now requires a `TeachingRuntimeBinding` on resume, exercise projection
and selection submission. The binding is created only from server-resolved values after
the outer runtime has admitted the capability and contains:
- exact RelationshipId;
- exact SkillVersionId;
- canonical skill key `core.teaching`;
- exact certified SkillGuide content hash.

The coordinator rejects plans, exercises and rubrics that do not match that admitted
Relationship/SkillVersion. This does not replace #89 readiness/authority admission; it
makes its result explicit at the Teaching integration boundary so a caller cannot
accidentally invoke Teaching with an arbitrary SkillVersion or another user's
Relationship.


## Evidence-capable teaching claims

`TeachingEvidencePort` is the explicit seam for current, specialist or source-dependent
teaching claims. Core Teaching never chooses a provider or grants Tool authority.

Behavior:
- the request is exact Relationship + SkillVersion + lesson-step scoped;
- without a configured evidence resolver, the coordinator returns
  `status: insufficient` with an explicit uncertainty note;
- `status: verified` requires at least one bounded evidence record with exact SHA-256
  content hash and checked timestamp;
- malformed evidence or "verified" with no evidence is rejected;
- cross-Relationship/Skill evidence requests fail before resolver use.

The #89 runtime owner should implement this port by invoking its already-admitted
evidence-capable Tool/Skill path after current authority/readiness checks. Search/provider
credentials must never enter Teaching domain objects.


## Opaque Teaching action binding

Selectable Teaching exercises now have an explicit server-owned action binding.

The server binding contains:
- opaque `actionKey`;
- canonical `RequestId`;
- exact RelationshipId + SkillVersionId;
- exact lesson step + exercise;
- hidden normalized rubric;
- expiry;
- deterministic binding hash over that server-side payload.

The client-visible exercise projection contains only the safe exercise card and opaque
`actionKey`. It never receives the rubric, correct option keys, RelationshipId selection
authority, SkillVersion selection authority or RequestId construction authority.

Before a selectable card is published, `presentBoundExercise()` verifies that:
- the card and action binding have identical Relationship/Skill/lesson/exercise scope;
- visible exercise kind matches the hidden rubric kind;
- visible option keys exactly equal the rubric's allowed option set;
- the server-side binding payload still matches its stored binding hash.

When a selection returns, the client supplies only `actionKey + selectedOptionKeys`.
`resolveTeachingOpaqueSelection()` reconstructs the full scoped submission from the
server binding, rejects action swapping, rejects expiry, rejects binding tampering and
then uses the binding's canonical RequestId for replay-safe persistence.

The binding hash is an integrity fingerprint for server-held state, not a bearer
credential or client-authentication mechanism. #91/#92 must keep the full binding
server-side and expose only the opaque action key.


## Durable lesson-plan identity

Durable learner progress is now bound to a deterministic `planHash`.

The hash intentionally covers pedagogical identity:
- exact RelationshipId + SkillVersionId;
- topic, level and learner goals;
- sequence title;
- normalized lesson steps;
- reviewed resource evidence;
- uncertainty notes.

Presentation preferences are deliberately excluded:
- language;
- accessibility presentation preferences;
- text/voice modality.

This means a learner may switch English -> Hausa or text -> voice without resetting
progress, while a silently regenerated curriculum/step sequence under the same
Relationship + SkillVersion is rejected on resume.

Every persisted selection attempt carries the exact `planHash`. A
`TeachingProgressPort.load()` result must return both that hash and the durable
progress handoff. Resume fails closed when the supplied plan does not match the
persisted pedagogical plan.


## Direct bridge from canonical Skill admission

`createTeachingRuntimeBindingFromAdmission()` accepts the minimal immutable shape of
#89's prepared Skill admission evidence: a revision pin with exact root SkillVersion,
pinned version entries and content hash.

The bridge:
- requires a canonical root SkillVersionId;
- requires valid revision/definition evidence hashes;
- requires the admitted root entry itself to have key `core.teaching`;
- uses that exact root SkillVersionId when constructing the Teaching runtime binding.

It does not perform readiness/authority checks itself and does not import #89's
`selection.ts`. The runtime owner remains responsible for calling its canonical
selection/admission machinery first. This keeps Teaching dependent on admission evidence,
not on a second selection implementation.


## ShellDocument v1 projection

`projectTeachingToShellDocument()` maps Teaching runtime projections into the exact
bounded primitive model already implemented by mobile PR #91. It does not invent a new
mobile component family.

Current mapping:
- lesson step -> heading/text/card/notice;
- single-select exercise -> heading/text/options/button;
- feedback -> notice/detail;
- artifact metadata -> card/detail reference presentation.

For a bound single-select exercise:
- each visible option key becomes the Shell button/node id;
- the Shell action id is the fixed allowlisted value `teaching.select`;
- the opaque Teaching action key becomes the Shell token;
- the Shell document expiry is derived from the exact Teaching action expiry and a
  conflicting caller-supplied expiry is rejected;
- RelationshipId, SkillVersionId, rubric and correct answers never enter the ShellDocument.

`resolveTeachingShellAction()` converts the resulting #91 `ShellAction` shape back
into exactly `actionKey + selectedOptionKeys` for Teaching. It rejects non-Teaching
action IDs, malformed scope and injected form values.

Multi-select uses an explicit server-held staged state machine rather than pretending a
set of independent buttons is one submitted answer.

`createTeachingMultiSelectStage()` binds the mutable selection state to the exact
Teaching action binding, expiry and hidden rubric. Every toggle:
- validates an allowed option;
- updates a canonical sorted option set;
- increments the stage revision;
- regenerates a deterministic stage hash.

`projectTeachingMultiSelectToShellDocument()` uses existing ShellDocument v1 primitives
only. Each option is a `teaching.multiselect.toggle` button and a separate
`teaching.multiselect.commit` button submits the server-held set. The Shell document
revision must exactly equal the current stage revision, so stale UI actions fail closed.
The document never exposes the rubric, canonical RequestId, RelationshipId or
SkillVersionId.

`applyTeachingMultiSelectShellAction()` rejects stale revisions, injected form values,
forged options and empty commits. A committed stage cannot be edited; exact re-commit
returns the same committed opaque selection. That opaque selection then enters the
existing `submitOpaqueSelection()` / RequestId replay-safe persistence path.

The owning Gateway/chat integration must durably retain or reconstruct the current
server-side stage between interactions. Client-local selection state is presentation
only and must never become learner-progress authority.

## WhatsApp and Telegram compact callbacks

PR #92 normalizes interactive replies into a single `selectionId`. Telegram callback
data is limited to 64 bytes, so the full Teaching action key and option cannot safely be
serialized into provider payloads.

`createTeachingChannelSingleSelectProjection()` therefore emits:
- visible prompt/labels;
- one compact opaque `selectionId` per option, using a caller-supplied unique token;
- server-held `TeachingChannelSelectionBinding` records mapping each callback token to
  the full Teaching action key, exact option key and action expiry.

The common callback token format is ASCII-only and capped at 64 characters so the same
contract works for both Telegram and WhatsApp. Provider payloads never contain
RelationshipId, SkillVersionId, rubric, correct answers or the full action binding.

On ingress, `resolveTeachingChannelSelection()` checks the server-held binding hash,
callback identity and expiry, then returns the same opaque Teaching selection shape used
by the app shell. Changed/tampered callbacks fail closed.

Multi-select messaging now uses the same staged server state. 
`createTeachingChannelMultiSelectProjection()` emits compact <=64-character opaque
toggle IDs plus one opaque commit ID, each bound to the exact action binding hash,
stage hash, stage revision and expiry. `resolveTeachingChannelMultiSelectCommand()`
rejects callback substitution, stale stage callbacks and expiry.

After any toggle, the channel must render a fresh projection for the new stage revision;
old callback IDs are intentionally invalid. Commit resolves only to a staged Teaching
command and cannot supply client-chosen Relationship/Skill/rubric/RequestId data.
The actual WhatsApp/Telegram owner still needs to persist the server-side stage and route
these opaque callback IDs through its authenticated account/session handling.


## Durable free-response exercises

Open-ended Teaching exercises now have a server-held `TeachingFreeResponseBinding`
with:
- canonical RequestId;
- exact RelationshipId + SkillVersionId;
- exact lesson step + exercise;
- SHA-256 hash of the normalized free-response exercise card/prompt;
- expiry;
- deterministic binding hash.

Binding creation requires the actual normalized `TeachingExerciseCard` and refuses
non-`free-response` cards. The client never chooses Relationship/SkillVersion/exercise
scope.

`submitFreeResponse()`:
- verifies exact binding integrity and expiry;
- requires the admitted Teaching runtime scope and current pedagogical plan;
- bounds the learner answer to 16,384 characters;
- accepts only normalized Core Teaching formative/practice evaluation;
- preserves the existing rule that only positive understanding evidence can advance;
- persists the exact learner response, evaluation, plan hash and progress before feedback;
- uses canonical RequestId + response payload hash for replay safety;
- rejects changed answer text under the same RequestId;
- returns the same feedback/continue/reteach/advance projection used by selectable answers.

For app/WhatsApp/Telegram, the free-response binding remains server-side. A normal text
message may only be evaluated as the pending exercise after the owning Gateway has
resolved the authenticated Relationship/session to that exact unexpired binding.
Narrative text alone never selects an exercise or grants progress authority.


## Staged multi-select persistence boundary

The staged protocol deliberately does not introduce a Teaching-owned database. The
integration owner must persist the current stage alongside the authenticated pending
Teaching action using canonical session/workflow storage. Persistence must preserve:
- exact action binding hash;
- stage revision and stage hash;
- canonical selected option set;
- collecting/committed state;
- expiry.

Concurrent/stale updates must use compare-and-set or equivalent serialization so two
surfaces cannot both mutate the same stage revision. A stage mutation is presentation
state only; durable learner progress changes only after commit flows through the
canonical RequestId selection attempt.

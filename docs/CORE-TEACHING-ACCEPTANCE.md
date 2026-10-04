# Core Teaching cross-channel acceptance

Status: contract-level acceptance harness on stacked integration PR #96.

## Journey covered

The acceptance test exercises one canonical learner relationship through the public
Teaching integration seam without importing Gateway, mobile UI, WhatsApp or Telegram
implementation code.

The journey is:

1. **App** starts an exact SkillVersion lesson with no existing durable progress.
2. The learner answers a server-bound selectable exercise correctly.
3. Durable selection-attempt custody commits before feedback delivery.
4. Feedback delivery is deliberately failed to simulate an uncertain/lost response.
5. **WhatsApp** retries the same learner action with the same canonical RequestId.
6. Persistence recognizes the same payload hash as a replay, so no second attempt or
   second advancement is written.
7. **Telegram** resumes from the same Relationship + exact SkillVersion durable progress
   and receives the next lesson step.
8. A different Relationship using the same SkillVersion starts independently and sees
   none of the first learner's progress.
9. Reusing the original RequestId with a changed answer fails as a payload conflict.

## What this proves

At the contract layer:
- channels are presentation/transport surfaces, not learner-state authorities;
- progress is Relationship-private and exact-SkillVersion scoped;
- persist-before-feedback supports recovery from uncertain delivery;
- cross-channel retries are exactly-once when the same RequestId is preserved;
- changed intent cannot hide behind a previous RequestId.

## What this does not prove

This is not physical/live channel verification. Production acceptance still requires:
- #89 runtime/Gateway composition and canonical Memory/Workflow/PostgreSQL adapter;
- #91 ShellDocument/ShellAction binding and device rendering;
- #92 authenticated WhatsApp/Telegram account linking, ingress and outbound delivery;
- real voice/text parity;
- exact certification evidence from those integrated environments.

The harness deliberately avoids those active owners' files and therefore cannot be used
as evidence that their deployment work is complete.


## Additional continuity cases

The harness also proves:
- switching the same learner from English text to Hausa voice keeps the same
  Relationship + exact SkillVersion progress and resumes the next lesson step;
- an incorrect selectable answer persists `needs-reteaching`;
- returning through another surface resumes the same lesson step instead of silently
  advancing or restarting the course.

These are contract-level continuity proofs. Natural-language quality, Hausa pronunciation,
audio transport and physical channel behavior still require the real integrated
environments.


## Opaque action and plan-drift acceptance

The acceptance harness now exercises the production-style selectable path:
- server creates the hidden Teaching action binding;
- client-visible exercise contains only safe option labels/keys plus opaque actionKey;
- app/WhatsApp return only actionKey + selected option keys;
- server reconstructs Relationship/SkillVersion/lesson/exercise/rubric/RequestId;
- a lost response retries with the same action/RequestId and does not advance twice.

It also proves that a later channel cannot resume durable learner progress against a
different regenerated pedagogical sequence. Language/modality changes remain permitted
without changing the pedagogical plan identity.


## Shell and provider callback acceptance

The acceptance path now crosses the same shapes used by the active UI/channel work:
- a bound Teaching exercise projects into ShellDocument v1 using existing primitives;
- Shell button id is the visible option key;
- Shell action id is the fixed allowlisted `teaching.select`;
- Shell token is the opaque server action key;
- Shell document expiry is the exact Teaching action expiry;
- ShellAction resolves back to one opaque Teaching selection without accepting injected form values;
- WhatsApp/Telegram outbound choices expose compact <=64-character provider selection IDs;
- provider selection IDs resolve through server-held bindings tied to the exact Teaching action binding hash;
- a valid callback cannot be substituted onto another valid action;
- aggregate ShellDocument text/node/depth bounds are checked server-side before emission.

Current app/channel executable projection is single-select. Multi-select deliberately fails closed until
#91/#92 have a bounded staged-selection/commit contract rather than independent buttons pretending to be
one multi-answer submission.


## Free-response acceptance

The contract harness now also covers a free-response exercise bound on the server,
answered through WhatsApp text, evaluated formatively, persisted exactly once and then
resumed from Telegram at the next lesson step.

The free-response binding is created from the exact normalized exercise card, so a
selectable exercise cannot be rebound as open text and prompt drift is included in
binding integrity. Changed response text under an existing RequestId is a replay conflict;
wrong answers persist reteaching state; expired/tampered/cross-Relationship bindings fail
closed.

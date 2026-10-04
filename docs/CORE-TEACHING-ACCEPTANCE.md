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

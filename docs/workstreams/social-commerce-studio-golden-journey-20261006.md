# Social + Commerce + Studio production golden journey — Production Task 138

Owner/window: ChatGPT continuation window / 2026-10-06
Lease acquired under the merged five-minute stale-claim rule.
Branch: `work/social-commerce-studio-golden-journey-20261006`
Base main at claim start: `8648c5f524108d825fa52e3a7f735675dd8b78f7`
Task: Production Task 138 — pass social, commerce and studio production golden journeys.

## Reclaimed stale prerequisites

- PR #261 Social identity/content
- PR #263 Social publication/outbox/receipt/retry
- PR #265 deterministic Commerce quote/payment/ledger/fulfillment
- PR #270 Commerce reconciliation/refund safeguards
- PR #264 Studio project/artifact/provenance
- PR #266 Studio production workflow
- PR #268 Character surface consistency

Each prerequisite was inactive for more than five minutes when this lease was taken.
Only canonical source modules required for the golden journey are preserved on this branch.
No stale branch is rewritten or force-pushed.

## Exact owned paths

- `docs/workstreams/social-commerce-studio-golden-journey-20261006.md`
- `tests/e2e/social-commerce-studio-golden-journey.test.ts`
- preserved prerequisite source modules:
  - `packages/social/src/model.ts`
  - `packages/social/src/social.ts`
  - `packages/social/src/publication.ts`
  - `packages/commerce/src/journey.ts`
  - `packages/commerce/src/reconciliation.ts`
  - `packages/studio/src/model.ts`
  - `packages/studio/src/invariants.ts`
  - `packages/studio/src/provenance.ts`
  - `packages/studio/src/production-workflow.ts`
  - `packages/identity/src/character-surface-consistency.ts`

## Explicitly excluded

- active #136 Gateway/mobile/router/APK/production composition
- active #295 mobile accessibility
- social provider SDK/network dispatch
- live payment/provider execution
- media rendering/provider SDKs
- migrations, production environment and credentials

## Acceptance target

One exact Tenant/presentation Character must survive:

1. Social account binding -> draft -> ready -> approved/queued/published receipt.
2. Commerce quote/payment/fulfillment with the same originating Character and an optional separate executor.
3. Commerce refund/reconciliation without changing original Character attribution.
4. Studio source -> script -> storyboard -> visual/voice -> lipsync final artifact with exact provenance.
5. Cross-surface identity evidence proves Social + Studio + Commerce origin are the same Character while a distinct Commerce executor remains only an execution role.
6. Any mismatched Tenant/Character, ambiguous side effect, stale revision or missing provenance fails closed.

State: IMPLEMENTED / VERIFICATION PENDING.

## Completed

- reclaimed stale Social, Commerce, Studio and Character-consistency prerequisites without rewriting their original branches;
- composes Social account binding -> ready content -> approval -> outbox claim -> provider success receipt;
- composes deterministic Commerce quote/admission/settlement with the same originating Character and a distinct fallback executor;
- proves reconciliation/refund reverses the exact customer payment scope without changing origin attribution;
- composes Studio source -> script -> storyboard -> voice/render -> lipsync final video with exact parent provenance;
- certifies Social presentation, Studio media and Commerce originating Character are identical;
- allows a separate Commerce executor only as explicit executor evidence;
- mismatched cross-surface Character evidence fails closed.

No provider SDK/network call, live payment, media rendering SDK, migration, production configuration, #136 path or #295 path was changed.

Implementation head before handoff: `6721cd17f2f88dc2673e644f882bea00f5a2e9df`.

Last update: 2026-10-06.

# Task 138 social/commerce/studio golden-journey qualification

Owner/window: ChatGPT continuation window / 2026-10-06
Branch: `work/task138-social-commerce-studio-qualification-20261006`
Base SHA: `8648c5f524108d825fa52e3a7f735675dd8b78f7`
Production task: 138 — pass Social, Commerce and Studio production golden journeys.

## Scope

This lane implements an isolated, deterministic qualification gate for externally produced Task 138 evidence. It deliberately does not merge, cherry-pick, edit or supersede the active Task 131–137 implementation stacks.

## Exact owned paths

- `docs/workstreams/task138-social-commerce-studio-qualification-20261006.md`
- `scripts/task138-golden-journey-qualification.mjs`
- `scripts/task138-golden-journey-qualification.test.mjs`

## Excluded/shared paths

- Task 131 Social domain and Task 132 publication/recovery paths;
- Task 133/134 Commerce implementation, repository, ledger, migrations and provider adapters;
- Task 135/136 Studio implementation/provider paths;
- Task 137 Identity consistency implementation;
- PR #136 Gateway/mobile/router/APK/production ownership;
- production environment, credentials and real provider state.

## Active upstream evidence owners

- Social Task 131: PR #261 / `work/social-identity-content-20261006`;
- Social Task 132: PR #263 / `work/social-publication-journey-20261006`;
- Commerce Task 133: PR #265 / `work/deterministic-commerce-journey-20261006`;
- Commerce Task 134: PR #270 / `work/commerce-reconciliation-refund-20261006`;
- Studio Task 135: PR #264 / `work/studio-project-artifact-provenance-20261006`;
- Studio Task 136: PR #266 / `work/studio-production-workflow-20261006`;
- Character consistency Task 137: PR #268 / `work/character-surface-consistency-20261006`.

## Completed implementation

The qualifier:
- requires explicit `production-like` environment evidence rather than inferring acceptance from unit tests;
- requires exact 40-character Git heads for Social, Commerce, Studio and Character-consistency sources;
- requires six golden-journey families: Social publication, Commerce purchase/fulfillment, Commerce refund/reconciliation, Studio production, Character consistency and cross-domain replay/recovery;
- rejects duplicate/unknown journey keys and malformed source identities;
- binds each journey to the exact declared upstream source head;
- independently requires functional pass, retry/recovery pass and authorization/privacy pass;
- requires SHA-256 evidence for each journey plus the parity ledger;
- fails Task 138 qualification when blocking parity is non-zero;
- returns only `READY`, `INCOMPLETE` or `FAILED`, with missing evidence never silently accepted;
- exposes a CLI that exits non-zero unless the result is `READY`.

Focused tests cover:
- complete READY evidence;
- missing-journey INCOMPLETE classification;
- changed upstream-head rejection;
- independent functional/recovery/privacy failure classification;
- blocking parity;
- duplicate journey and malformed hash rejection;
- non-production-like evidence rejection;
- required source-head vocabulary stability.

## Verification

- final pre-handoff comparison against `main`: ahead 3 / behind 0;
- changed files are exactly the three owned paths above;
- PR #299 opened from implementation head `28201b4e18634f1db995f0896b63860371f54432`;
- Foundation CI run `37489957255`, job `112359757589`, concluded `failure` with `steps = null`; checkout/install/typecheck/tests never executed, so no application failure or success is inferred.

## Handoff

- implementation head before handoff update: `28201b4e18634f1db995f0896b63860371f54432`;
- PR: #299 — Add Task 138 social commerce studio qualification gate;
- isolated implementation status: COMPLETE;
- Production Task 138 status: NOT COMPLETE.

## Remaining dependencies

Task 138 becomes eligible for READY only after the active Tasks 131–137 owners provide production-like evidence on exact reconciled heads. Real provider/persistence/composition evidence remains with those owners and the protected production integration lane.

State: ISOLATED COMPLETE / WAITING ON TASKS 131–137 PRODUCTION-LIKE EVIDENCE.

Last update: 2026-10-06.

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

## Acceptance intent

The qualifier must fail closed unless:
- exact Git heads are supplied for Social, Commerce, Studio and Character-consistency evidence;
- all required Task 138 golden-journey families are present exactly once;
- every journey passed its functional, retry/recovery and authorization/privacy checks;
- every claim is bound to SHA-256 evidence;
- all journey evidence identifies one of the declared upstream heads;
- blocking parity count is zero;
- the candidate is explicitly production-like rather than inferred from unit tests.

State: CLAIMED / IMPLEMENTATION IN PROGRESS.

Last update: 2026-10-06.

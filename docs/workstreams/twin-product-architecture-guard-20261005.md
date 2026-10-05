# Twin product architecture guard workstream

Owner/window: current ChatGPT implementation window
Branch: `work/twin-product-architecture-guard-20261005`
Base SHA: `c00de8cf7845c3a4caa39f088539c547e6a76b87`
Task: TWIN-004 additive guard implementation

## Scope

Add a reusable CI/review guard that validates future changed paths/content against the
approved simplified twin product architecture.

## Owned paths

- new `scripts/twin-product-architecture-guard.mjs`
- new `scripts/twin-product-architecture-guard.test.mjs`
- this claim file

## Guarded regressions

- new human social-feed/post/follower/like subsystems;
- second wallet/marketplace/twin-runtime package/service;
- internal terms such as Agent Float/SkillVersion/CharacterVersion/Workflow/Provider in
  the new consumer surfaces (My Twin, Explore, Activity, Wallet).

The guard is additive and does not remove current legacy surfaces before their migration.

Status: guard implementation complete and locally verified.

Implemented:
- reusable changed-file architecture validator;
- rejection of new human feed/posts/followers/likes screen subsystems;
- rejection of second wallet/marketplace/clone-runtime/social packages/services;
- rejection of Agent Float, SkillVersion, CharacterVersion, Workflow and Provider terms
  inside new My Twin / Explore / Activity / Wallet consumer surfaces;
- readable failure messages pointing developers back to canonical product docs;
- Node test suite.

Verification:
- local `node --test scripts/twin-product-architecture-guard.test.mjs`
- 5 tests passed, 0 failed.

Not yet integrated:
- CI changed-file collection/piping into this guard. That wiring belongs to the shared
  CI/integration owner because package/workflow files are actively owned elsewhere.

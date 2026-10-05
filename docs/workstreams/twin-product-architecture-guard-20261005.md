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

Status: implementation started 2026-10-05.

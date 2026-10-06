# Social identity, account binding and content state — Task 131

Owner/window: ChatGPT continuation window / 2026-10-06
Branch: `work/social-identity-content-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`
Production task: 131 — canonical social identity/account binding and content state.

## Coordination

No `packages/social` exists on current main and no competing Task 131 social-domain claim was found. The canonical Domain Model already defines `SocialContentId` and requires provider/social identities to remain external references rather than Character identity.

## Exact owned paths

- `docs/workstreams/social-identity-content-20261006.md`
- `packages/social/package.json`
- `packages/social/tsconfig.json`
- `packages/social/tsconfig.build.json`
- `packages/social/src/index.ts`
- `packages/social/src/model.ts`
- `packages/social/src/social.ts`
- `packages/social/src/social.test.ts`

## Explicitly excluded/shared paths

- Task 132 publication/outbox/retry workflow
- canonical Identity package
- Security approvals/credentials
- Events/Operation/Publication persistence
- Gateway/Worker/Ops/mobile
- provider adapters/APIs
- migrations, root lockfile, production config
- human social feed/product UI

## Acceptance target

- provider social account remains a typed external subject, never Character/User identity;
- account binding is Tenant + Character scoped, revisioned and revocable;
- binding requires explicit linked/strong external identity evidence;
- one binding cannot silently move to another Character or Tenant;
- canonical SocialContent uses SocialContentId and exact Character source;
- bounded text/media external references and explicit audience intent;
- content lifecycle is draft -> ready -> archived; publication execution/state remains Task 132;
- stale revisions and cross-binding content creation fail closed;
- no provider-specific publish API or second social runtime.

State: IMPLEMENTING. Canonical Social package, external-account binding, revisioned content lifecycle and focused tests are committed. Publication workflow/persistence/provider integration remain excluded.

Implementation head before handoff: `0a83c3b40304abebb98308199b6139e06303543b`.

Last update: 2026-10-06.

# R14 — Firebase push delivery resilience (2026-10-08)

- **Owner/window:** ChatGPT R14 independent production notification lane
- **Branch:** `work/r14-fcm-delivery-resilience-20261008`
- **Base main SHA:** `f91519fb05ae6b244ba9a721479aada03e7e08ba`
- **Task:** R14 notification reliability and privacy; no device/deployment acceptance asserted.
- **Last repository-visible work:** 2026-10-08T05:52:18.354Z
- **Owned paths:** `services/gateway/src/mobile_push.ts`, `services/gateway/src/mobile_push.test.ts`, this file.
- **Shared contracts:** Existing MobilePushSender/MobilePushRepository kept unchanged; no migrations, gateway composition or other windows' code modified.
- **PR:** #436 — draft, not safe to merge without executable tests.
- **Status:** CODE IMPLEMENTED / TESTS AUTHORED / TEST EXECUTION UNVERIFIED / DEPLOYMENT BLOCKED / DEVICE BLOCKED. Lease released for another window.

## Changes

1. One OAuth exchange shared across concurrent sender calls, with cache retained until expiry.
2. One forced OAuth refresh on FCM HTTP 401, then a sanitized fail-closed error if a renewed credential is also rejected.
3. Bounded 250ms/500ms backoff on definite FCM 429/5xx rejections; never retry HTTP 400/403 or an ambiguous network error, because FCM may already have accepted it.
4. Continue delivering to remaining registered devices when one token has a definitive permanent rejection or ambiguous transport failure; do not count those sends as delivered.
5. No token/principal/notification payload in thrown authentication errors, and no unsafe token pruning without an exact FCM error classification.
6. Nine new Vitest cases: empty list, multi-device scopes/copy caps, transient recovery, exhausted attempts, permanent statuses, token refresh, repeated credential rejection, ambiguous network failure and concurrent OAuth.

## Verification evidence

- Branch commits: `5b1e1cbb4f62f288ec4f471dbd34291a54c69390` (sender), `bc3af14b5b682eebfc8efba161d9d4648d90d502` (tests), `c105a5e0bfc6268005a5e46e79f5961457cb6df4` (Node typing).
- Read back branch versions: FCM source and nine test cases are present.
- GitHub Foundation CI run `37734439977` failed **with zero job steps**; this is runner/startup failure, not executed application test evidence. No local private-repository checkout/build environment was available to run Vitest or TypeScript. **Do not merge until typecheck + relevant Vitest + integration pass.**
- GitHub PR #436 initially reported mergeable (no file conflicts), which is not proof of runtime correctness.

## Follow-on R14 work (not delivered here)

- Configure matching Firebase client project defines and server service-account secret; verify token registration, permission changes, OAuth delivery, foreground/background/open navigation, lock-screen privacy and deep-link deduplication on devices.
- Produce notifications from committed domain events with real user opt-in/quiet-hours; Talk policy and durable dedupe foundations already exist, but complete producer wiring and end-to-end acceptance remain outstanding.
- A send that exhausts transient retries can still be lost because upstream Talk dedupe is claimed before delivery and does not track acknowledgement/retry leases. Design a durable pending/claim/ack retry job with the integration owner before asserting fully resilient delivery; don't bypass dedupe or resend ambiguously.
- Check cross-account FCM installation-token uniqueness: PostgreSQL registration is keyed by tenant/user/installation and uniqueness is currently only (tenant, token). Old-device registration after failed unlink must not expose new-owner notifications. The R12 identity/privacy owner has claimed `adapters/storage/postgres/src/agents/mobile-shell.ts`; coordinate this concern instead of editing their path.
- No Firebase service-account/client credentials were supplied or changed. No production delivery or handset evidence obtained.

## Resume

1. Freshly inspect main, PR #436, R12 ownership and any R14 activity.
2. Run `pnpm exec vitest run services/gateway/src/mobile_push.test.ts`, `pnpm --filter @masanawa/gateway-service typecheck`, repository typecheck/build and relevant notification integration checks once runners are usable.
3. Fix any compile/behavior errors. Verify outgoing FCM requests against a project/test device with consent and that no duplicates/privacy regressions occur.
4. Merge to main only after reviewable verification, then continue R14 remaining gates; ledger stays PARTIAL/BLOCKED until production qualification.

## Stale lease reclaim — 2026-10-08, bounded FCM network deadlines
Reclaimed existing PR #436 after more than five minutes inactive (prior `2026-10-08T11:19:27Z`, head `a4cf91004afd277857edff7f5ab2e73771ce40e8`); reviewed main `1d6a67ea3c182455b55a7d1d07eacdb4311682e3` and C03 #473/#483/#486 changed paths. Exclusive claim `services/gateway/src/mobile_push.ts`, `services/gateway/src/mobile_push.test.ts`, this handoff; does not touch C03 route/schema, R12 token repository, Gateway composition, Android router or Firebase secrets. Planned full bounded source/test: 15-second OAuth and each FCM HTTP attempt AbortSignal deadlines, fail closed for ambiguous FCM timeouts without replay, continue eligible following devices. Tests and production provider verification not executed; keep draft.

# R14 — privacy-safe Talk push preview, full implementation checkpoint

Updated (UTC): 2026-10-08; window/owner: GPT-6 R14 Talk push preview
**Status for this bounded R14 preview slice: IMPLEMENTED_UNVERIFIED**. **Overall R14: PARTIAL/BLOCKED, NOT DONE.**
Claim/lease: `docs/workstreams/r14-talk-push-private-preview-20261008.md`; claimed before source changes. Same-branch reviewable PR #502; five-minute lease expires from last visible branch activity. Do not overwrite active owners.
Base main SHA: `1d6a67ea3c182455b55a7d1d07eacdb4311682e3`
Branch: `work/r14-talk-push-privacy-20261008-gpt6`
Source implementation commit: `dd5ab1ccfbfe129da2c1622d11f213f0fce9a3f6`; final handoff HEAD is recorded by the PR #502 commits timeline/PR comment (a file cannot contain its own commit SHA).
Draft PR: https://github.com/Baatiku/masanawa/pull/502 — remains **unmerged**.
Requirement IDs: R14, N06, M08, T05, J04, J11; Talk events/Activity and user-configured push registration remain the canonical service, not a second messaging provider.

## Existing layers and exact owned changes

| Layer | Code/source | Result |
| --- | --- | --- |
| Flutter foreground OS notification | `apps/mobile/lib/src/core/mobile_push.dart` | Uses static `privatePushPreview(message.data)`, not Firebase-supplied notification title/body, while retaining OS notification flow and original validated link navigation. |
| Flutter privacy projection | `apps/mobile/lib/src/core/private_push_preview.dart` (new) | Fixed, non-user-controlled generic copy for all 11 server Talk kinds; unknown/future kinds become `Masanawa / You have a new update.`; no private text/amount/account name interpolation. |
| Backend policy | `services/gateway/src/talk_notifications/policy.ts` | Normalizer discards lower-trust `actorDisplayName` for push and does not reject a long profile name; invitations/followed-Host/gifts and AI-Seat/earnings avoid named users, hold/credit/refund claims and specific sums. |
| Backend dispatch + authenticated privacy/tenancy | Existing `services/gateway/src/talk_notifications/delivery.ts`, `runtime.ts`, `postgres_dedupe.ts`, `mobile_push.ts` | Unchanged canonical scoped event→dedupe→FCM delivery, tenant/user registration, user opt-in, quiet-hours and backend route. Updated existing delivery assertion verifies no actor text reaches sender. No new API route or auth principal invented. |
| PostgreSQL/schema | Existing Talk notification/dedupe persistence | No migration needed for display-only mapping. Event and client token registration data lifecycle is unchanged, with no new stored PII; this PR changes only payload projection. |
| Tests | `services/gateway/src/talk_notifications/policy.test.ts`, `delivery.test.ts`, `apps/mobile/test/private_push_preview_test.dart` | Regression source added/updated: adversarial actor/name/phone/amount/URL, 11 event kinds, no disclosure at sender, financial hold phrasing, malformed/unknown kinds. |
| Voice/text/taps | Existing Talk Activity and notification permission/settings UI | No new capability or inert control; a push notification is a passive hint. Authorized Activity/deep-link flow must recheck identity and membership on read. No voice or payment action launched by opening push. |
| Recovery | Existing Activity/dedupe/event readback and app foreground notification | Unknown payload fails closed to generic copy. No change to delivered/read semantics, no speculative resends or duplicated registrations. |

## Security and behavioral limits

- This patch closes actor-name injection into **Talk** FCM display text and provider-text rendering in **foreground Android/iOS local notification banners**. Firebase background/killed OS presentation is generated from the **server** Talk policy and therefore requires the new backend to deploy. It cannot retroactively sanitize notifications queued by older deployed code.
- Future C03/private-DM producers or any direct caller of the generic `MobilePushSender` can bypass the Talk policy in *background*; they must implement their own equivalent privacy-safe server copies before R14's whole-app lock-screen gate is marked complete. This remains a **cross-lane release risk**, not a missing owned Talk-policy implementation.
- Push metadata still contains existing kind, event ID and Talk ID, used for existing deep-link handling. No body, actor name, financial amount or untrusted Firebase text is included in this new projection.
- Device sign-out, token rotation and account switching still depend on existing R14 client state and #436/other integration reviews. This PR neither alters those authorities nor claims Firebase live verification.
- No production DB reads/writes, provider calls, secrets, Firebase reconfiguration, store signing, broad migration or release activation performed.

## Verification actually executed

- **Source readback only** using the connected GitHub repository after push: PR #502 showed seven changed paths, two commits at implementation checkpoint and retained draft status; new Dart projection file fetched by branch SHA `3a98f98e29da9d774de326cc275f1bfffa869c02`. This proves remote source persistence, **not compilation/tests**.
- Reviewed the PR unified diff against the original `main` source and known R14 caller. No local pnpm/Dart/Flutter test or Android/FCM execution has run in this window.
- Existing issue #457 documents independent Foundation/Mobile Build Actions jobs ending with **zero executed steps**. Do not cite them as test results. Avoid repeated quota retries.

## Exact unexecuted checks for ChatGPT Work

1. `git fetch --all --prune && git checkout work/r14-talk-push-privacy-20261008-gpt6` (or safe isolated worktree); `git rev-parse HEAD`; preserve branch and current main separately.
2. With Node **24** and pnpm **12.8.2** from the checked-out repo, `pnpm install --frozen-lockfile`; `pnpm exec vitest run services/gateway/src/talk_notifications/policy.test.ts services/gateway/src/talk_notifications/delivery.test.ts services/gateway/src/talk_notifications/runtime.test.ts services/gateway/src/talk_notifications/postgres_dedupe.test.ts`; `pnpm typecheck`. Verify all tests PASS and compile both TS projects; the current isolated environment only has Node 22 and no authenticated GitHub checkout/network.
3. `cd apps/mobile && flutter pub get && flutter analyze && flutter test test/private_push_preview_test.dart test/shell_deep_link_test.dart`; then full Flutter test suite/APK build and Android 12+ real permission/background/foreground/killed tests. Flutter/Dart SDK not present in this execution environment; run on a qualified local/Work device.
4. On isolated Firebase test project/credentialed Gateway **not production**, register two separate legitimate users/devices, emit each Talk event, capture FCM JSON and OS banners for foreground/background/killed/notification-history. Confirm no attacker-controlled name, phone, amount, URL or held Credits visible, while taps open only the authorized server-read Activity/Talk. Test opt-out, expired/revoked sessions, quiet hours, permission denial and account switch. Backend/FCM credentials and two devices unavailable here.
5. Verify current main/PR #436 transport resiliency, #497 shared integration and #461 Firebase config against branch changes. Rebase only after checking exact path ownership. Test final composed SHA before converting draft to ready/merging.
6. Check Talk push policy and mobile fixed copy remain synchronized; any future event kind must be given a generic server copy or remain undisplayed until reviewed. Review separate C03 DM pushes for privacy before enabling background payloads.
7. Verify deploy SHA, credentials and backup readiness independently; execute `/readyz`, tenant/authorization/Activity readback and restore gates per backend audit and release checklist. Do not modify a production 500MB volume without backup/restore evidence.

## Missing implementable source vs blocked evidence

- **This bounded Talk preview implementation:** none known after source review. Verification and integration are unexecuted, so it remains IMPLEMENTED_UNVERIFIED, not ready to merge.
- **Entire R14 lane:** Firebase runtime readiness, authorized delivery/retry/push dedupe/lock-screen across other event producers, multi-device/test credentials and application release are still pending, owned by R14 integration / C03 / Work. No global completion assertion.
- **Active/duplicate collisions:** R14 FCM sender #436 owns `mobile_push.ts` (backend) and tests; shared #497 owns broad multi-lane integration; C03 #473/#483 owns human DM realtime and future DM events; #461 Firebase setup remains unmerged. This PR owns neither FCM client secrets nor C03 message schema.
- **Unexecuted blocker:** #457 Actions runner/quota issue; no network access to GitHub repo checkout in local container, Node version mismatch and no Flutter SDK/Firebase test devices. App delivery deploy state unknown.

## Release gates for this specific R14 source slice

| Gate | Evidence |
| --- | --- |
| SOURCE_WRITTEN | YES — push source commit above, reviewed by remote diff |
| LOCAL_TESTED / CI_EXECUTED | NO / NO — authored not run |
| DB_INTEGRATED | EXISTING shared repo; no schema change; NOT runtime-tested at this SHA |
| APP_INTEGRATED | Source wired in `onMessage`; no Flutter analyzer/APK/device proof |
| DEVICE_VERIFIED / PROVIDER_QUALIFIED | NO / NO |
| DEPLOYED / MERGED | NO / NO |
| VERIFIED_E2E / DONE | NO / NO |

## Rollback and handoff disposition

Source is isolated to policy/copy and tests: revert PR without migrations. If deployed, reverting restores actor-name display; review privacy consequence. Do not deploy until backend, app and Firebase versions qualify together, and do not allow legacy remote content to replace generic client copy. The final Work integrator should keep #502 **draft/unmerged** until actual end-to-end evidence at a known SHA is recorded.

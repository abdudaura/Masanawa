# Integration workstream — mobile shell completion

Owner/window: ChatGPT mobile-shell completion window assigned explicitly by user on 2026-10-04.
Branch: `work/integration-mobile-shell-completion-20261004`
Current base: `main` at `3906419669203844018b6687ad06ab2af48654eb`; branch was rebased cleanly and is zero commits behind as of 2026-10-04.
Task references: Tasks 072–076 integration dependencies; app-shell release hardening.

## Ownership transfer and dependencies

The user explicitly assigned this window to finish all remaining mobile-shell features described in the 2026-10-04 app-shell review. Transfer/coordination was recorded on PRs #89 and #91 before implementation.

This integration owns the mobile/Gateway integration paths required to finish:
- PR #91 ShellDocument/ShellAction integration into the live chat;
- authenticated action dispatch and result reconciliation;
- shell capability negotiation and minimum-version/remote-feature policy;
- live document revision lifecycle;
- durable outbound message/action recovery;
- server-backed conversation/history restoration;
- generic realtime work/progress/presence events;
- push notification/deep-link shell contracts and native hooks;
- live voice session shell and audio interruption/routing lifecycle;
- permission UX;
- offline/reconnect/error recovery surfaces;
- pending-work/notification summary;
- account/logout secure-state cleanup.

Owned paths may include:
- `apps/mobile/**`
- the exact Gateway agent conversation/action/history/realtime routes required by this shell
- new shell-specific contracts/adapters/tests under `services/gateway/**`
- `docs/APP-SHELL-CONTRACT.md`, `docs/MOBILE-AGENT-EXPERIENCE.md`
- this claim file.

Shared files remain coordinated. This window will not change Commerce settlement/provider internals, Teaching domain internals, WhatsApp/Telegram ingress internals, migrations owned by other workstreams, or unrelated root configuration unless a narrow integration change is unavoidable and rechecked first.

PR #91 implementation is a dependency to incorporate, not duplicate. PRs #90/#92/#93/#94/#95/#96 remain authoritative for their owned domains.

## Current status

Implemented on PR #104:
- PR #91 ShellDocument renderer/action lifecycle is mounted in the live chat.
- canonical mobile Gateway prefix is `/agent/**` (Ops remains `/v1/**`);
- authenticated shell action dispatch, encrypted persist-before-send journal and server-side idempotent action records;
- shell capability/minimum-version negotiation and safe fallback;
- live document revision/event replacement;
- durable RequestId turn claims, replay/status reconciliation and server-backed history;
- realtime shell events, work/approval refresh, presence projection and compact activity surface;
- FCM registration contract, local notification handling and `masanawa://` deep links;
- Gemini Live ephemeral-token flow and direct mobile WebSocket voice session;
- microphone/camera/notification permission handling;
- offline queue/reconnect states and account-scoped secure shell cleanup;
- current creator-economy/default-support-agent work from `main` preserved during rebase;
- multi-attachment turns, streamed text, cancellation and native reply audio preserved together with the current Skill-discovery strategy;
- Android notification desugaring and release smoke script updated.

Important integration corrections made during the rebase:
- shell migration renumbered to `0006_mobile_shell.sql` after current agent migrations;
- malformed automatic merges in Gateway composition/conversation/Alpha authorization were rebuilt from current `main`;
- stale `/v1/agent/**` mobile paths were removed in favor of the documented `/agent/**` contract;
- unsupported shell actions now fail before an idempotency record is claimed;
- missing mobile Gateway `PUT` helper restored.

Verification:
- branch comparison: ahead of current `main`, zero behind at the last check;
- structural sweep found no unmatched braces/parentheses or conflict markers in changed TypeScript files;
- shell parser/coordinator/session/journal pure-Dart tests from the dependency work remain present;
- server shell tests now cover fail-closed unsupported actions, accepted-action replay without duplicate execution, and capability negotiation;
- existing conversation tests were extended for multi-attachment turns and route coverage;
- current `flutter_local_notifications` API and Gemini Live ephemeral-token protocol were checked against current upstream documentation;
- GitHub Actions **did not execute any steps**: both Foundation CI and Mobile Build repeatedly completed with `runner_id: 0`. This is an infrastructure/runner-start failure, not evidence that code tests failed or passed.
- no physical-device APK claim is made. Run `apps/mobile/tool/build_chat_test.ps1` on the user workstation before release.

Release state: keep PR #104 draft until an actual Flutter/TypeScript runner executes the repository checks and the APK is exercised on-device.

Last update: 2026-10-04.

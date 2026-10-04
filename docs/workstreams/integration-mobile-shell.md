# Integration workstream — mobile shell completion

Owner/window: ChatGPT mobile-shell completion window assigned explicitly by user on 2026-10-04.
Branch: `work/integration-mobile-shell-completion-20261004`
Base SHA: `98b293b2020668b2123e4e7b9d6baae0ebfc1b88` (PR #89 head; preserves its runtime/mobile work)
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

## Current step

1. Claim published and verified.
2. Incorporate PR #91 shell primitives/journal into this branch.
3. Bind live authenticated action/capability/revision transport.
4. Add history/recovery/realtime/native notification/deep-link/permission/live-voice shell.
5. Add tests and run available verification.
6. Leave exact release/build handoff; do not claim physical APK verification without an actual build/device pass.

Implementation status: starting.
Verification status: claim only; no new implementation claim yet.
Deployment status: not deployed.
Last update: 2026-10-04.

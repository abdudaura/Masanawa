# Mobile chat cache fast-start — 2026-10-05

Owner/window: ChatGPT startup-performance continuation after session/directory first-frame checkpoints.
Branch: `work/mobile-chat-cache-fast-start-20261005`
Base: `04da981b10b9a195e70bbbae2ab08fbc34b27e61`

Purpose:
1. Reduce path-provider/platform calls before cached conversations appear.
2. Keep chat persistence account-scoped while making cached threads render sooner.
3. Avoid repeating application-documents-directory resolution on every local save.

Owned paths:
- `apps/mobile/lib/src/state/ai_chat_state.dart`
- focused mobile tests only if needed
- `docs/AGENT-HARNESS.md`, `CONTINUE-HERE.md` and this claim at checkpoint

Boundaries:
- no Gateway/chat protocol changes;
- no server-history semantics changes;
- no auth, workflow, billing, crypto or provider changes;
- account-scoped cache isolation remains mandatory;
- no APK rebuild.

Acceptance:
- first cached-thread load resolves the application documents directory once;
- legacy global cache cleanup no longer blocks current-account cache hydration;
- subsequent thread saves/deletes reuse the resolved documents directory in this controller lifetime;
- corrupt/missing local cache remains fail-open;
- docs updated before merge.

Status: active.

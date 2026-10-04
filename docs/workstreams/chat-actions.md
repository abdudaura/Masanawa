# Chat actions ownership

Owner: app-shell window, 2026-10-04.
Branch: chat-shell-dynamic-renderer.
Base: 3906419669203844018b6687ad06ab2af48654eb (main inspected).
Scope: apps/mobile/lib/src/chat/message_parts.dart, message_parts_view.dart, shell_document.dart, shell_document_view.dart; apps/mobile/test/shell_document_test.dart; docs/APP-SHELL-CONTRACT.md; this claim.
Dependencies: action execution Gateway contract and chat session controller are integration-owned; no financial execution authority in renderer.
Current step: bounded versioned remote UI model and renderer; preserve existing message cards and blue theme.
Implementation: in progress. Verification: pending; Flutter unavailable in this workspace. Deployment: none.
Other windows: do not edit these paths while this claim is active. Server action routing and channels remain independently owned.

Checkpoint: versioned bounded renderer, durable message document serialization, readable forward compatibility, required input validation, disabled unbound buttons, busy/consumed/expired action guards and parser/widget test source implemented. PR #91. Tests not run: no Flutter/Dart runtime. Not merged/deployed. Next: coordinate canonical Gateway dispatcher and chat controller ownership; add authenticated action binding, capabilities and durable reconciliation; run analyze/tests and device checks. No payment functionality or complete APK independence is claimed. See docs/APP-SHELL-CONTRACT.md.

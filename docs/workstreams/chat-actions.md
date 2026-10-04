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

Continuation 2026-10-04: PR #89 exact changed paths include Gateway composition/conversation contracts and mobile session/transport/controller/screen. They are not owned by this window and will not be edited. Extending only owned renderer/model/tests/docs; additionally claim apps/mobile/lib/src/chat/shell_action_coordinator.dart and apps/mobile/test/shell_action_coordinator_test.dart for a provider-neutral durable action/reconciliation port. No Gateway endpoint or controller binding is invented. Requirements are handoff dependencies for #89/integration.

## Verified continuation checkpoint

Implementation head before this handoff: 41b630f30b340efb4cd2f7431deebfeed545ff5b.
Implemented: capability manifest; metric/detail/progress/notice primitives; timezone-bound action expiry; unknown-component full fallback; safe malformed message parsing; narrow/large-text detail layout; expiry timer; revision-aware form reset and stale-callback rejection. Added ShellActionCoordinator atomic pending claim for one selection per document revision, immutable terms, monotonic completion and authoritative reconciliation without redispatch. Journal/dispatcher are ports, not concrete deployed adapters.
Verified: Dart 3.13.5, 18 pure Dart tests pass (10 model/parser + 8 coordinator); analysis of three production pure-Dart files reports no issues. Flutter-source formatting parses all changes. Widget test source expanded but NOT executed; Flutter typechecking/APK/device tests remain open. Test imports only adapted in an isolated Dart harness; production files unchanged.
Review: PR #91 diff contains nine exact owned files only, with no overlap with PR #89 or commerce-core claim. Main remained 3906419669203844018b6687ad06ab2af48654eb during recovery. Not merged or deployed.
Next: #89/integration must provide authenticated dispatcher plus encrypted atomic journal adapters, bind screen actions, negotiate capabilities and emit authoritative documents/results. Keep buttons disabled until binding exists. Run full Flutter checks and real-device tests. This active claim remains scoped; no runtime/controller ownership transfer is implied.

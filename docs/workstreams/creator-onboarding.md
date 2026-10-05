undefined
## Current-main and mobile continuation — 2026-10-05

Main is now a97df254ff04c717e940a7c86f4b5824dea7629d. PRs #104/#125/#127/#131/#132 have merged. Reconcile only this branch's owned changes with current main, preserving canonical PlatformSession authentication and every newer shared export. The old wildcard mobile-shell claims no longer imply ownership of new unrelated UI. Active #128/#129/#130/#126 exact claims were inspected; none owns the clone setup screen or these new clone-onboarding-specific files.

Additional exact owned paths:
- apps/mobile/lib/src/agents/clone_onboarding.dart
- apps/mobile/lib/src/agents/clone_onboarding_transport.dart
- apps/mobile/lib/src/state/clone_onboarding_controller.dart
- apps/mobile/lib/src/screens/settings/clone_setup_screen.dart
- apps/mobile/test/clone_onboarding_test.dart
- apps/mobile/test/clone_onboarding_transport_test.dart

Replace direct one-shot clone creation with saved draft/review/exact-confirm/resume/open flow. Use the existing normal ApiClient session/interceptor and RequestId helper. Do not edit shared providers, session state, router, masanawa_transport.dart, Gateway app/main, crypto finance, billing or admin files. Required service registration still belongs to shared composition; keep the registrar/appFactory seam usable and publish precise integration dependency.

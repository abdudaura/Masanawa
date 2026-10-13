# AF05 voice-note completion — 2026-10-13

Recovery source: unmerged branch `lane/af05-android-voice-repair-20261012` head `d9ec3a3c60d2`. Exact owner-recovery claim `af05-voice-notes-recovery-20261013`.

Connected customer journey: Chats → open Masana → microphone → local encrypted-platform/private-app recording → stop/preview → authenticated send through existing `AiChatController.sendAttachment` → agent transport and durable offline queue. Cancel/background/account switch disposes recording; send passes owner generation check. The distinct app-bar **Call** button retains real LiveKit/Gemini voice flow and any billing/admission policies. No new provider, payment ledger, native manifest, or route.

The gateway live call token HTTP receive timeout is expanded from 15 to 30 seconds, above the server's 20-second minting deadline. No unbounded retries or remints are introduced.

Validation: run `flutter test --no-pub test/voice_note_recorder_test.dart test/voice_note_composer_test.dart test/ai_chat_voice_actions_test.dart test/audio_failure_test.dart test/call_lifecycle_reporter_test.dart`; focused analyzer through `.github/workflows/mobile-voice-note-regression.yml`. Source created here must not be called device/provider verified. Follow current main for the exact merge SHA and CI evidence. Real microphone/M4A/receipts/device and official provider qualification still required.

# Mobile shell recovery continuation

Owner: Android shell continuation window, explicitly assigned by the user on 2026-10-04 to analyze and carry on the unfinished shell window.
Branch: work/mobile-shell-recovery-20261004
Base: PR #104 at 6fa3d8dea1ada3131e8f1c5126002104b4944c0f.

Continues #104 without overwriting its branch. Exact owned paths: apps/mobile/lib/main.dart; apps/mobile/lib/src/core/mobile_push.dart; apps/mobile/lib/src/core/live_voice_session.dart; apps/mobile/lib/src/core/live_pcm_audio.dart; apps/mobile/lib/src/core/shell_deep_link.dart; apps/mobile/lib/src/core/pending_deep_link.dart; apps/mobile/test/shell_deep_link_test.dart; apps/mobile/android/app/src/main/kotlin/ng/unigeria/unigeria/MainActivity.kt; docs/MOBILE-SHELL-RECOVERY.md; this claim. Also owns apps/mobile/android/app/src/main/AndroidManifest.xml; apps/mobile/test/live_pcm_audio_test.dart; apps/mobile/test/live_voice_session_test.dart. Also owns apps/mobile/lib/src/state/ai_chat_state.dart for push registration and connection-generation guards only. Additional paths require a recorded update before editing.

No Commerce, Teaching, channel, Gateway, migration, deployment or root-config ownership is claimed. User assignment is the continuation authority; PR #104 remains the integration dependency. Findings: initial push links emitted before app subscribes; foreground pushes navigate immediately; OS links have no native Dart delivery; Live audio restarts AudioTrack for every chunk; async socket events can overlap; mute before setup does not persist; call interruptions are not subscribed.

Status: implementation review complete; 11 Flutter regression cases added but not executable here (Flutter missing, command exit 127). Delimiter/conflict-marker scan and Android XML parse passed. See docs/MOBILE-SHELL-RECOVERY.md for findings, changes, build commands and device acceptance. PR #125 is stacked on #104 and remains draft; no main merge/deployment/APK qualification is claimed.

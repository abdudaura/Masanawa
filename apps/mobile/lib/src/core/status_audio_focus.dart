import 'package:audio_session/audio_session.dart';

/// Focus admission for user-initiated Status audio. Uses the system audio
/// session, never a second recorder or Masana call. Playback remains paused
/// when the OS interrupts focus or the app backgrounds.
class StatusAudioFocus {
  const StatusAudioFocus._();

  static Future<void> prepare({
    required bool Function() isAccountCurrent,
  }) async {
    if (!isAccountCurrent()) {
      throw StateError('account_changed');
    }
    final session = await AudioSession.instance;
    if (!isAccountCurrent()) {
      throw StateError('account_changed');
    }
    // Spoken posts need speech focus; never silently route through an active
    // microphone/voice-call session. Native interruptions pause the player.
    await session.configure(const AudioSessionConfiguration.speech());
    if (!isAccountCurrent() || !await session.setActive(true)) {
      throw StateError('audio_focus_unavailable');
    }
  }
}

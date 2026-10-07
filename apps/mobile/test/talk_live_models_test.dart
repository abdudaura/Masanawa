import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/talks/talk_live.dart';

void main() {
  test('live session preserves backend audio authority', () {
    final session = TalkLiveSessionView.fromJson({
      'sessionId': 'talk-live_12345678',
      'talkId': 'talk-1',
      'role': 'host',
      'state': 'live',
      'canPublishAudio': true,
      'canHearAudio': true,
      'aiGenerationAllowed': true,
      'reconnectGraceEndsAt': null,
    });

    expect(session.role, TalkLiveRole.host);
    expect(session.canPublishAudio, isTrue);
    expect(session.canHearAudio, isTrue);
    expect(session.aiGenerationAllowed, isTrue);
  });

  test('LiveKit credentials parse server snake_case exactly', () {
    final credentials = TalkLiveMediaCredentials.fromJson({
      'server_url': 'wss://live.example.test',
      'participant_token': 'token',
      'room_name': 'talk-1',
      'participant_identity': 'user:session',
      'expires_at': '2030-01-01T00:00:00Z',
    });

    expect(credentials.serverUrl, 'wss://live.example.test');
    expect(credentials.participantToken, 'token');
    expect(credentials.roomName, 'talk-1');
    expect(credentials.participantIdentity, 'user:session');
  });
}

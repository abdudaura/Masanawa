import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/talks/talk_live.dart';

const _host = <String, dynamic>{
  'sessionId': 'talk-live_valid-session',
  'talkId': 'talk-1',
  'role': 'host',
  'state': 'live',
  'canHearAudio': true,
  'canPublishAudio': true,
  'aiGenerationAllowed': true,
};

void main() {
  test('explicit current Host grants preserve normal microphone and AI state', () {
    final host = TalkLiveSessionView.fromJson(_host);
    expect(host.state, TalkLiveLifecycle.live);
    expect(host.role, TalkLiveRole.host);
    expect(host.canHearAudio, isTrue);
    expect(host.canPublishAudio, isTrue);
    expect(host.aiGenerationAllowed, isTrue);
  });

  test('unknown, missing, empty or malformed lifecycle never becomes live', () {
    for (final badState in <Object?>[null, '', 'liv', 'disconnected', 42, true]) {
      final session =
          TalkLiveSessionView.fromJson({..._host, 'state': badState});
      expect(session.state, TalkLiveLifecycle.ended, reason: '$badState');
      expect(session.canHearAudio, isFalse, reason: '$badState');
      expect(session.canPublishAudio, isFalse, reason: '$badState');
      expect(session.aiGenerationAllowed, isFalse, reason: '$badState');
    }
  });

  test('missing or mistyped hearing grant denies every elevated permission', () {
    for (final badGrant in <Object?>[null, false, 'true', 1]) {
      final host =
          TalkLiveSessionView.fromJson({..._host, 'canHearAudio': badGrant});
      expect(host.canHearAudio, isFalse);
      expect(host.canPublishAudio, isFalse);
      expect(host.aiGenerationAllowed, isFalse);
    }
  });

  test('unknown role and listener cannot publish even if response says yes', () {
    for (final role in <Object?>['listener', 'unknown', null, 3]) {
      final participant = TalkLiveSessionView.fromJson({..._host, 'role': role});
      expect(participant.canPublishAudio, isFalse);
      expect(participant.aiGenerationAllowed, isFalse);
    }
    final speaker = TalkLiveSessionView.fromJson({
      ..._host, 'role': 'speaker',
    });
    expect(speaker.canPublishAudio, isTrue);
    expect(speaker.aiGenerationAllowed, isFalse);
  });

  test('reconnecting or revoked sessions cannot retain microphone rights', () {
    final reconnecting = TalkLiveSessionView.fromJson({
      ..._host,
      'state': 'reconnecting',
    });
    expect(reconnecting.state, TalkLiveLifecycle.reconnecting);
    expect(reconnecting.canHearAudio, isTrue);
    expect(reconnecting.canPublishAudio, isFalse);
    expect(reconnecting.aiGenerationAllowed, isFalse);

    for (final sessionId in <Object?>[null, '', 'wrong-prefix', 12]) {
      final session = TalkLiveSessionView.fromJson({
        ..._host, 'sessionId': sessionId,
      });
      expect(session.canHearAudio, isFalse);
      expect(session.canPublishAudio, isFalse);
      expect(session.aiGenerationAllowed, isFalse);
    }
    expect(
      TalkLiveSessionView.fromJson({..._host, 'talkId': ''}).canPublishAudio,
      isFalse,
    );
  });

  test('partial Talk room state never indicates an active Host or AI stage', () {
    final unknown = TalkLiveStateView.fromJson({
      'talkId': 'talk-1',
      'state': 'unrecognized',
      'hostConnected': true,
      'aiGenerationAllowed': true,
      'listenerCount': -5,
    });
    expect(unknown.state, TalkLiveLifecycle.ended);
    expect(unknown.hostConnected, isFalse);
    expect(unknown.aiGenerationAllowed, isFalse);
    expect(unknown.listenerCount, 0);

    final missingHost = TalkLiveStateView.fromJson({
      'talkId': 'talk-1',
      'state': 'live',
      'hostConnected': false,
      'aiGenerationAllowed': true,
      'listenerCount': 'infinite',
    });
    expect(missingHost.aiGenerationAllowed, isFalse);
    expect(missingHost.listenerCount, 0);

    final valid = TalkLiveStateView.fromJson({
      'talkId': 'talk-1',
      'state': 'live',
      'hostConnected': true,
      'aiGenerationAllowed': true,
      'listenerCount': 3,
    });
    expect(valid.aiGenerationAllowed, isTrue);
    expect(valid.listenerCount, 3);
  });
}

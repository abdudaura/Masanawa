import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/shell_deep_link.dart';
import 'package:masanawa/src/calls/call_history.dart';

void main() {
  const id = '9db005b8-7126-4f11-a12a-7b48c1e02812';
  test('incoming hints route only validated metadata', () {
    expect(
      shellDeepLinkRoute(Uri.parse('masanawa://calls/incoming/$id')),
      '/calls/incoming/$id',
    );
    for (final raw in [
      'masanawa://calls/incoming/bad',
      'masanawa://calls/incoming/$id?token=secret',
      'masanawa://calls/incoming/$id/extra',
      'masanawa://user@calls/incoming/$id',
    ]) {
      expect(shellDeepLinkRoute(Uri.parse(raw)), isNull);
    }
  });
  test('incoming missed records retain server history identity', () {
    final item = CallHistoryItem.fromJson({
      'callId': id,
      'characterId': 'character_test',
      'displayName': 'Masana',
      'state': 'missed',
      'direction': 'incoming',
      'kind': 'audio',
      'createdAt': '2026-10-12T12:00:00Z',
    });
    expect(item.callId, id);
    expect(item.incoming, isTrue);
    expect(item.missed, isTrue);
  });
  test('duplicate or new incoming routes cannot replace ongoing calls', () {
    for (final target in ['/calls/incoming/$id', '/calls/incoming/another']) {
      expect(
        canOpenIncomingCallRoute(
          currentPath: '/calls/incoming/$id',
          targetPath: target,
        ),
        isFalse,
      );
      expect(
        canOpenIncomingCallRoute(
          currentPath: '/chat/character_test',
          targetPath: target,
        ),
        isFalse,
      );
      expect(
        canOpenIncomingCallRoute(
          currentPath: '/home',
          targetPath: target,
          hasActiveCall: true,
        ),
        isFalse,
      );
      expect(
        canOpenIncomingCallRoute(currentPath: '/home', targetPath: target),
        isTrue,
      );
    }
    expect(
      canOpenIncomingCallRoute(
        currentPath: '/calls/incoming/$id',
        targetPath: '/home',
        hasActiveCall: true,
      ),
      isTrue,
    );
    expect(
      shellDeepLinkRoute(Uri.parse('masana://calls/incoming/$id')),
      isNull,
    );
  });
}

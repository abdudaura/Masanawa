import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/shell_deep_link.dart';
import 'package:masanawa/src/core/pending_deep_link.dart';

void main() {
  test('chat and work links resolve to the canonical conversation', () {
    expect(shellDeepLinkRoute(Uri.parse('masanawa://chat/character_abc')),
        '/chat/character_abc');
    expect(shellDeepLinkRoute(Uri.parse(
        'masanawa://work/work_123?characterId=character_abc')),
        '/chat/character_abc');
  });

  test('public Twin links resolve through the privacy-aware Twin lookup route', () {
    expect(
      shellDeepLinkRoute(Uri.parse('https://masanawa.com/twin/amina_bello')),
      '/twin/amina_bello',
    );
    expect(
      shellDeepLinkRoute(Uri.parse('masanawa://twin/amina_bello')),
      '/twin/amina_bello',
    );
  });

  test('rejects foreign schemes, credentials, ports and malformed identities', () {
    for (final raw in [
      'https://chat/character_abc',
      'https://evil.example/twin/amina_bello',
      'https://user@masanawa.com/twin/amina_bello',
      'https://masanawa.com:444/twin/amina_bello',
      'https://masanawa.com/twin/ab',
      'https://masanawa.com/twin/amina/bello',
      'masanawa://evil/character_abc',
      'masanawa://user@chat/character_abc',
      'masanawa://chat:42/character_abc',
      'masanawa://chat/character_',
      'masanawa://chat/character_a%2Fb',
      'masanawa://chat/character_abc/extra',
      'masanawa://twin/ab',
      'masanawa://twin/amina/bello',
    ]) {
      expect(shellDeepLinkRoute(Uri.parse(raw)), isNull, reason: raw);
    }
  });

  test('resource link without a conversation opens the conversation list', () {
    expect(shellDeepLinkRoute(Uri.parse('masanawa://approval/approval_123')),
        '/chats');
  });

  test('cold-start link waits for authentication and consumes once', () {
    final pending = PendingDeepLink();
    pending.offer(Uri.parse('masanawa://chat/character_abc'));
    expect(pending.take(ready: false), isNull);
    expect(pending.take(ready: true)?.path, '/character_abc');
    expect(pending.take(ready: true), isNull);
  });

  test('cold-start public Twin link also waits for authentication', () {
    final pending = PendingDeepLink();
    pending.offer(Uri.parse('https://masanawa.com/twin/amina_bello'));
    expect(pending.take(ready: false), isNull);
    expect(
      shellDeepLinkRoute(pending.take(ready: true)!),
      '/twin/amina_bello',
    );
    expect(pending.take(ready: true), isNull);
  });

  test('invalid incoming links cannot replace a pending destination', () {
    final pending = PendingDeepLink();
    pending.offer(Uri.parse('masanawa://chat/character_abc'));
    pending.offer(Uri.parse('https://evil.example'));
    expect(pending.take(ready: true)?.path, '/character_abc');
    pending.offer(Uri.parse('masanawa://chat/character_xyz'));
    pending.clear();
    expect(pending.take(ready: true), isNull);
  });
}

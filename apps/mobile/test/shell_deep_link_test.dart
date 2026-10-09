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

  test('public Talk links resolve to the canonical Talk route', () {
    expect(
      shellDeepLinkRoute(Uri.parse('https://masanawa.com/talk/talk-123')),
      '/talk/talk-123',
    );
    expect(
      shellDeepLinkRoute(Uri.parse('masanawa://talk/talk-123')),
      '/talk/talk-123',
    );
  });

  test('human DM links remain opaque and require server-authorized membership', () {
    const id = '104329db-0d8c-48a9-bc37-a9f56311e17d';
    expect(shellDeepLinkRoute(Uri.parse('masanawa://messages/$id')),
        '/messages/$id');
    expect(shellDeepLinkRoute(Uri.parse('https://masanawa.com/messages/$id')),
        '/messages/$id');
    for (final raw in [
      'masanawa://messages/not-an-id',
      'masanawa://messages/$id/another',
      'masanawa://messages/$id?user=another',
      'https://evil.example/messages/$id',
      'https://masanawa.com/messages/$id?token=bad',
      'masanawa://messages/$id#secret',
      'masanawa://chat/$id',
    ]) {
      expect(shellDeepLinkRoute(Uri.parse(raw)), isNull, reason: raw);
    }
  });

  test('owner request notification opens the Activity tab', () {
    expect(
      shellDeepLinkRoute(Uri.parse('masanawa://activity')),
      '/home?tab=activity',
    );
  });

  test('started human session link opens the private room', () {
    expect(
      shellDeepLinkRoute(
        Uri.parse(
          'masanawa://owner-session/character_abc/request_owner_123',
        ),
      ),
      '/owner-session/character_abc/request_owner_123',
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
      'https://masanawa.com/talk/ab',
      'https://masanawa.com/talk/talk-123?host=1',
      'https://masanawa.com/talk/talk%2Fsecret',
      'https://evil.example/talk/talk-123',
      'masanawa://talk/ab',
      'masanawa://talk/talk-123/extra',
      'masanawa://talk/talk-123?host=1',
      'masanawa://evil/character_abc',
      'masanawa://user@chat/character_abc',
      'masanawa://chat:42/character_abc',
      'masanawa://chat/character_',
      'masanawa://chat/character_a%2Fb',
      'masanawa://chat/character_abc/extra',
      'masanawa://twin/ab',
      'masanawa://twin/amina/bello',
      'masanawa://activity/extra',
      'masanawa://activity?request=secret',
      'masanawa://owner-session/character_abc',
      'masanawa://owner-session/character_/request_owner_123',
      'masanawa://owner-session/character_abc/bad',
      'masanawa://owner-session/character_abc/request_owner_123?secret=1',
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

  test('cold-start public Talk link also waits for authentication', () {
    final pending = PendingDeepLink();
    pending.offer(Uri.parse('https://masanawa.com/talk/talk-123'));
    expect(pending.take(ready: false), isNull);
    expect(
      shellDeepLinkRoute(pending.take(ready: true)!),
      '/talk/talk-123',
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


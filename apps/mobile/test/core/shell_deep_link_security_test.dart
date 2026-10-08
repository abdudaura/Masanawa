import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/shell_deep_link.dart';
import 'package:masanawa/src/core/pending_deep_link.dart';

void main() {
  group('trusted route admission for untrusted Android intents', () {
    test('accepted public links only lead to typed read-only destinations', () {
      expect(shellDeepLinkRoute(Uri.parse('https://masanawa.com/twin/abc123')),
          '/twin/abc123');
      expect(shellDeepLinkRoute(Uri.parse('https://masanawa.com/talk/talk_123')),
          '/talk/talk_123');
      expect(shellDeepLinkRoute(Uri.parse('masanawa://chat/character_abc')),
          '/chat/character_abc');
      expect(shellDeepLinkRoute(Uri.parse('masanawa://approval?characterId=character_abc')),
          '/chat/character_abc');
      expect(shellDeepLinkRoute(Uri.parse('masanawa://approval')), '/chats');
    });

    test('explicit default HTTPS port normalizes to the same origin', () {
      expect(shellDeepLinkRoute(Uri.parse('https://masanawa.com:443/twin/abc123')), '/twin/abc123');
    });

    test('no cross-domain, credential, fragment or alternate port links', () {
      for (final raw in [
        'http://masanawa.com/twin/abc123',
        'https://evil.example/twin/abc123',
        'https://masanawa.com.evil.example/twin/abc123',
        'https://user@masanawa.com/twin/abc123',
        'https://masanawa.com/twin/abc123#payload',
        'https://masanawa.com/twin/abc123?anything=1',
        'https://masanawa.com/twin/abc123?',
        'https://masanawa.com/talk/a/b',
        'masanawa://chat/character_abc?next=/wallet',
      ]) {
        expect(shellDeepLinkRoute(Uri.parse(raw)), isNull, reason: raw);
      }
    });

    test('duplicate or unrelated custom query parameters cannot navigate', () {
      for (final raw in [
        'masanawa://approval?characterId=character_a&characterId=character_b',
        'masanawa://work?unknown=true',
        'masanawa://artifact?characterId=character_a&other=1',
        'masanawa://approval?characterId=',
        'masanawa://approval?',
        'masanawa://chat/character_a?',
        'masanawa://activity?tab=wallet',
        'masanawa://owner-session/character_abc/request123?x=1',
      ]) {
        expect(shellDeepLinkRoute(Uri.parse(raw)), isNull, reason: raw);
      }
    });

    test('pending link does not retain rejected intents and clears on logout', () {
      final pending = PendingDeepLink();
      pending.offer(Uri.parse('masanawa://approval?untrusted=true'));
      expect(pending.take(ready: true), isNull);
      pending.offer(Uri.parse('https://masanawa.com/twin/public123'));
      expect(pending.take(ready: false), isNull);
      pending.clear();
      expect(pending.take(ready: true), isNull);
      pending.offer(Uri.parse('masanawa://chat/character_abc'));
      expect(pending.take(ready: true)?.toString(), 'masanawa://chat/character_abc');
      expect(pending.take(ready: true), isNull);
    });
  });
}

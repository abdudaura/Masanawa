import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/channel_linking/assistant_link_transport.dart';

void main() {
  group('U26 trusted provider destinations', () {
    test('allows only exact official WhatsApp/TG URL shapes', () {
      expect(trustedAssistantDestination(
        Uri.parse('https://wa.me/2347000000100'), AssistantChannel.whatsapp), isTrue);
      expect(trustedAssistantDestination(
        Uri.parse('https://t.me/MasanawaBot'), AssistantChannel.telegram), isTrue);
      for (final bad in [
        'http://wa.me/2347000000100',
        'https://wa.me.evil.com/2347000000100',
        'https://wa.me/2347000000100?text=send%20code',
        'https://evil.com@wa.me/2347000000100',
        'https://wa.me:444/2347000000100',
        'https://wa.me/+2347000000100',
      ]) {
        expect(trustedAssistantDestination(Uri.parse(bad),
          AssistantChannel.whatsapp), isFalse, reason: bad);
      }
      expect(trustedAssistantDestination(
        Uri.parse('https://t.me/MasanawaBot?start=token'),
        AssistantChannel.telegram), isFalse);
    });

    test('rejects forged code, unapproved destination and malformed response', () {
      final base = {
        'code': 'MN-AAAAAAAAAAAAAAAAAAAAAAAA',
        'expiresAt': '2026-10-08T18:10:00Z',
        'destination': 'https://t.me/MasanawaBot',
      };
      final challenge = AssistantLinkChallenge.fromJson(base, AssistantChannel.telegram);
      expect(challenge.code, base['code']);
      expect(() => AssistantLinkChallenge.fromJson(
        {...base, 'destination': 'https://t.me.evil.invalid/bot'},
        AssistantChannel.telegram), throwsFormatException);
      expect(() => AssistantLinkChallenge.fromJson(
        {...base, 'code': 'MN-PASTE-SECRET'},
        AssistantChannel.telegram), throwsFormatException);
    });

    test('parses linked state without requiring personal provider identifier', () {
      final result = LinkedAssistantChannel.fromJson({
        'channel': 'whatsapp',
        'linked': true,
        'preferred': false,
        'pendingUntil': null,
      });
      expect(result.channel, AssistantChannel.whatsapp);
      expect(result.linked, isTrue);
      expect(result.preferred, isFalse);
      expect(result.pendingUntil, isNull);
    });
  });
}

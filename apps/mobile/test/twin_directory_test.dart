import 'package:flutter_test/flutter_test.dart';
import 'package:unigeria/src/agents/twin_directory.dart';

void main() {
  test('parses privacy-safe free-text public twin projection', () {
    final twin = TwinDirectoryEntry.fromJson({
      'characterId': 'character-1',
      'publicId': 'amina-bello',
      'displayName': 'Amina Bello',
      'headline': 'Ask my twin',
      'avatarUrl': null,
      'representationLabel': 'AI twin',
      'ownerPresence': 'not-present',
      'textChatMode': 'free',
    });

    expect(twin.publicId, 'amina-bello');
    expect(twin.freeTextChat, isTrue);
    expect(twin.ownerPresent, isFalse);
    expect(twin.representationLabel, 'AI twin');
  });

  test('fails closed if server tries to blur owner presence or charge text', () {
    Map<String, dynamic> payload() => {
      'characterId': 'character-1',
      'publicId': 'amina-bello',
      'displayName': 'Amina Bello',
      'headline': '',
      'representationLabel': 'AI twin',
      'ownerPresence': 'not-present',
      'textChatMode': 'free',
    };

    expect(
      () => TwinDirectoryEntry.fromJson(
        payload()..['ownerPresence'] = 'present',
      ),
      throwsFormatException,
    );
    expect(
      () => TwinDirectoryEntry.fromJson(
        payload()..['textChatMode'] = 'paid',
      ),
      throwsFormatException,
    );
  });
}

import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/agents/twin_directory.dart';

void main() {
  test('parses a public twin directory entry', () {
    final twin = TwinDirectoryEntry.fromJson({
      'publicId': 'abdullahi',
      'characterId': 'character-1',
      'displayName': 'Abdullahi Nasir',
      'bio': 'Technology and business',
      'languages': ['English', 'Hausa'],
      'voiceEnabled': true,
      'ownerAccessEnabled': true,
      'publicUrl': 'https://masanawa.com/abdullahi',
    });

    expect(twin.publicId, 'abdullahi');
    expect(twin.initials, 'AN');
    expect(twin.voiceEnabled, isTrue);
    expect(twin.ownerAccessEnabled, isTrue);
  });

  test('directory ignores social-feed metadata instead of exposing it', () {
    final twin = TwinDirectoryEntry.fromJson({
      'publicId': 'amina',
      'characterId': 'character-2',
      'displayName': 'Amina',
      'bio': '',
      'languages': ['Hausa'],
      'voiceEnabled': false,
      'ownerAccessEnabled': false,
      'likes': 1200,
      'followers': 9000,
      'posts': [],
    });

    expect(twin.displayName, 'Amina');
  });
}

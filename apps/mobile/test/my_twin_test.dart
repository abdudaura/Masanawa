import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/agents/twin_profile.dart';

void main() {
  test('parses the compact My Twin profile projection', () {
    final profile = TwinProfile.fromJson({
      'hasTwin': true,
      'characterId': 'character-1',
      'displayName': 'Abdullahi Nasir',
      'bio': 'Technology and business',
      'publicUrl': 'https://masanawa.com/abdullahi',
      'discoverable': true,
      'voiceEnabled': true,
      'ownerAccessEnabled': true,
      'languages': ['English', 'Hausa'],
      'summary': {
        'visitors': 12,
        'conversations': 7,
        'earningsCredits': 850,
        'pendingOwnerRequests': 2,
      },
    });

    expect(profile.initials, 'AN');
    expect(profile.discoverable, isTrue);
    expect(profile.summary.earningsCredits, 850);
    expect(profile.languages, ['English', 'Hausa']);
  });

  test('does not expose skill/workflow configuration in the profile model', () {
    final profile = TwinProfile.fromJson({
      'hasTwin': true,
      'characterId': 'character-1',
      'displayName': 'Amina',
      'bio': '',
      'publicUrl': null,
      'discoverable': false,
      'voiceEnabled': false,
      'ownerAccessEnabled': false,
      'languages': [],
      'skillVersionIds': ['hidden-internal-value'],
      'summary': {
        'visitors': 0,
        'conversations': 0,
        'earningsCredits': 0,
        'pendingOwnerRequests': 0,
      },
    });

    expect(profile.displayName, 'Amina');
  });
}

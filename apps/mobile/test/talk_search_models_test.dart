import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/search/talk_search.dart';

void main() {
  test('search projection preserves Talk People and persona identity', () {
    final results = TalkSearchResults.fromJson({
      'talks': [
        {
          'id': 'talk-1',
          'title': 'A Talk',
          'hostName': 'Musa',
          'isLive': true,
          'listenerCount': 10,
        },
      ],
      'people': [
        {
          'handle': 'amina',
          'displayName': 'Amina',
          'isLive': false,
        },
      ],
      'personas': [
        {
          'publicId': 'economist',
          'displayName': 'Economist',
          'kind': 'expert',
          'seatFeeLabel': '₦300',
          'isAvailable': true,
          'isVerified': true,
        },
        {
          'publicId': 'amina-twin',
          'displayName': 'Amina Twin',
          'kind': 'twin',
          'seatFeeLabel': '₦450',
          'isAvailable': true,
        },
      ],
    });

    expect(results.talks.single.id, 'talk-1');
    expect(results.people.single.handle, 'amina');
    expect(results.personas.first.kind, TalkSearchPersonaKind.expert);
    expect(results.personas.last.kind, TalkSearchPersonaKind.twin);
  });
}

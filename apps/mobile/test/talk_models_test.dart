import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/talks/talk_models.dart';

void main() {
  test('Talk projection preserves viewer Host role', () {
    final talk = TalkDiscoveryItem.fromJson({
      'id': 'talk-1',
      'title': 'A live Talk',
      'hostName': 'Amina',
      'isLive': true,
      'listenerCount': 5,
      'viewerIsHost': true,
    });

    expect(talk.viewerIsHost, isTrue);
  });
}

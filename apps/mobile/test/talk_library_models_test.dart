import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/library/talk_library.dart';

void main() {
  test('My Talks projection separates live replay and draft state', () {
    final view = MyTalksView.fromJson({
      'live': [
        {
          'id': 'live-1',
          'title': 'Live',
          'hostName': 'You',
          'isLive': true,
          'listenerCount': 2,
          'viewerIsHost': true,
        },
      ],
      'replays': [
        {
          'id': 'replay-1',
          'title': 'Replay',
          'hostName': 'You',
          'isLive': false,
          'listenerCount': 5,
          'viewerIsHost': true,
        },
      ],
      'drafts': [
        {
          'id': 'draft-1',
          'topic': 'Draft topic',
          'updatedAt': '2026-10-07T09:00:00Z',
        },
      ],
    });

    expect(view.live.single.id, 'live-1');
    expect(view.live.single.viewerIsHost, isTrue);
    expect(view.replays.single.id, 'replay-1');
    expect(view.drafts.single.id, 'draft-1');
  });
}

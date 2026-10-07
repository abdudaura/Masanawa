import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/activity/talk_activity.dart';

void main() {
  test('parses sponsored AI Seat activity without losing Talk target', () {
    final item = TalkActivityItem.fromJson({
      'id': 'activity-1',
      'kind': 'ai_seat_sponsored',
      'title': 'Economist sponsored',
      'detail': 'A listener wants to add the Economist.',
      'createdAt': '2026-10-07T08:00:00Z',
      'talkId': 'talk-1',
      'amountLabel': '₦300',
      'requiresAction': true,
      'actionLabel': 'Review',
      'unread': true,
    });

    expect(item.kind, TalkActivityKind.aiSeatSponsored);
    expect(item.talkId, 'talk-1');
    expect(item.amountLabel, '₦300');
    expect(item.requiresAction, isTrue);
    expect(item.unread, isTrue);
  });

  test('unknown kinds remain safe platform activity', () {
    final item = TalkActivityItem.fromJson({
      'id': 'activity-2',
      'kind': 'future_event',
      'title': 'Update',
      'detail': 'Something changed.',
      'createdAt': '2026-10-07T08:00:00Z',
    });

    expect(item.kind, TalkActivityKind.platform);
  });
}

import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/features/notifications/notification_repository.dart';

void main() {
  final now = DateTime.utc(2026, 10, 10).toIso8601String();
  Map<String, dynamic> notice({String type = 'room_answer', String target = 'room'}) => {
    'id': 'ntf_1', 'kind': type, 'targetKind': target,
    'targetId': 'room_1', 'title': 'Answer ready', 'body': 'Your question was answered',
    'createdAt': now, 'readAt': null,
  };
  test('server page parses a typed target and unread state', () {
    final page = FanNoticePage.fromJson({'items': [notice()], 'nextCursor': null});
    expect(page.items.single.kind, NoticeKind.roomAnswer);
    expect(page.items.single.unread, isTrue);
    expect(page.items.single.copyRead().unread, isFalse);
  });
  test('unknown kind and mismatched target fail closed', () {
    expect(() => FanNotice.fromJson(notice(type: 'human_message')), throwsFormatException);
    expect(() => FanNotice.fromJson(notice(target: 'wallet')), throwsFormatException);
  });
  test('malformed server response is rejected', () {
    expect(() => FanNoticePage.fromJson({'items': 'not a list'}), throwsFormatException);
    expect(() => FanNotice.fromJson({...notice(), 'body': ''}), throwsFormatException);
  });
}

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/features/notifications/notification_repository.dart';
import 'package:masanawa/src/features/notifications/notifications_screen.dart';

class FakeTransport implements FanNotificationTransport {
  FakeTransport(this.ownerAccountId);
  @override
  final String ownerAccountId;
  bool active = true;
  int reads = 0;
  int marked = 0;
  bool throwOnRead = false;

  @override
  bool get isCurrentAccount => active;
  @override
  Future<FanNoticePage> list({String? cursor}) async {
    ++reads;
    if (throwOnRead) throw StateError('offline');
    return FanNoticePage([
      FanNotice(id: 'ntf1', kind: NoticeKind.roomAnswer,
        targetKind: 'room', targetId: 'r1', title: 'Answer ready',
        body: 'A Masana answered your question.',
        createdAt: DateTime.utc(2026,10,10)),
    ], null);
  }
  @override
  Future<void> markRead(String id) async { ++marked; }
}

void main() {
  testWidgets('loading to inbox to mark-read and navigation', (tester) async {
    final t = FakeTransport('u1');
    var navigated = '';
    await tester.pumpWidget(MaterialApp(home: FanNotificationsScreen(
      transport: t, onOpenTarget: (kind, id) => navigated = '$kind:$id')));
    await tester.pumpAndSettle();
    expect(find.text('Answer ready'), findsOneWidget);
    await tester.tap(find.text('Answer ready'));
    await tester.pumpAndSettle();
    expect(t.marked, 1);
    expect(navigated, 'room:r1');
  });
  testWidgets('offline initial load provides retry and no fake notification', (tester) async {
    final t = FakeTransport('u1')..throwOnRead = true;
    await tester.pumpWidget(MaterialApp(home: FanNotificationsScreen(transport: t)));
    await tester.pumpAndSettle();
    expect(find.text('Notifications could not be refreshed.'), findsOneWidget);
    expect(find.text('Retry'), findsOneWidget);
    t.throwOnRead = false;
    await tester.tap(find.text('Retry'));
    await tester.pumpAndSettle();
    expect(find.text('Answer ready'), findsOneWidget);
  });
  testWidgets('account change clears old fan data before a new read', (tester) async {
    final original = FakeTransport('u1');
    await tester.pumpWidget(MaterialApp(home: FanNotificationsScreen(transport: original)));
    await tester.pumpAndSettle();
    expect(find.text('Answer ready'), findsOneWidget);
    final switched = FakeTransport('u2')..active = false;
    await tester.pumpWidget(MaterialApp(home: FanNotificationsScreen(transport: switched)));
    await tester.pumpAndSettle();
    expect(find.text('Answer ready'), findsNothing);
    expect(find.text('Sign in to see your notifications.'), findsOneWidget);
  });
}

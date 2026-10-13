import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/features/rooms/rooms_client.dart';
import 'package:masanawa/src/features/rooms/rooms_screen.dart';

class _PaidRooms implements RoomsClient {
  int joins = 0;
  @override Future<List<RoomInfo>> list({
    required bool joined, String query = '', String language = '',
  }) async => const [RoomInfo('room-paid', 'Masterclass', 'masana-1', 'en', 1, true, false)];
  @override Future<RoomInfo> room(String id) async =>
      const RoomInfo('room-paid', 'Masterclass', 'masana-1', 'en', 1, true, false);
  @override Future<void> join(String id) async { joins++; }
  @override Future<void> leave(String id) async {}
  @override Future<RoomQuestion> ask(String id, String text, String key) async =>
      const RoomQuestion('question-1', 'Test', 'pending', null);
  @override Future<List<RoomQuestion>> questions(String id) async => const [];
  @override Future<List<RoomLesson>> lessons(String id) async => const [];
}

void main() {
  testWidgets('unqualified paid Room cannot start checkout or join', (tester) async {
    final rooms = _PaidRooms();
    await tester.pumpWidget(MaterialApp(
      home: RoomHomeScreen(client: rooms, id: 'room-paid'),
    ));
    await tester.pumpAndSettle();
    final button = tester.widget<FilledButton>(
      find.widgetWithText(FilledButton, 'Subscription unavailable'),
    );
    expect(button.onPressed, isNull);
    expect(rooms.joins, 0);
    expect(find.text('Join free Room'), findsNothing);
    expect(find.text('A verified subscription is required to access lessons and questions'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

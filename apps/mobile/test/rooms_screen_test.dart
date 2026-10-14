import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/api/models.dart';
import 'package:masanawa/src/features/rooms/rooms_client.dart';
import 'package:masanawa/src/screens/rooms/rooms_screen.dart';
import 'package:masanawa/src/state/session_state.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

const _user = AuthUser(
  id: 'fan-a', name: 'Fan A', locale: 'en', status: 'ACTIVE',
  role: 'fan', isNewUser: false, createdAt: '2026-10-13T00:00:00Z',
);

class _Session extends SessionController {
  @override
  SessionState build() => const SessionSignedIn(
    _user,
    AuthTokens(
      accessToken: 'test-access', refreshToken: 'test-refresh',
      accessExpiresIn: 900, user: _user,
    ),
  );

  void switchTo(String owner) {
    final user = AuthUser(
      id: owner, name: 'Other Fan', locale: 'en', status: 'ACTIVE',
      role: 'fan', isNewUser: false, createdAt: '2026-10-13T00:00:00Z',
    );
    state = SessionSignedIn(user, AuthTokens(
      accessToken: 'another-access', refreshToken: 'another-refresh',
      accessExpiresIn: 900, user: user,
    ));
  }
}

class _Rooms implements RoomsClient {
  bool offline = false;
  bool joined = false;
  String title = 'Mathematics';
  int reads = 0, joins = 0;
  Completer<List<RoomInfo>>? firstRequest;

  @override
  Future<List<RoomInfo>> list({
    required bool joined, String query = '', String language = '',
  }) async {
    reads++;
    if (reads == 1 && firstRequest != null) return firstRequest!.future;
    if (offline) throw StateError('unavailable');
    return [RoomInfo('room-math', title, 'masana-teacher', 'en', 4, false, this.joined)];
  }

  @override
  Future<RoomInfo> room(String id) async =>
      RoomInfo(id, title, 'masana-teacher', 'en', 4, false, joined);

  @override
  Future<void> join(String id) async { joins++; joined = true; }

  @override
  Future<void> leave(String id) async { joined = false; }

  @override
  Future<RoomQuestion> ask(String id, String text, String key) async =>
      RoomQuestion('question-1', text, 'pending', null);

  @override
  Future<List<RoomQuestion>> questions(String id) async => const [];

  @override
  Future<List<RoomLesson>> lessons(String id) async => const [
    RoomLesson('room-lesson_12345678', 'Introduction to algebra', 'lesson'),
  ];
}

Future<ProviderContainer> _mount(WidgetTester tester, _Rooms rooms) async {
  await tester.pumpWidget(ProviderScope(
    overrides: [
      sessionProvider.overrideWith(_Session.new),
      roomsClientProvider.overrideWithValue(rooms),
    ],
    child: MaterialApp(
      theme: buildMasanawaTheme(brightness: Brightness.light),
      home: const RoomsScreen(),
    ),
  ));
  await tester.pumpAndSettle();
  return ProviderScope.containerOf(tester.element(find.byType(RoomsScreen)));
}

void main() {
  testWidgets('canonical Rooms open a single chat without lesson tabs', (tester) async {
    final rooms = _Rooms();
    await _mount(tester, rooms);
    expect(find.text('Mathematics'), findsOneWidget);
    expect(find.text('Evening gist'), findsNothing);
    expect(find.text('Create Room'), findsNothing);
    await tester.tap(find.text('Mathematics'));
    await tester.pumpAndSettle();
    expect(find.text('Join Room'), findsOneWidget);
    await tester.tap(find.text('Join Room'));
    await tester.pumpAndSettle();
    expect(rooms.joins, 1);
    expect(find.text('Start a conversation with your Masana teacher.'), findsOneWidget);
    expect(find.text('Data Bundles'), findsOneWidget);
    expect(find.text('Lessons'), findsNothing);
    expect(find.text('Questions'), findsNothing);
    expect(find.text('Discussion'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('outage is not presented as an empty Room directory', (tester) async {
    final rooms = _Rooms()..offline = true;
    await _mount(tester, rooms);
    expect(find.textContaining('Could not load.'), findsOneWidget);
    expect(find.text('No Rooms match this search.'), findsNothing);
    rooms.offline = false;
    await tester.tap(find.text('Retry'));
    await tester.pumpAndSettle();
    expect(find.text('Mathematics'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('old account response cannot repopulate the new Rooms tab', (tester) async {
    final waiting = Completer<List<RoomInfo>>();
    final rooms = _Rooms()..firstRequest = waiting;
    final container = await _mountPending(tester, rooms);
    (container.read(sessionProvider.notifier) as _Session).switchTo('fan-b');
    rooms.title = 'Chemistry';
    await tester.pump();
    await tester.pumpAndSettle();
    expect(find.text('Chemistry'), findsOneWidget);
    waiting.complete(const [
      RoomInfo('room-old', 'Fan A private Room', 'teacher-a', 'en', 3, false, true),
    ]);
    await tester.pumpAndSettle();
    expect(find.text('Fan A private Room'), findsNothing);
    expect(find.text('Chemistry'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('pushed private Room detail unmounts after account switch',
      (tester) async {
    final rooms = _Rooms()..joined = true;
    final container = await _mount(tester, rooms);
    await tester.tap(find.text('Mathematics'));
    await tester.pumpAndSettle();
    expect(find.text('Introduction to algebra'), findsOneWidget);
    (container.read(sessionProvider.notifier) as _Session).switchTo('fan-b');
    await tester.pumpAndSettle();
    expect(find.text('Start a conversation with your Masana teacher.'), findsNothing);
    expect(find.text('Session changed. Sign in to view this Room.'),
        findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('old account cannot join after identity changes', (tester) async {
    final rooms = _Rooms();
    var account = 'fan-a';
    final bound = AccountBoundRoomsClient(
      delegate: rooms, ownerAccount: 'fan-a', currentAccount: () => account,
    );
    await bound.join('room-math');
    expect(rooms.joins, 1);
    account = 'fan-b';
    await expectLater(bound.join('room-math'), throwsStateError);
    expect(rooms.joins, 1);
  });
}

Future<ProviderContainer> _mountPending(WidgetTester tester, _Rooms rooms) async {
  await tester.pumpWidget(ProviderScope(
    overrides: [
      sessionProvider.overrideWith(_Session.new),
      roomsClientProvider.overrideWithValue(rooms),
    ],
    child: MaterialApp(
      theme: buildMasanawaTheme(brightness: Brightness.light),
      home: const RoomsScreen(),
    ),
  ));
  await tester.pump();
  return ProviderScope.containerOf(tester.element(find.byType(RoomsScreen)));
}

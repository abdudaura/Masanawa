import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/calls/call_history.dart';
import 'package:masanawa/src/core/api/models.dart';
import 'package:masanawa/src/screens/calls/calls_screen.dart';
import 'package:masanawa/src/state/session_state.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

SessionSignedIn signedIn(String id) {
  final user = AuthUser(
    id: id,
    name: id,
    locale: 'en',
    status: 'ACTIVE',
    role: 'USER',
    isNewUser: false,
    createdAt: '2026-10-11T00:00:00Z',
  );
  return SessionSignedIn(
    user,
    AuthTokens(
      accessToken: 'access-$id',
      refreshToken: 'refresh-$id',
      accessExpiresIn: 3600,
      user: user,
    ),
  );
}

class _Session extends SessionController {
  @override
  SessionState build() => signedIn('account-a');
  void change(String id) => state = signedIn(id);
  void signOut() => state = const SessionSignedOut();
}

class _Transport implements CallHistoryTransport {
  _Transport(this.handler);
  final Future<CallHistoryPage> Function(String?) handler;
  @override
  Future<CallHistoryPage> loadPage({
    String? cursor,
    CancelToken? cancelToken,
  }) => handler(cursor);
}

CallHistoryPage page(String name, {String? nextCursor}) => CallHistoryPage(
  calls: [
    CallHistoryItem.fromJson({
      'callId': name,
      'characterId': 'character-$name',
      'displayName': name,
      'direction': 'outgoing',
      'kind': 'audio',
      'state': 'connecting',
      'createdAt': '2026-10-11T00:00:00Z',
      'connectedAt': null,
      'endedAt': null,
      'expiresAt': '2026-10-11T00:30:00Z',
      'connectionEvidence': null,
    }),
  ],
  nextCursor: nextCursor,
);
Future<void> _mount(
  WidgetTester tester,
  _Session session,
  CallHistoryTransport transport,
) => tester.pumpWidget(
  ProviderScope(
    overrides: [
      sessionProvider.overrideWith(() => session),
      callHistoryTransportProvider.overrideWithValue(transport),
    ],
    child: MaterialApp(
      theme: buildMasanawaTheme(brightness: Brightness.light),
      home: const CallsScreen(),
    ),
  ),
);

void main() {
  testWidgets('shows persisted history and loads the next page', (
    tester,
  ) async {
    await _mount(
      tester,
      _Session(),
      _Transport(
        (cursor) async =>
            cursor == null ? page('Amina', nextCursor: 'next') : page('Bello'),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Amina'), findsOneWidget);
    await tester.tap(find.text('Load more'));
    await tester.pumpAndSettle();
    expect(find.text('Bello'), findsOneWidget);
    expect(find.text('Amina'), findsOneWidget);
  });
  testWidgets('offers retry for a failed request', (tester) async {
    var attempts = 0;
    await _mount(
      tester,
      _Session(),
      _Transport((_) async {
        if (attempts++ == 0) throw StateError('offline');
        return page('Amina');
      }),
    );
    await tester.pumpAndSettle();
    expect(find.text('Retry'), findsOneWidget);
    await tester.tap(find.text('Retry'));
    await tester.pumpAndSettle();
    expect(find.text('Amina'), findsOneWidget);
  });
  testWidgets('discards old-account results arriving after an account switch', (
    tester,
  ) async {
    final old = Completer<CallHistoryPage>();
    var requests = 0;
    final session = _Session();
    await _mount(
      tester,
      session,
      _Transport(
        (_) => requests++ == 0
            ? old.future
            : Future.value(page('New account Masana')),
      ),
    );
    await tester.pump();
    session.change('account-b');
    await tester.pumpAndSettle();
    old.complete(page('Old account Masana'));
    await tester.pumpAndSettle();
    expect(find.text('Old account Masana'), findsNothing);
    expect(find.text('New account Masana'), findsOneWidget);
  });
  testWidgets(
    'retry after failed refresh retries the first page, not the next cursor',
    (tester) async {
      final cursors = <String?>[];
      await _mount(
        tester,
        _Session(),
        _Transport((cursor) async {
          cursors.add(cursor);
          if (cursors.length == 2) throw StateError('offline');
          return page('Amina', nextCursor: 'next');
        }),
      );
      await tester.pumpAndSettle();
      tester.state<RefreshIndicatorState>(find.byType(RefreshIndicator)).show();
      await tester.pumpAndSettle();
      await tester.tap(find.text('Retry'));
      await tester.pumpAndSettle();
      expect(cursors, [null, null, null]);
    },
  );
  testWidgets('sign-out hides existing rows and does not fetch another page', (
    tester,
  ) async {
    var requests = 0;
    final session = _Session();
    await _mount(
      tester,
      session,
      _Transport((_) async {
        requests++;
        return page('Amina');
      }),
    );
    await tester.pumpAndSettle();
    session.signOut();
    await tester.pumpAndSettle();
    expect(find.text('Amina'), findsNothing);
    expect(find.text('Sign in to see your calls.'), findsOneWidget);
    expect(requests, 1);
  });
}

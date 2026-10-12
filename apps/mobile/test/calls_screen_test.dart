import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/calls/call_history.dart';
import 'package:masanawa/src/calls/call_lifecycle_reporter.dart';
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
  _Transport(this.handler, {this.searchHandler});
  final Future<CallHistoryPage> Function(String?) handler;
  final Future<CallHistoryPage> Function(String?, String)? searchHandler;
  @override
  Future<CallHistoryPage> loadPage({
    String? cursor,
    String query = '',
    CancelToken? cancelToken,
  }) => searchHandler?.call(cursor, query) ?? handler(cursor);
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
  testWidgets('labels incoming missed history and preserves outgoing history', (tester) async {
    await _mount(tester, _Session(), _Transport((_) async => CallHistoryPage(calls: [
      CallHistoryItem(callId: 'incoming', characterId: 'masana', displayName: 'Missed Amina', state: 'missed', direction: 'incoming', createdAt: DateTime.utc(2026,10,12)),
      ...page('Outgoing Bello').calls,
    ])));
    await tester.pumpAndSettle();
    expect(find.textContaining('Missed'), findsNWidgets(2));
    expect(find.byIcon(Icons.call_missed), findsOneWidget);
    expect(find.byIcon(Icons.call_made), findsOneWidget);
    expect(find.textContaining('Connecting'), findsOneWidget);
  });

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

  testWidgets('queries all authorized pages by name and clear restores history', (tester) async {
    final queries = <String>[];
    await _mount(
      tester,
      _Session(),
      _Transport(
        (_) async => page('First page', nextCursor: 'older'),
        searchHandler: (cursor, query) async {
          queries.add('$query/$cursor');
          if (query == 'bello') return page('Bello from older page');
          return page('First page', nextCursor: 'older');
        },
      ),
    );
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '  BELLO  ');
    await tester.pump(const Duration(milliseconds: 355));
    await tester.pumpAndSettle();
    expect(find.text('Bello from older page'), findsOneWidget);
    expect(find.text('First page'), findsNothing);
    expect(queries, contains('bello/null'));
    await tester.tap(find.byIcon(Icons.clear));
    await tester.pumpAndSettle();
    expect(find.text('First page'), findsOneWidget);
    expect(queries, contains('/null'));
    expect(find.byTooltip('Call multiple Masana'), findsOneWidget);
    expect(find.byTooltip('Choose a Masana'), findsOneWidget);
  });

  testWidgets('stale query A result is fenced as soon as B is typed', (tester) async {
    final slow = Completer<CallHistoryPage>();
    final queries = <String>[];
    await _mount(
      tester,
      _Session(),
      _Transport(
        (_) async => page('Recent'),
        searchHandler: (cursor, query) {
          queries.add(query);
          if (query == 'amina') return slow.future;
          return Future.value(page('Bello'));
        },
      ),
    );
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'amina');
    await tester.pump(const Duration(milliseconds: 355));
    expect(queries, contains('amina'));
    await tester.enterText(find.byType(TextField), 'bello');
    await tester.pump();
    slow.complete(page('Amina private previous query'));
    await tester.pump();
    expect(find.text('Amina private previous query'), findsNothing);
    await tester.pump(const Duration(milliseconds: 355));
    await tester.pumpAndSettle();
    expect(queries, contains('bello'));
    expect(find.text('Bello'), findsOneWidget);
    expect(find.text('Amina private previous query'), findsNothing);
  });

  testWidgets('search distinguishes no matching calls and supports retry', (tester) async {
    var offline = true;
    await _mount(
      tester,
      _Session(),
      _Transport(
        (_) async => page('Recent'),
        searchHandler: (_, query) async {
          if (query.isEmpty) return page('Recent');
          if (query == 'absent') return const CallHistoryPage(calls: []);
          if (offline) { offline = false; throw StateError('offline'); }
          return page('Recovered');
        },
      ),
    );
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'absent');
    await tester.pump(const Duration(milliseconds: 355));
    await tester.pumpAndSettle();
    expect(find.text('No matching calls'), findsOneWidget);
    await tester.enterText(find.byType(TextField), 'recover');
    await tester.pump(const Duration(milliseconds: 355));
    await tester.pumpAndSettle();
    expect(find.text('Retry'), findsOneWidget);
    await tester.tap(find.text('Retry'));
    await tester.pumpAndSettle();
    expect(find.text('Recovered'), findsOneWidget);
  });

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
  testWidgets(
    'successful lifecycle delivery refreshes current-account recents',
    (tester) async {
      var requests = 0;
      await _mount(
        tester,
        _Session(),
        _Transport((_) async => page(++requests == 1 ? 'Before' : 'After')),
      );
      await tester.pumpAndSettle();
      expect(find.text('Before'), findsOneWidget);
      final container = ProviderScope.containerOf(
        tester.element(find.byType(CallsScreen)),
      );
      container.read(callHistoryRevisionProvider.notifier).state++;
      await tester.pumpAndSettle();
      expect(find.text('After'), findsOneWidget);
      expect(requests, 2);
      expect(find.byTooltip('Call multiple Masana'), findsOneWidget);
    },
  );
}

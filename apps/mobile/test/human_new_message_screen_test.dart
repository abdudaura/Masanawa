import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:masanawa/src/core/api/models.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/core/providers.dart';
import 'package:masanawa/src/messages/human_dm_controller.dart';
import 'package:masanawa/src/messages/human_dm_transport.dart';
import 'package:masanawa/src/messages/human_new_message_screen.dart';
import 'package:masanawa/src/state/session_state.dart';

const _owner = AuthUser(
  id: 'user_test', name: 'Viewer', locale: 'en', status: 'ACTIVE',
  role: 'USER', isNewUser: false, createdAt: '2026-10-08T00:00:00Z',
);
const _tokens = AuthTokens(
  accessToken: 'only-test-token', refreshToken: 'only-test-refresh',
  accessExpiresIn: 3600, user: _owner,
);

class _SessionForWidgetTest extends SessionController {
  @override
  SessionState build() => const SessionSignedIn(_owner, _tokens);

  void simulateLogout() => state = const SessionSignedOut();
}

class _DmTransportForWidgetTest implements HumanDmTransport {
  final List<String> opens = [];
  @override
  Future<String> open(String otherUserId) async {
    opens.add(otherUserId);
    return '104329db-0d8c-48a9-bc37-a9f56311e17d';
  }
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

Widget _app({
  required bool canMessage,
  String? contactStatus,
  required _DmTransportForWidgetTest dm,
  required List<String> paths,
  String? initialHandle,
}) {
  final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
  dio.interceptors.add(InterceptorsWrapper(onRequest: (options, handler) {
    paths.add(options.method + ' ' + options.path);
    if (options.path == '/messages/contacts') {
      handler.resolve(Response(
        requestOptions: options,
        statusCode: 200,
        data: <String, dynamic>{'contacts': []},
      ));
    } else if (options.path == '/messages/contacts/lookup/amina') {
      handler.resolve(Response(
        requestOptions: options,
        statusCode: 200,
        data: <String, dynamic>{
          'userId': 'user_am', 'handle': 'amina',
          'displayName': 'Amina',
          'status': contactStatus ?? (canMessage ? 'accepted' : 'none'),
          'requestRevision': contactStatus == 'incoming' ? '4' : null,
          'canMessage': canMessage,
        },
      ));
    } else if (options.path ==
        '/messages/contacts/requests/user_am/response') {
      handler.resolve(Response(
        requestOptions: options,
        statusCode: 200,
        data: <String, dynamic>{'status': 'accepted'},
      ));
    } else if (options.path == '/messages/contacts/requests') {
      handler.resolve(Response(
        requestOptions: options,
        statusCode: 200,
        data: <String, dynamic>{'status': 'pending'},
      ));
    } else {
      handler.reject(DioException(
        requestOptions: options,
        response: Response(requestOptions: options, statusCode: 404),
      ));
    }
  }));
  return ProviderScope(
    overrides: [
      sessionProvider.overrideWith(_SessionForWidgetTest.new),
      apiClientProvider.overrideWithValue(ApiClient(dio: dio)),
      humanDmTransportProvider.overrideWithValue(dm),
    ],
    child: MaterialApp.router(
      routerConfig: GoRouter(
        initialLocation: '/messages/new',
        routes: [
          GoRoute(path: '/messages/new',
              builder: (_, __) =>
                  HumanNewMessageScreen(initialHandle: initialHandle)),
          GoRoute(path: '/messages/:conversationId',
              builder: (_, state) => Scaffold(
                body: Text('Thread ' + state.pathParameters['conversationId']!),
              )),
        ],
      ),
    ),
  );
}

void main() {
  testWidgets('eligible exact handle opens only server-acknowledged conversation', (tester) async {
    final dm = _DmTransportForWidgetTest();
    final requests = <String>[];
    await tester.pumpWidget(_app(
      canMessage: true, dm: dm, paths: requests, initialHandle: '@amina',
    ));
    await tester.pumpAndSettle();
    expect(find.text('Amina'), findsOneWidget);
    expect(find.byKey(const ValueKey('human-contact-result')), findsOneWidget);
    expect(find.text('Message'), findsOneWidget);
    await tester.tap(find.text('Message'));
    await tester.pumpAndSettle();
    expect(dm.opens, ['user_am']);
    expect(find.text('Thread 104329db-0d8c-48a9-bc37-a9f56311e17d'),
        findsOneWidget);
    expect(requests, contains('GET /messages/contacts/lookup/amina'));
    expect(tester.takeException(), isNull);
  });

  testWidgets('ineligible contact never opens DM, sends request instead', (tester) async {
    final dm = _DmTransportForWidgetTest();
    final requests = <String>[];
    await tester.pumpWidget(_app(
      canMessage: false, dm: dm, paths: requests, initialHandle: '@amina',
    ));
    await tester.pumpAndSettle();
    expect(find.text('Message'), findsNothing);
    await tester.tap(find.text('Request contact'));
    await tester.pumpAndSettle();
    expect(dm.opens, isEmpty);
    expect(find.textContaining('Contact request recorded.'), findsOneWidget);
    expect(requests, contains('POST /messages/contacts/requests'));
    expect(tester.takeException(), isNull);
  });

  testWidgets('incoming request requires explicit accept with revision', (tester) async {
    final dm = _DmTransportForWidgetTest();
    final requests = <String>[];
    await tester.pumpWidget(_app(
      canMessage: false, contactStatus: 'incoming',
      dm: dm, paths: requests, initialHandle: '@amina',
    ));
    await tester.pumpAndSettle();
    expect(find.text('Accept'), findsOneWidget);
    expect(find.text('Decline'), findsOneWidget);
    expect(find.text('Message'), findsNothing);
    await tester.tap(find.text('Accept'));
    await tester.pumpAndSettle();
    expect(dm.opens, isEmpty);
    expect(requests, contains(
      'POST /messages/contacts/requests/user_am/response',
    ));
    expect(find.textContaining('Request accepted.'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('auth loss removes contact data and disables navigation', (tester) async {
    final dm = _DmTransportForWidgetTest();
    await tester.pumpWidget(_app(
      canMessage: true, dm: dm, paths: [], initialHandle: '@amina',
    ));
    await tester.pumpAndSettle();
    final context = tester.element(find.byType(HumanNewMessageScreen));
    (ProviderScope.containerOf(context).read(sessionProvider.notifier)
        as _SessionForWidgetTest).simulateLogout();
    await tester.pumpAndSettle();
    expect(find.text('Sign in to find private contacts.'), findsOneWidget);
    expect(find.text('Amina'), findsNothing);
    expect(dm.opens, isEmpty);
    expect(tester.takeException(), isNull);
  });
}

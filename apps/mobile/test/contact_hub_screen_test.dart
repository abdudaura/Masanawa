import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/contact_hub/contact_hub_favorites.dart';
import 'package:masanawa/src/contact_hub/human_contact_hub_screen.dart';
import 'package:masanawa/src/core/api/models.dart';
import 'package:masanawa/src/human_messages/human_dm_transport.dart';
import 'package:masanawa/src/messages/human_contacts_controller.dart';
import 'package:masanawa/src/messages/human_contacts_transport.dart';
import 'package:masanawa/src/state/session_state.dart';

const _userA = AuthUser(
  id: 'person_a', name: 'Amina', locale: 'en', status: 'ACTIVE',
  role: 'USER', isNewUser: false, createdAt: '2026-10-08T00:00:00Z',
);
const _userB = AuthUser(
  id: 'person_c', name: 'Chika', locale: 'en', status: 'ACTIVE',
  role: 'USER', isNewUser: false, createdAt: '2026-10-08T00:00:00Z',
);
const _tokensA = AuthTokens(
  accessToken: 'a', refreshToken: 'ar', accessExpiresIn: 900, user: _userA,
);
const _tokensB = AuthTokens(
  accessToken: 'b', refreshToken: 'br', accessExpiresIn: 900, user: _userB,
);

class _TestSession extends SessionController {
  @override
  SessionState build() => const SessionSignedIn(_userA, _tokensA);

  void change() => state = const SessionSignedIn(_userB, _tokensB);
  void logout() => state = const SessionSignedOut();
}

HumanContact _person(String id, String name, HumanContactStatus status,
    {bool canMessage = false}) => HumanContact(
  userId: id, handle: 'handle_$id', displayName: name, avatarUrl: null,
  status: status, canMessage: canMessage, requestRevision: '2',
  updatedAt: DateTime.utc(2026, 10, 8),
);

class _Contacts implements HumanContactsTransport {
  List<HumanContact> people = [
    _person('person_b', 'Bello', HumanContactStatus.accepted),
    _person('person_d', 'Danladi', HumanContactStatus.revoked),
    _person('person_e', 'Emeka', HumanContactStatus.incoming),
  ];
  int acceptedRequests = 0;
  int revocations = 0;

  @override
  Future<HumanContactPreferences> preferences() async =>
      const HumanContactPreferences(policy: HumanContactPolicy.requests,
          discoverableByHandle: true);

  @override
  Future<List<HumanContact>> list({int limit = 30}) async =>
      people.take(limit).toList(growable: false);

  @override
  Future<HumanContact?> lookup(String handle) async =>
      handle == 'hidden' ? null :
      _person('person_f', 'Fatima', HumanContactStatus.none);

  @override
  Future<String> request(String handle) async => 'pending';

  @override
  Future<String> respond(String requesterUserId,
      {required bool accept, required String requestRevision}) async {
    if (requestRevision != '2') throw StateError('missing revision');
    acceptedRequests++;
    people = people.map((p) => p.userId == requesterUserId
        ? _person(p.userId, p.displayName,
            accept ? HumanContactStatus.accepted : HumanContactStatus.declined)
        : p).toList();
    return accept ? 'accepted' : 'declined';
  }

  @override
  Future<void> revoke(String otherUserId) async {
    revocations++;
    people = people.map((p) => p.userId == otherUserId
        ? _person(p.userId, p.displayName, HumanContactStatus.revoked)
        : p).toList();
  }

  @override
  Future<HumanContactPreferences> updatePreferences({
      HumanContactPolicy? policy, bool? discoverableByHandle}) async =>
      preferences();
}

class _PaginatedContacts extends _Contacts
    implements HumanContactsPaginationTransport {
  final pageCursors = <String?>[];
  bool failNextPageOnce = false;

  @override
  Future<HumanContactPage> page({int limit = 50, String? cursor}) async {
    pageCursors.add(cursor);
    if (cursor == null) {
      return HumanContactPage(
        contacts: [people.first],
        nextCursor: 'next_page_1',
      );
    }
    if (cursor != 'next_page_1') throw StateError('Unknown page');
    if (failNextPageOnce) {
      failNextPageOnce = false;
      throw StateError('Offline while loading page');
    }
    return HumanContactPage(contacts: [people.last], nextCursor: null);
  }
}

class _Messages implements HumanDmTransport {
  final opened = <String>[];
  Completer<String>? pending;
  bool fail = false;

  @override
  Future<String> open(String id) async {
    opened.add(id);
    if (fail) throw StateError('not authorized');
    if (pending != null) return pending!.future;
    return 'conversation-of-$id';
  }

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      super.noSuchMethod(invocation);
}

class _Favorites implements ContactHubFavoritesStore {
  final values = <String, Set<String>>{};
  @override
  Future<Set<String>> load(String account) async =>
      Set<String>.of(values[account] ?? {});
  @override
  Future<void> save(String account, Set<String> ids) async =>
      values[account] = Set<String>.of(ids);
  @override
  Future<void> clear(String account) async { values.remove(account); }
}

Future<void> _mount(WidgetTester tester,
    _Contacts contacts, _Messages messages, _Favorites store,
    void Function(String, String) onOpened) async {
  await tester.pumpWidget(ProviderScope(
    overrides: [
      sessionProvider.overrideWith(_TestSession.new),
      humanContactsTransportProvider.overrideWithValue(contacts),
    ],
    child: MaterialApp(home: HumanContactHubScreen(
      dmTransport: messages, favoritesStore: store,
      onOpenConversation: onOpened,
    )),
  ));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('accepted contact appears before any DM; server C02 open is used',
      (tester) async {
    final contacts = _Contacts();
    final messages = _Messages();
    final opened = <String>[];
    await _mount(tester, contacts, messages, _Favorites(),
        (id, _) => opened.add(id));

    expect(find.text('Bello'), findsOneWidget);
    expect(find.text('Masanawa contacts'), findsOneWidget);
    expect(find.text('Danladi'), findsOneWidget);
    expect(find.text('Incoming requests'), findsOneWidget);
    expect(find.text('Request'), findsOneWidget);
    // No implicit conversation is created when contacts are displayed.
    expect(messages.opened, isEmpty);
    await tester.tap(find.text('Message'));
    await tester.pumpAndSettle();
    expect(messages.opened, ['person_b']);
    expect(opened, ['conversation-of-person_b']);
  });

  testWidgets('revoked contact cannot open a conversation; C01 request offered',
      (tester) async {
    final contacts = _Contacts()
      ..people = [_person('person_d', 'Danladi', HumanContactStatus.revoked)];
    final messages = _Messages();
    await _mount(tester, contacts, messages, _Favorites(), (_, __) {});
    expect(find.text('Message'), findsNothing);
    expect(find.text('Request'), findsOneWidget);
    await tester.tap(find.text('Request'));
    await tester.pumpAndSettle();
    expect(messages.opened, isEmpty);
    expect(find.text('Contact request sent.'), findsOneWidget);
  });

  testWidgets('double-tap and C02 denial do not produce phantom DM',
      (tester) async {
    final contacts = _Contacts();
    final messages = _Messages()..pending = Completer<String>();
    final opened = <String>[];
    await _mount(tester, contacts, messages, _Favorites(),
        (id, _) => opened.add(id));
    await tester.tap(find.text('Message'));
    await tester.pump();
    // While the open is in flight, the button is disabled.
    expect(tester.widget<FilledButton>(
        find.widgetWithText(FilledButton, 'Message')).onPressed, isNull);
    messages.pending!.completeError(StateError('permission revoked'));
    await tester.pumpAndSettle();
    expect(messages.opened.length, 1);
    expect(opened, isEmpty);
    expect(find.textContaining('Could not open this conversation'), findsOneWidget);
  });

  testWidgets('local filtering never enumerates unknown names',
      (tester) async {
    final messages = _Messages();
    await _mount(tester, _Contacts(), messages, _Favorites(), (_, __) {});
    await tester.enterText(find.byKey(const Key('hubFilter')), 'bell');
    await tester.pumpAndSettle();
    expect(find.text('Bello'), findsOneWidget);
    expect(find.text('Danladi'), findsNothing);
    await tester.tap(find.text('Add by exact @handle'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('hubHandle')), 'hidden');
    await tester.tap(find.text('Find person'));
    await tester.pumpAndSettle();
    expect(find.text('Fatima'), findsNothing);
  });

  testWidgets('favorite persists in owner-scoped store, without starting DM',
      (tester) async {
    final store = _Favorites();
    final messages = _Messages();
    await _mount(tester, _Contacts(), messages, store, (_, __) {});
    await tester.tap(find.byTooltip('Add to favorites'));
    await tester.pumpAndSettle();
    expect(store.values['person_a'], {'person_b'});
    expect(messages.opened, isEmpty);
    expect(find.text('Favorites'), findsOneWidget);
  });

  testWidgets('lazy Contacts rows use distinct section and human ID keys',
      (tester) async {
    final store = _Favorites()..values['person_a'] = {'person_b'};
    final contacts = _Contacts();
    contacts.people = [
      _person('person_e', 'Emeka', HumanContactStatus.incoming),
      _person('person_b', 'Bello', HumanContactStatus.accepted),
    ];
    await _mount(tester, contacts, _Messages(), store, (_, __) {});

    // The same human can appear in Favorites and Masanawa contacts;
    // each visible row must have its own stable, real (interpolated) key.
    expect(find.byKey(const ValueKey('Favorites_person_b')),
        findsOneWidget);
    expect(find.byKey(const ValueKey('Masanawa contacts_person_b')),
        findsOneWidget);
    expect(find.text('Bello'), findsNWidgets(2));
    expect(find.text('Incoming requests'), findsOneWidget);
  });

  testWidgets('loads cursor pages using C01 and ends at final cursor',
      (tester) async {
    final contacts = _PaginatedContacts()
      ..people = [
        _person('person_b', 'Bello', HumanContactStatus.accepted),
        _person('person_f', 'Fatima', HumanContactStatus.accepted),
      ];
    await _mount(tester, contacts, _Messages(), _Favorites(), (_, __) {});
    expect(contacts.pageCursors, [null]);
    expect(find.text('Bello'), findsOneWidget);
    expect(find.text('Fatima'), findsNothing);
    await tester.ensureVisible(find.byKey(const Key('hubLoadMore')));
    await tester.tap(find.byKey(const Key('hubLoadMore')));
    await tester.pumpAndSettle();
    expect(contacts.pageCursors, [null, 'next_page_1']);
    expect(find.text('Fatima'), findsOneWidget);
    expect(find.byKey(const Key('hubLoadMore')), findsNothing);
    expect(find.textContaining('Some contacts may not appear'), findsNothing);
  });

  testWidgets('failed page preserves earlier contacts and retries same cursor',
      (tester) async {
    final contacts = _PaginatedContacts()
      ..people = [
        _person('person_b', 'Bello', HumanContactStatus.accepted),
        _person('person_f', 'Fatima', HumanContactStatus.accepted),
      ]
      ..failNextPageOnce = true;
    await _mount(tester, contacts, _Messages(), _Favorites(), (_, __) {});
    await tester.ensureVisible(find.byKey(const Key('hubLoadMore')));
    await tester.tap(find.byKey(const Key('hubLoadMore')));
    await tester.pumpAndSettle();
    expect(find.text('Bello'), findsOneWidget);
    expect(find.text('Fatima'), findsNothing);
    expect(find.textContaining('Could not complete that action'),
        findsOneWidget);
    await tester.tap(find.byKey(const Key('hubLoadMore')));
    await tester.pumpAndSettle();
    expect(contacts.pageCursors, [null, 'next_page_1', 'next_page_1']);
    expect(find.text('Fatima'), findsOneWidget);
    expect(find.byKey(const Key('hubLoadMore')), findsNothing);
  });

  testWidgets('logout hides contact names without requiring phone permission',
      (tester) async {
    await _mount(tester, _Contacts(), _Messages(), _Favorites(), (_, __) {});
    final container = ProviderScope.containerOf(
        tester.element(find.byType(HumanContactHubScreen)));
    (container.read(sessionProvider.notifier) as _TestSession).logout();
    await tester.pumpAndSettle();
    expect(find.text('Bello'), findsNothing);
    expect(find.text('Sign in to see your Masanawa contacts.'),
        findsOneWidget);
  });

  testWidgets('late C02 response after account switch does not navigate',
      (tester) async {
    final messages = _Messages()..pending = Completer<String>();
    final opened = <String>[];
    await _mount(tester, _Contacts(), messages, _Favorites(),
        (id, _) => opened.add(id));
    await tester.tap(find.text('Message'));
    await tester.pump();
    final container = ProviderScope.containerOf(
        tester.element(find.byType(HumanContactHubScreen)));
    (container.read(sessionProvider.notifier) as _TestSession).change();
    await tester.pump();
    messages.pending!.complete('stale-A-conversation');
    await tester.pumpAndSettle();
    expect(opened, isEmpty);
  });

  testWidgets('10k synthetic accepted people use lazy visible contact rows',
      (tester) async {
    final contacts = _Contacts();
    contacts.people = List.generate(10000,
        (index) => _person('person_$index',
            'Contact $index', HumanContactStatus.accepted));
    // Synthetic oversized page: stresses the UI in advance of F14's
    // required paginated C01 endpoint. It is NOT a gateway capacity claim.
    final messages = _Messages();
    await _mount(tester, contacts, messages, _Favorites(), (_, __) {});
    // C01 currently caps the returned list; verify the explicit truncation
    // notice, not a fictional ten-thousand-contact server page.
    expect(find.textContaining('Some contacts may not appear'), findsOneWidget);
    expect(find.text('Contact 0'), findsOneWidget);
    expect(find.text('Contact 9999'), findsNothing);
    expect(messages.opened, isEmpty);
  });

  testWidgets('account transition clears another user’s handle/search text',
      (tester) async {
    final store = _Favorites();
    store.values['person_a'] = {'person_b'};
    await _mount(tester, _Contacts(), _Messages(), store, (_, __) {});
    await tester.enterText(find.byKey(const Key('hubFilter')), 'private term');
    await tester.tap(find.text('Add by exact @handle'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('hubHandle')), 'secret_handle');
    final container = ProviderScope.containerOf(
        tester.element(find.byType(HumanContactHubScreen)));
    (container.read(sessionProvider.notifier) as _TestSession).change();
    await tester.pumpAndSettle();
    expect(find.text('private term'), findsNothing);
    expect(find.text('secret_handle'), findsNothing);
    expect(find.text('Favorites'), findsNothing);
    expect(find.byKey(const Key('hubFilter')), findsOneWidget);
  });

  testWidgets('favorites survive widget restart only for that account',
      (tester) async {
    final store = _Favorites();
    await _mount(tester, _Contacts(), _Messages(), store, (_, __) {});
    await tester.tap(find.byTooltip('Add to favorites'));
    await tester.pumpAndSettle();
    await tester.pumpWidget(const SizedBox.shrink());
    await _mount(tester, _Contacts(), _Messages(), store, (_, __) {});
    expect(find.text('Favorites'), findsOneWidget);
    expect(store.values['person_a'], {'person_b'});
    expect(store.values['person_c'], isNull);
  });
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/api/models.dart';
import 'package:masanawa/src/state/session_state.dart';
import 'package:masanawa/src/screens/talks/create_talk_participant_handoff.dart';
import 'package:masanawa/src/screens/talks/create_talk_screen.dart';
import 'package:masanawa/src/state/talk_state.dart';
import 'package:masanawa/src/talks/talk_ai_seat.dart';
import 'package:masanawa/src/talks/talk_create_action_store.dart';
import 'package:masanawa/src/talks/talk_models.dart';
import 'package:masanawa/src/talks/talk_share.dart';

const createdTalk = TalkDiscoveryItem(
  id: 'talk-123',
  title: 'Public science',
  hostName: 'Amina',
  isLive: true,
  listenerCount: 0,
  viewerIsHost: true,
  participants: [
    TalkParticipantPreview(
      id: 'host-account',
      name: 'Amina',
      kind: TalkParticipantKind.human,
      isHost: true,
    ),
  ],
);


AuthUser _user(String id) => AuthUser(
  id: id,
  name: 'Test host',
  locale: 'en',
  status: 'ACTIVE',
  role: 'USER',
  isNewUser: false,
  createdAt: '2026-10-08T00:00:00Z',
);

SessionSignedIn _session(String id) {
  final user = _user(id);
  return SessionSignedIn(user, AuthTokens(
    accessToken: 'test-only-access-$id',
    refreshToken: 'test-only-refresh-$id',
    accessExpiresIn: 3600,
    user: user,
  ));
}

class FakeSessionController extends SessionController {
  @override
  SessionState build() => _session('host-account');

  void switchAccount(String userId) => state = _session(userId);

  void signOut() => state = const SessionSignedOut();
}

class FakeHostGuard implements TalkCreateHostGuard {
  FakeHostGuard(this.allowed);
  final bool allowed;
  @override
  Future<bool> isHost(String talkId) async => allowed && talkId == createdTalk.id;
}

class FakeActionStore implements TalkCreateActionStore {
  final Map<String, List<TalkCreateParticipantAction>> saved = {};
  bool failSave = false;
  Completer<void>? beforeSave;

  @override
  Future<List<TalkCreateParticipantAction>> load(String talkId) async =>
      List.unmodifiable(saved[talkId] ?? const []);

  @override
  Future<void> save(String talkId, List<TalkCreateParticipantAction> actions) async {
    if (beforeSave != null) await beforeSave!.future;
    if (failSave) throw StateError('write failed');
    saved[talkId] = List.unmodifiable(actions);
  }
}

class FakeTalkTransport implements TalkTransport {
  String? createdTopic;
  String? createdTitle;

  @override
  Future<TalkDiscoveryItem> createTalk({required String topic, String? title}) async {
    createdTopic = topic;
    createdTitle = title;
    return createdTalk;
  }

  @override
  Future<List<TalkDiscoveryItem>> loadFeed(TalkFeedKind feed) async => const [];

  @override
  Future<TalkDetail> loadTalk(String talkId) async =>
      const TalkDetail(talk: createdTalk);

  @override
  Future<TalkDiscoveryItem> updateTalk({
    required String talkId,
    String? title,
    String? topic,
    String? summary,
  }) async => createdTalk;

  @override
  Future<TalkComment> addComment({
    required String talkId,
    required String body,
  }) => throw UnimplementedError();
}

Widget _harness(
  FakeActionStore store,
  Widget child, {
  FakeTalkTransport? talkTransport,
  bool verifiedHost = true,
}) => ProviderScope(
  overrides: [
    sessionProvider.overrideWith(FakeSessionController.new),
    talkCreateActionStoreProvider.overrideWithValue(store),
    talkCreateHostGuardProvider.overrideWith((ref) {
      final session = ref.watch(sessionProvider);
      return FakeHostGuard(verifiedHost &&
          session is SessionSignedIn &&
          session.user.id == 'host-account');
    }),
    if (talkTransport != null)
      talkTransportProvider.overrideWithValue(talkTransport),
  ],
  child: MaterialApp(home: child),
);

void main() {
  test('server Host guard verifies authenticated ID against actual participant', () async {
    final transport = FakeTalkTransport();
    expect(await ServerTalkCreateHostGuard(
      transport: transport,
      viewerUserId: 'host-account',
    ).isHost(createdTalk.id), isTrue);
    expect(await ServerTalkCreateHostGuard(
      transport: transport,
      viewerUserId: 'unrelated-viewer',
    ).isHost(createdTalk.id), isFalse);
    expect(await ServerTalkCreateHostGuard(
      transport: transport,
      viewerUserId: '',
    ).isHost(createdTalk.id), isFalse);
  });

  test('persisted post-create intents reject malformed and duplicate values', () {
    expect(parseTalkCreateActions('addExpert,addExpert,other,invitePerson,addTwin'), [
      TalkCreateParticipantAction.addExpert,
      TalkCreateParticipantAction.invitePerson,
      TalkCreateParticipantAction.addTwin,
    ]);
    expect(parseTalkCreateActions(null), isEmpty);
    expect(parseTalkCreateActions('paid,quote,confirm'), isEmpty);
  });

  testWidgets('Create Talk preserves topic, never purchases a Seat on selection',
      (tester) async {
    final store = FakeActionStore();
    final transport = FakeTalkTransport();
    TalkDiscoveryItem? result;
    await tester.pumpWidget(_harness(
      store,
      CreateTalkScreen(onCreated: (talk) => result = talk),
      talkTransport: transport,
    ));
    await tester.enterText(
      find.byKey(const ValueKey('create-talk-topic')),
      'How do stars form?',
    );
    await tester.enterText(
      find.byKey(const ValueKey('create-talk-title')),
      'Public science',
    );
    await tester.tap(find.text('Add Expert'));
    await tester.ensureVisible(find.text('Invite person'));
    await tester.tap(find.text('Invite person'));
    await tester.ensureVisible(find.text('Add My Twin'));
    await tester.tap(find.text('Add My Twin'));
    expect(find.byKey(const ValueKey('create-talk-pending-actions')),
        findsOneWidget);
    expect(transport.createdTopic, isNull);
    await tester.tap(find.byKey(const ValueKey('create-talk-go-live')));
    await tester.pumpAndSettle();
    expect(result?.id, createdTalk.id);
    expect(transport.createdTopic, 'How do stars form?');
    expect(transport.createdTitle, 'Public science');
    expect(store.saved[createdTalk.id], [
      TalkCreateParticipantAction.invitePerson,
      TalkCreateParticipantAction.addExpert,
      TalkCreateParticipantAction.addTwin,
    ]);
  });

  testWidgets('created Host can resume share and Twin selection after a restart',
      (tester) async {
    final store = FakeActionStore()..saved[createdTalk.id] = [
      TalkCreateParticipantAction.invitePerson,
      TalkCreateParticipantAction.addTwin,
    ];
    TalkSharePayload? shared;
    TalkAiPersonaKind? shownKind;
    await tester.pumpWidget(_harness(
      store,
      TalkCreateParticipantHandoff(
        talkId: createdTalk.id,
        initialTalk: createdTalk,
        isHost: true,
        shareTalk: (payload) async { shared = payload; },
        presentAiSeat: (_, {required talkId, required kind}) async {
          expect(talkId, createdTalk.id);
          shownKind = kind;
          return null; // The user may cancel a paid quote without any charge.
        },
        child: const Scaffold(body: Text('Talk connected')),
      ),
    ));
    await tester.pumpAndSettle();
    expect(find.text('Invite a human speaker'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('create-talk-action-continue')));
    await tester.pumpAndSettle();
    expect(shared?.url.toString(), 'https://masanawa.com/talk/talk-123');
    expect(store.saved[createdTalk.id], [
      TalkCreateParticipantAction.addTwin,
    ]);
    expect(find.text('Choose your Twin'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('create-talk-action-continue')));
    await tester.pumpAndSettle();
    expect(shownKind, TalkAiPersonaKind.twin);
    expect(store.saved[createdTalk.id], isEmpty);
  });

  testWidgets('non-Host never gets pending paid or invitation handoff',
      (tester) async {
    final store = FakeActionStore()..saved[createdTalk.id] = [
      TalkCreateParticipantAction.addExpert,
    ];
    await tester.pumpWidget(_harness(
      store,
      TalkCreateParticipantHandoff(
        talkId: createdTalk.id,
        initialTalk: createdTalk,
        isHost: false,
        child: const Scaffold(body: Text('Audience')),
      ),
    ));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('create-talk-action-banner')),
        findsNothing);
    expect(store.saved[createdTalk.id], [
      TalkCreateParticipantAction.addExpert,
    ]);
  });

  testWidgets('forged Host route flag cannot restore another user’s actions',
      (tester) async {
    final store = FakeActionStore()..saved[createdTalk.id] = [
      TalkCreateParticipantAction.addTwin,
    ];
    await tester.pumpWidget(_harness(
      store,
      TalkCreateParticipantHandoff(
        talkId: createdTalk.id,
        isHost: true, // A URL query alone cannot grant ownership.
        child: const Scaffold(body: Text('Public Talk')),
      ),
      verifiedHost: false,
    ));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('create-talk-action-banner')), findsNothing);
    expect(store.saved[createdTalk.id], [TalkCreateParticipantAction.addTwin]);
  });

  testWidgets('storage failure never opens paid AI selection',
      (tester) async {
    final store = FakeActionStore()
      ..saved[createdTalk.id] = [TalkCreateParticipantAction.addExpert]
      ..failSave = true;
    var opened = false;
    await tester.pumpWidget(_harness(
      store,
      TalkCreateParticipantHandoff(
        talkId: createdTalk.id,
        isHost: true,
        presentAiSeat: (_, {required talkId, required kind}) async {
          opened = true;
          return null;
        },
        child: const Scaffold(body: Text('Talk')),
      ),
    ));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('create-talk-action-continue')));
    await tester.pumpAndSettle();
    expect(opened, false);
    expect(store.saved[createdTalk.id],
        [TalkCreateParticipantAction.addExpert]);
  });

  testWidgets('account switch removes old Host invitation and does not leak to B',
      (tester) async {
    final store = FakeActionStore()..saved[createdTalk.id] = [
      TalkCreateParticipantAction.invitePerson,
    ];
    var shared = 0;
    await tester.pumpWidget(_harness(
      store,
      TalkCreateParticipantHandoff(
        talkId: createdTalk.id,
        isHost: true,
        shareTalk: (_) async { shared++; },
        child: const Scaffold(body: Text('Talk')),
      ),
    ));
    await tester.pumpAndSettle();
    expect(find.text('Invite a human speaker'), findsOneWidget);
    final provider = ProviderScope.containerOf(
        tester.element(find.byType(TalkCreateParticipantHandoff)));
    (provider.read(sessionProvider.notifier) as FakeSessionController)
        .switchAccount('other-account');
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('create-talk-action-banner')), findsNothing);
    expect(shared, 0);
    // Returning to the real Host reloads only the Host's existing intent.
    (provider.read(sessionProvider.notifier) as FakeSessionController)
        .switchAccount('host-account');
    await tester.pumpAndSettle();
    expect(find.text('Invite a human speaker'), findsOneWidget);
  });

  testWidgets('logout clears visible paid action without presenting a quote',
      (tester) async {
    final store = FakeActionStore()..saved[createdTalk.id] = [
      TalkCreateParticipantAction.addExpert,
    ];
    var opened = 0;
    await tester.pumpWidget(_harness(
      store,
      TalkCreateParticipantHandoff(
        talkId: createdTalk.id,
        isHost: true,
        presentAiSeat: (_, {required talkId, required kind}) async {
          opened++;
          return null;
        },
        child: const Scaffold(body: Text('Talk')),
      ),
    ));
    await tester.pumpAndSettle();
    final provider = ProviderScope.containerOf(
        tester.element(find.byType(TalkCreateParticipantHandoff)));
    (provider.read(sessionProvider.notifier) as FakeSessionController).signOut();
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('create-talk-action-banner')), findsNothing);
    expect(opened, 0);
  });

  testWidgets('in-flight secure write cannot launch AI quote after user switch',
      (tester) async {
    final saveGate = Completer<void>();
    final store = FakeActionStore()
      ..saved[createdTalk.id] = [TalkCreateParticipantAction.addTwin]
      ..beforeSave = saveGate;
    var opened = 0;
    await tester.pumpWidget(_harness(
      store,
      TalkCreateParticipantHandoff(
        talkId: createdTalk.id,
        isHost: true,
        presentAiSeat: (_, {required talkId, required kind}) async {
          opened++;
          return null;
        },
        child: const Scaffold(body: Text('Talk')),
      ),
    ));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('create-talk-action-continue')));
    await tester.pump();
    final provider = ProviderScope.containerOf(
        tester.element(find.byType(TalkCreateParticipantHandoff)));
    (provider.read(sessionProvider.notifier) as FakeSessionController)
        .switchAccount('other-account');
    await tester.pump();
    saveGate.complete();
    await tester.pumpAndSettle();
    expect(opened, 0);
    expect(find.byKey(const ValueKey('create-talk-action-banner')), findsNothing);
  });
}

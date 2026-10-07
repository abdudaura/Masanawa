import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/screens/talks/talk_screen.dart';
import 'package:masanawa/src/state/talk_ai_seat_state.dart';
import 'package:masanawa/src/state/talk_participation_state.dart';
import 'package:masanawa/src/state/talk_state.dart';
import 'package:masanawa/src/talks/talk_ai_seat.dart';
import 'package:masanawa/src/talks/talk_models.dart';
import 'package:masanawa/src/talks/talk_participation.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

class _SeatTransport implements TalkAiSeatTransport {
  const _SeatTransport();

  @override
  Future<List<TalkAiSeatCandidate>> loadCandidates({
    required String talkId,
  }) async =>
      const [
        TalkAiSeatCandidate(
          personaId: 'expert-1',
          displayName: 'Education Expert',
          kind: TalkAiPersonaKind.expert,
          seatFeeLabel: '₦300',
          subtitle: 'Learning · Schools',
        ),
      ];

  @override
  Future<TalkAiSeatQuote> createQuote({
    required String talkId,
    required String personaId,
    required TalkAiSeatMode mode,
  }) async =>
      TalkAiSeatQuote(
        quoteId: 'quote-1',
        personaId: personaId,
        displayName: 'Education Expert',
        kind: TalkAiPersonaKind.expert,
        mode: mode,
        totalLabel: '₦300',
        expiresAt: DateTime(2030, 1, 1, 12, 30),
        requiresHostApproval: mode == TalkAiSeatMode.sponsor,
      );

  @override
  Future<TalkAiSeatRequest> confirmQuote({
    required String talkId,
    required String quoteId,
  }) async =>
      const TalkAiSeatRequest(
        requestId: 'request-1',
        status: TalkAiSeatRequestStatus.pendingHost,
        message: 'Waiting for the Host.',
      );
}

class _ParticipationTransport implements TalkParticipationTransport {
  TalkParticipationState state = const TalkParticipationState();
  String? reactedWith;
  bool? raised;

  @override
  Future<TalkParticipationState> load(String talkId) async => state;

  @override
  Future<TalkParticipationState> react({
    required String talkId,
    required String reaction,
  }) async {
    reactedWith = reaction;
    state = TalkParticipationState(
      handStatus: state.handStatus,
      reaction: reaction,
    );
    return state;
  }

  @override
  Future<TalkParticipationState> setHandRaised({
    required String talkId,
    required bool raised,
  }) async {
    this.raised = raised;
    state = TalkParticipationState(
      handStatus: raised ? TalkHandStatus.raised : TalkHandStatus.idle,
      reaction: state.reaction,
    );
    return state;
  }
}

class _TalkTransport implements TalkTransport {
  final List<TalkComment> comments = [
    TalkComment(
      id: 'c1',
      authorName: 'Fatima',
      body: 'This is the kind of conversation I came here for.',
      createdAt: DateTime(2026, 10, 7, 8),
      likeCount: 12,
    ),
  ];

  static const talk = TalkDiscoveryItem(
    id: 'talk-1',
    title: 'Will AI make education more equal?',
    hostName: 'Abdullahi',
    isLive: true,
    listenerCount: 1800,
    commentCount: 1,
    participants: [
      TalkParticipantPreview(
        id: 'host',
        name: 'Abdullahi',
        kind: TalkParticipantKind.human,
        isHost: true,
      ),
      TalkParticipantPreview(
        id: 'expert',
        name: 'Education Expert',
        kind: TalkParticipantKind.expert,
      ),
    ],
  );

  @override
  Future<List<TalkDiscoveryItem>> loadFeed(TalkFeedKind feed) async =>
      const [talk];

  @override
  Future<TalkDetail> loadTalk(String talkId) async =>
      TalkDetail(talk: talk, comments: List.unmodifiable(comments));

  @override
  Future<TalkDiscoveryItem> createTalk({
    required String topic,
    String? title,
  }) async =>
      talk;

  @override
  Future<TalkComment> addComment({
    required String talkId,
    required String body,
  }) async {
    final comment = TalkComment(
      id: 'c2',
      authorName: 'You',
      body: body,
      createdAt: DateTime(2026, 10, 7, 9),
    );
    comments.add(comment);
    return comment;
  }
}

Widget _app({
  required TalkTransport talkTransport,
  Widget? home,
  _ParticipationTransport? participation,
}) {
  return ProviderScope(
    overrides: [
      talkTransportProvider.overrideWithValue(talkTransport),
      talkAiSeatTransportProvider.overrideWithValue(
        const _SeatTransport(),
      ),
      talkParticipationTransportProvider.overrideWithValue(
        participation ?? _ParticipationTransport(),
      ),
    ],
    child: MaterialApp(
      theme: buildMasanawaTheme(brightness: Brightness.light),
      home: home ??
          const TalkScreen(
            talkId: 'talk-1',
            initialTalk: _TalkTransport.talk,
          ),
    ),
  );
}

void main() {
  testWidgets('Talk keeps live controls and comments on one screen',
      (tester) async {
    final transport = _TalkTransport();
    await tester.pumpWidget(_app(talkTransport: transport));
    await tester.pumpAndSettle();

    expect(find.text('Will AI make education more equal?'), findsOneWidget);
    expect(find.text('Raise hand'), findsOneWidget);
    expect(find.text('Add AI'), findsOneWidget);
    expect(find.text('Comments'), findsOneWidget);
    expect(
      find.text('This is the kind of conversation I came here for.'),
      findsOneWidget,
    );
    expect(find.text('Share your thoughts…'), findsOneWidget);
  });

  testWidgets('listener can post a comment without leaving the Talk',
      (tester) async {
    final transport = _TalkTransport();
    await tester.pumpWidget(
      _app(
        talkTransport: transport,
        home: const TalkScreen(talkId: 'talk-1'),
      ),
    );
    await tester.pumpAndSettle();

    await tester.enterText(
      find.byType(TextField).last,
      'I want to hear more about rural schools.',
    );
    await tester.tap(find.byTooltip('Post comment'));
    await tester.pumpAndSettle();

    expect(
      find.text('I want to hear more about rural schools.'),
      findsOneWidget,
    );
    expect(transport.comments.length, 2);
    expect(tester.takeException(), isNull);
  });

  testWidgets('listener opens Sponsor Seat sheet from Add AI', (tester) async {
    final transport = _TalkTransport();
    await tester.pumpWidget(_app(talkTransport: transport));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Add AI'));
    await tester.pumpAndSettle();

    expect(find.text('Sponsor a Seat'), findsOneWidget);
    expect(find.text('Education Expert'), findsWidgets);
    expect(find.text('Sponsor'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('listener can react without leaving the Talk', (tester) async {
    final transport = _TalkTransport();
    final participation = _ParticipationTransport();

    await tester.pumpWidget(
      _app(
        talkTransport: transport,
        participation: participation,
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('React'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('talk-reaction-❤️')));
    await tester.pumpAndSettle();

    expect(participation.reactedWith, '❤️');
    expect(find.text('❤️'), findsWidgets);
    expect(tester.takeException(), isNull);
  });

  testWidgets('listener raises and lowers hand through Host-controlled request',
      (tester) async {
    final transport = _TalkTransport();
    final participation = _ParticipationTransport();

    await tester.pumpWidget(
      _app(
        talkTransport: transport,
        participation: participation,
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Raise hand'));
    await tester.pumpAndSettle();
    expect(find.text('Ask to speak?'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('raise-hand-confirm')));
    await tester.pumpAndSettle();

    expect(participation.raised, isTrue);
    expect(find.text('Hand raised'), findsOneWidget);

    await tester.tap(find.text('Hand raised'));
    await tester.pumpAndSettle();
    expect(find.text('Your hand is raised'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('raise-hand-confirm')));
    await tester.pumpAndSettle();

    expect(participation.raised, isFalse);
    expect(find.text('Raise hand'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('host opens direct Add AI semantics', (tester) async {
    final transport = _TalkTransport();
    await tester.pumpWidget(
      _app(
        talkTransport: transport,
        home: const TalkScreen(
          talkId: 'talk-1',
          initialTalk: _TalkTransport.talk,
          isHost: true,
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Add AI'));
    await tester.pumpAndSettle();

    expect(find.text('Add AI'), findsWidgets);
    expect(find.text('Add'), findsOneWidget);
    expect(find.text('Sponsor a Seat'), findsNothing);
  });
}

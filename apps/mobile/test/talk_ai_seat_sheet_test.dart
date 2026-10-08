import 'package:masanawa/src/localization/masanawa_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:masanawa/src/screens/talks/add_ai_seat_sheet.dart';
import 'package:masanawa/src/state/talk_ai_seat_state.dart';
import 'package:masanawa/src/talks/talk_ai_seat.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

class _FakeSeatTransport implements TalkAiSeatTransport {
  TalkAiSeatMode? quotedMode;
  String? quotedPersona;
  bool expireFirstQuote = false;
  int quoteCount = 0;
  int confirmationCalls = 0;
  TalkAiSeatRequestStatus confirmationStatus = TalkAiSeatRequestStatus.pendingHost;
  bool failConfirmation = false;
  bool mismatchedQuote = false;
  bool emptyCatalog = false;

  static const expert = TalkAiSeatCandidate(
    personaId: 'expert-economist',
    displayName: 'Economist',
    kind: TalkAiPersonaKind.expert,
    seatFeeLabel: '₦300',
    subtitle: 'Economy · Business',
    topics: ['Economics', 'Business'],
    isAvailable: true,
  );

  static const twin = TalkAiSeatCandidate(
    personaId: 'twin-amina',
    displayName: 'Amina Twin',
    kind: TalkAiPersonaKind.twin,
    seatFeeLabel: '₦450',
    subtitle: 'Owned by Amina',
    topics: ['Technology', 'Startups'],
    isAvailable: true,
    isOwnedByViewer: true,
  );

  static const foreignTwin = TalkAiSeatCandidate(
    personaId: 'twin-foreign',
    displayName: 'Someone Else Twin',
    kind: TalkAiPersonaKind.twin,
    seatFeeLabel: '20 Credits',
    isAvailable: true,
    isOwnedByViewer: false,
  );

  @override
  Future<List<TalkAiSeatCandidate>> loadCandidates({
    required String talkId,
  }) async => emptyCatalog ? const [] : const [expert, twin, foreignTwin];

  @override
  Future<TalkAiSeatQuote> createQuote({
    required String talkId,
    required String personaId,
    required TalkAiSeatMode mode,
  }) async {
    quotedMode = mode;
    quotedPersona = personaId;
    quoteCount += 1;
    final candidate = personaId == twin.personaId ? twin : expert;
    return TalkAiSeatQuote(
      quoteId: 'quote-1',
      personaId: mismatchedQuote ? 'different-persona' : personaId,
      displayName: candidate.displayName,
      kind: candidate.kind,
      mode: mode,
      totalLabel: candidate.seatFeeLabel,
      expiresAt: expireFirstQuote && quoteCount == 1
          ? DateTime.now().add(const Duration(seconds: 2))
          : DateTime(2030, 1, 1, 12, 30),
      requiresHostApproval: mode == TalkAiSeatMode.sponsor,
    );
  }

  @override
  Future<TalkAiSeatRequest> confirmQuote({
    required String talkId,
    required String quoteId,
  }) async {
    confirmationCalls += 1;
    if (failConfirmation) throw StateError('Network timeout');
    return TalkAiSeatRequest(
      requestId: 'request-1',
      status: confirmationStatus,
      message: confirmationStatus == TalkAiSeatRequestStatus.expired
          ? 'The Seat request expired.'
          : 'Waiting for the Host.',
    );
  }
}

Widget _app({
  required TalkAiSeatTransport transport,
  required bool isHost,
  TalkAiPersonaKind initialKind = TalkAiPersonaKind.expert,
  bool onlyOwnedTwin = false,
}) {
  return ProviderScope(
    overrides: [
      talkAiSeatTransportProvider.overrideWithValue(transport),
    ],
    child: MaterialApp(theme: buildMasanawaTheme(brightness: Brightness.light), localizationsDelegates: MasanawaLocalization.delegates, supportedLocales: MasanawaLocalization.supportedLocales, 
      home: AddAiSeatSheet(
        talkId: 'talk-1',
        isHost: isHost,
        initialKind: initialKind,
        onlyOwnedTwin: onlyOwnedTwin,
      ),
    ),
  );
}

void main() {
  testWidgets('audience sees sponsorship semantics and fresh quote',
      (tester) async {
    final transport = _FakeSeatTransport();
    await tester.pumpWidget(_app(transport: transport, isHost: false));
    await tester.pumpAndSettle();

    expect(find.text('Sponsor a Seat'), findsOneWidget);
    expect(find.text('Experts'), findsOneWidget);
    expect(find.text('Twins'), findsOneWidget);
    expect(find.text('Economist'), findsOneWidget);
    expect(find.text('₦300'), findsOneWidget);
    expect(find.text('Sponsor'), findsOneWidget);

    await tester.tap(find.text('Sponsor'));
    await tester.pumpAndSettle();

    expect(transport.quotedMode, TalkAiSeatMode.sponsor);
    expect(transport.quotedPersona, 'expert-economist');
    expect(find.text('Confirm sponsorship'), findsWidgets);
    expect(
      find.textContaining('Host must still accept'),
      findsOneWidget,
    );
    expect(find.text('Quote valid until'), findsOneWidget);
  });

  testWidgets('host gets direct Add semantics', (tester) async {
    final transport = _FakeSeatTransport();
    await tester.pumpWidget(_app(transport: transport, isHost: true));
    await tester.pumpAndSettle();

    expect(find.text('Add AI'), findsOneWidget);
    expect(find.text('Add'), findsOneWidget);

    await tester.tap(find.text('Add'));
    await tester.pumpAndSettle();

    expect(transport.quotedMode, TalkAiSeatMode.hostAdd);
    expect(find.text('Confirm AI Seat'), findsOneWidget);
    expect(
      find.textContaining('available AI Seat'),
      findsOneWidget,
    );
  });

  testWidgets('preselected Twin opens the real Twin catalog without quoting',
      (tester) async {
    final transport = _FakeSeatTransport();
    await tester.pumpWidget(_app(
      transport: transport,
      isHost: true,
      initialKind: TalkAiPersonaKind.twin,
    ));
    await tester.pumpAndSettle();
    expect(find.text('Amina Twin'), findsOneWidget);
    expect(find.text('Economist'), findsNothing);
    expect(transport.quoteCount, 0);
    expect(transport.confirmationCalls, 0);
  });

  testWidgets('Add My Twin cannot show other people’s public Twins',
      (tester) async {
    final transport = _FakeSeatTransport();
    await tester.pumpWidget(_app(
      transport: transport,
      isHost: true,
      onlyOwnedTwin: true,
    ));
    await tester.pumpAndSettle();
    expect(find.text('My Twin'), findsOneWidget);
    expect(find.text('Amina Twin'), findsOneWidget);
    expect(find.text('Someone Else Twin'), findsNothing);
    expect(find.text('Economist'), findsNothing);
    expect(transport.confirmationCalls, 0);
  });

  testWidgets('missing Twin opens the real My Twin creation route',
      (tester) async {
    final transport = _FakeSeatTransport()..emptyCatalog = true;
    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/',
          builder: (context, _) => Scaffold(
            body: TextButton(
              onPressed: () => showAddAiSeatSheet(
                context,
                talkId: 'talk-1',
                isHost: true,
                initialKind: TalkAiPersonaKind.twin,
              ),
              child: const Text('Open picker'),
            ),
          ),
        ),
        GoRoute(
          path: '/my-twin',
          builder: (_, __) => const Scaffold(body: Text('Twin creator')),
        ),
      ],
    );
    await tester.pumpWidget(ProviderScope(
      overrides: [talkAiSeatTransportProvider.overrideWithValue(transport)],
      child: MaterialApp.router(theme: buildMasanawaTheme(brightness: Brightness.light), localizationsDelegates: MasanawaLocalization.delegates, supportedLocales: MasanawaLocalization.supportedLocales, routerConfig: router),
    ));
    await tester.tap(find.text('Open picker'));
    await tester.pumpAndSettle();
    expect(find.text('Create My Twin'), findsOneWidget);
    await tester.tap(find.text('Create My Twin'));
    await tester.pumpAndSettle();
    expect(find.text('Twin creator'), findsOneWidget);
    expect(transport.confirmationCalls, 0);
    await tester.pumpWidget(const SizedBox.shrink());
    router.dispose();
  });

  testWidgets('Twins tab filters the catalog without a new screen',
      (tester) async {
    final transport = _FakeSeatTransport();
    await tester.pumpWidget(_app(transport: transport, isHost: false));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Twins'));
    await tester.pumpAndSettle();

    expect(find.text('Amina Twin'), findsOneWidget);
    expect(find.text('Economist'), findsNothing);
    expect(find.text('₦450'), findsOneWidget);
  });
  testWidgets('expired quote disables financial confirmation and allows re-quote',
      (tester) async {
    final transport = _FakeSeatTransport()..expireFirstQuote = true;
    await tester.pumpWidget(_app(transport: transport, isHost: false));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Sponsor'));
    await tester.pumpAndSettle();
    expect(transport.quoteCount, 1);
    expect(
      tester.widget<FilledButton>(
        find.byKey(const ValueKey('ai-seat-confirm')),
      ).onPressed,
      isNotNull,
    );

    await tester.pump(const Duration(seconds: 3));
    expect(find.text('Get new quote'), findsOneWidget);
    expect(
      tester.widget<FilledButton>(
        find.byKey(const ValueKey('ai-seat-confirm')),
      ).onPressed,
      isNull,
    );
    expect(transport.confirmationCalls, 0);

    await tester.tap(find.text('Get new quote'));
    await tester.pumpAndSettle();
    expect(transport.quoteCount, 2);
    expect(find.text('Get new quote'), findsNothing);
    expect(
      tester.widget<FilledButton>(
        find.byKey(const ValueKey('ai-seat-confirm')),
      ).onPressed,
      isNotNull,
    );
  });

  testWidgets('server expired status stays visible instead of claiming success',
      (tester) async {
    final transport = _FakeSeatTransport()
      ..confirmationStatus = TalkAiSeatRequestStatus.expired;
    await tester.pumpWidget(_app(transport: transport, isHost: true));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Add'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('ai-seat-confirm')));
    await tester.pumpAndSettle();

    expect(transport.confirmationCalls, 1);
    expect(find.text('The Seat request expired.'), findsOneWidget);
    expect(find.text('Get new quote'), findsOneWidget);
    expect(find.text('Confirm AI Seat'), findsOneWidget);
    expect(
      tester.widget<FilledButton>(
        find.byKey(const ValueKey('ai-seat-confirm')),
      ).onPressed,
      isNull,
    );
  });

  testWidgets('confirmation timeout does not claim no request was sent',
      (tester) async {
    final transport = _FakeSeatTransport()..failConfirmation = true;
    await tester.pumpWidget(_app(transport: transport, isHost: true));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Add'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('ai-seat-confirm')));
    await tester.pumpAndSettle();

    expect(transport.confirmationCalls, 1);
    expect(find.textContaining('Couldn’t verify this Seat request'), findsOneWidget);
    expect(find.textContaining('No duplicate request was sent'), findsNothing);
  });

  testWidgets('mismatched quote never reaches payable confirmation',
      (tester) async {
    final transport = _FakeSeatTransport()..mismatchedQuote = true;
    await tester.pumpWidget(_app(transport: transport, isHost: true));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Add'));
    await tester.pumpAndSettle();

    expect(transport.quoteCount, 1);
    expect(find.text('Couldn’t prepare this Seat right now.'), findsOneWidget);
    expect(find.byKey(const ValueKey('ai-seat-confirm')), findsNothing);
    expect(transport.confirmationCalls, 0);
  });

  testWidgets('declined Seat request cannot be confirmed again with old quote',
      (tester) async {
    final transport = _FakeSeatTransport()
      ..confirmationStatus = TalkAiSeatRequestStatus.declined;
    await tester.pumpWidget(_app(transport: transport, isHost: true));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Add'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('ai-seat-confirm')));
    await tester.pumpAndSettle();

    expect(find.text('Get new quote'), findsOneWidget);
    expect(
      tester.widget<FilledButton>(
        find.byKey(const ValueKey('ai-seat-confirm')),
      ).onPressed,
      isNull,
    );
    expect(transport.confirmationCalls, 1);
  });

}


import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/screens/talks/add_ai_seat_sheet.dart';
import 'package:masanawa/src/state/talk_ai_seat_state.dart';
import 'package:masanawa/src/talks/talk_ai_seat.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

class _FakeSeatTransport implements TalkAiSeatTransport {
  TalkAiSeatMode? quotedMode;
  String? quotedPersona;

  static const expert = TalkAiSeatCandidate(
    personaId: 'expert-economist',
    displayName: 'Economist',
    kind: TalkAiPersonaKind.expert,
    seatFeeLabel: '₦300',
    subtitle: 'Economy · Business',
    topics: ['Economics', 'Business'],
  );

  static const twin = TalkAiSeatCandidate(
    personaId: 'twin-amina',
    displayName: 'Amina Twin',
    kind: TalkAiPersonaKind.twin,
    seatFeeLabel: '₦450',
    subtitle: 'Owned by Amina',
    topics: ['Technology', 'Startups'],
  );

  @override
  Future<List<TalkAiSeatCandidate>> loadCandidates({
    required String talkId,
  }) async =>
      const [expert, twin];

  @override
  Future<TalkAiSeatQuote> createQuote({
    required String talkId,
    required String personaId,
    required TalkAiSeatMode mode,
  }) async {
    quotedMode = mode;
    quotedPersona = personaId;
    final candidate = personaId == twin.personaId ? twin : expert;
    return TalkAiSeatQuote(
      quoteId: 'quote-1',
      personaId: personaId,
      displayName: candidate.displayName,
      kind: candidate.kind,
      mode: mode,
      totalLabel: candidate.seatFeeLabel,
      expiresAt: DateTime(2030, 1, 1, 12, 30),
      requiresHostApproval: mode == TalkAiSeatMode.sponsor,
    );
  }

  @override
  Future<TalkAiSeatRequest> confirmQuote({
    required String talkId,
    required String quoteId,
  }) async {
    return const TalkAiSeatRequest(
      requestId: 'request-1',
      status: TalkAiSeatRequestStatus.pendingHost,
      message: 'Waiting for the Host.',
    );
  }
}

Widget _app({
  required TalkAiSeatTransport transport,
  required bool isHost,
}) {
  return ProviderScope(
    overrides: [
      talkAiSeatTransportProvider.overrideWithValue(transport),
    ],
    child: MaterialApp(
      theme: buildMasanawaTheme(brightness: Brightness.light),
      home: AddAiSeatSheet(
        talkId: 'talk-1',
        isHost: isHost,
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
}

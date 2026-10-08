import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/screens/talks/talk_gift_stage_overlay.dart';
import 'package:masanawa/src/talks/talk_gift.dart';

void main() {
  const item = TalkGiftCatalogItem(
    id: 'heart',
    name: 'Heart',
    visual: 'heart',
    amountCredits: 100,
    available: true,
  );
  final receipt = TalkGiftReceipt(
    giftId: 'ledger-1',
    talkId: 'talk-1',
    recipientUserId: 'host-1',
    recipientName: 'Amina',
    amountCredits: 100,
    catalogItemId: 'heart',
    completedAt: DateTime.utc(2026, 10, 8),
  );

  testWidgets('settled gift acknowledgement ignores taps and announces recipient',
      (tester) async {
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(body: Stack(children: [
        const Center(child: Text('Talk audio')),
        TalkGiftStageOverlay(receipt: receipt, item: item),
      ])),
    ));
    await tester.pumpAndSettle();
    expect(find.text('Talk audio'), findsOneWidget);
    expect(find.text('Sent to Amina'), findsOneWidget);
    expect(find.text('Heart'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('reduced motion skips the scaling tween', (tester) async {
    await tester.pumpWidget(MaterialApp(
      home: MediaQuery(
        data: const MediaQueryData(disableAnimations: true),
        child: Scaffold(body: TalkGiftStageOverlay(receipt: receipt, item: item)),
      ),
    ));
    expect(find.byType(TweenAnimationBuilder<double>), findsNothing);
    expect(find.text('Sent to Amina'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

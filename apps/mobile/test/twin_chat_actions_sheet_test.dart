import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/screens/chat/components/twin_chat_actions_sheet.dart';

void main() {
  testWidgets('keeps monetization actions in one compact sheet', (tester) async {
    var gift = false;
    var buy = false;
    var owner = false;
    var profile = false;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: TwinChatActionsSheet(
            ownerName: 'Amina',
            onGift: () => gift = true,
            onBuy: () => buy = true,
            onRequestOwner: () => owner = true,
            onViewProfile: () => profile = true,
          ),
        ),
      ),
    );

    expect(find.text('Buy something'), findsOneWidget);
    expect(find.text('Bless Amina'), findsOneWidget);
    expect(find.text('Talk to Amina'), findsOneWidget);
    expect(find.text('View twin profile'), findsOneWidget);

    await tester.tap(find.text('Buy something'));
    await tester.tap(find.text('Bless Amina'));
    await tester.tap(find.text('Talk to Amina'));
    await tester.tap(find.text('View twin profile'));

    expect(buy, isTrue);
    expect(gift, isTrue);
    expect(owner, isTrue);
    expect(profile, isTrue);
  });

  testWidgets('hides unavailable gift and owner actions', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: TwinChatActionsSheet(
            ownerName: 'Amina',
            giftsEnabled: false,
            ownerAccessEnabled: false,
            onGift: () {},
            onBuy: () {},
            onRequestOwner: () {},
            onViewProfile: () {},
          ),
        ),
      ),
    );

    expect(find.text('Bless Amina'), findsNothing);
    expect(find.text('Talk to Amina'), findsNothing);
    expect(find.text('Buy something'), findsOneWidget);
    expect(find.text('View twin profile'), findsOneWidget);
  });
}

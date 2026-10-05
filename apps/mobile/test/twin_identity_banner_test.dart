import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/screens/chat/components/twin_identity_banner.dart';

void main() {
  testWidgets('labels AI twin presence clearly', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: TwinIdentityBanner(
            ownerName: 'Abdullahi',
            presence: TwinConversationPresence.aiTwin,
          ),
        ),
      ),
    );

    expect(find.text("Abdullahi's AI twin"), findsOneWidget);
    expect(
      find.text(
        'You are talking to an AI representative, not the human owner.',
      ),
      findsOneWidget,
    );
    expect(find.text('AI twin'), findsOneWidget);
  });

  testWidgets('switches identity when the real owner joins', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: TwinIdentityBanner(
            ownerName: 'Abdullahi',
            presence: TwinConversationPresence.humanOwner,
          ),
        ),
      ),
    );

    expect(find.text('Abdullahi joined'), findsOneWidget);
    expect(
      find.text('You are now talking to the real owner.'),
      findsOneWidget,
    );
    expect(find.text('Owner'), findsOneWidget);
    expect(find.text("Abdullahi's AI twin"), findsNothing);
  });
}

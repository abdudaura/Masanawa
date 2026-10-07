import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/screens/you/you_screen.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

void main() {
  testWidgets('You stays compact and opens Talk library destinations',
      (tester) async {
    var myTalks = 0;
    var saved = 0;

    await tester.pumpWidget(
      MaterialApp(
        theme: buildMasanawaTheme(brightness: Brightness.light),
        home: YouScreen(
          onOpenMyTalks: () => myTalks += 1,
          onOpenSaved: () => saved += 1,
        ),
      ),
    );

    expect(find.text('My Talks'), findsOneWidget);
    expect(find.text('Saved Talks'), findsOneWidget);
    expect(find.text('Wallet & earnings'), findsOneWidget);
    expect(find.text('Bills'), findsOneWidget);
    expect(find.text('Crypto'), findsOneWidget);
    expect(find.byType(GridView), findsNothing);

    await tester.tap(find.text('My Talks'));
    await tester.pump();
    expect(myTalks, 1);

    await tester.tap(find.text('Saved Talks'));
    await tester.pump();
    expect(saved, 1);
  });
}

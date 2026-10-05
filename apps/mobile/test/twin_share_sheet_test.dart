import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/screens/twin/twin_share_sheet.dart';

void main() {
  testWidgets('shows the public twin link and invokes share callback', (tester) async {
    String? shared;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: TwinShareSheet(
            displayName: 'Abdullahi',
            publicUrl: 'https://masanawa.com/abdullahi',
            onShare: (url) async {
              shared = url;
            },
          ),
        ),
      ),
    );

    expect(find.text('https://masanawa.com/abdullahi'), findsOneWidget);
    expect(find.text('Share Abdullahi’s twin'), findsOneWidget);

    await tester.tap(find.text('Share'));
    await tester.pump();

    expect(shared, 'https://masanawa.com/abdullahi');
  });
}

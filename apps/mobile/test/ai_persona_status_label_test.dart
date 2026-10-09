import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/screens/chat/components/ai_persona_status_label.dart';

void main() {
  testWidgets('private persona header identifies AI when available', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: AiPersonaStatusLabel(status: 'Available'),
        ),
      ),
    );
    expect(find.text('AI · Available'), findsOneWidget);
    expect(find.byType(AiPersonaStatusLabel), findsOneWidget);
  });

  testWidgets('empty or transient status never hides AI disclosure', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: AiPersonaStatusLabel(status: '  '),
        ),
      ),
    );
    expect(find.text('AI persona'), findsOneWidget);
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: AiPersonaStatusLabel(status: 'Typing…'),
        ),
      ),
    );
    expect(find.text('AI · Typing…'), findsOneWidget);
  });
}

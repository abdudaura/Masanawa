import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/agents/agent_shell.dart';
import 'package:masanawa/src/operator_voice/private_voice_assistant_panel.dart';
import 'package:masanawa/src/operator_voice/private_voice_operator.dart';
import 'package:mocktail/mocktail.dart';

class _Shell extends Mock implements AgentShellTransport {}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('typed mode works without microphone; review is explicit',
      (tester) async {
    final voice = PrivateVoiceOperator(
      shell: _Shell(),
      focus: PrivateVoiceFocus(),
    );
    var sent = 0;
    final submissions = <VoiceReviewDraft>[];
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: SingleChildScrollView(
          child: PrivateVoiceAssistantPanel(
            operator: voice,
            accountId: 'account-a',
            characterId: 'gwani',
            characterSessionId: 'session-a',
            characterName: 'Gwani',
            admissionId: 'already-authorized',
            onSubmitReviewed: (review) async {
              sent++;
              submissions.add(review);
            },
          ),
        ),
      ),
    ));
    await tester.pump();
    expect(find.text('Microphone off'), findsOneWidget);
    await tester.enterText(find.byKey(const Key('u09_draft')), 'Explain data plans');
    await tester.pump();
    expect(sent, 0);
    await tester.tap(find.byKey(const Key('u09_review_draft')));
    await tester.pumpAndSettle();
    expect(find.text('Review before sending'), findsOneWidget);
    expect(sent, 0);
    await tester.tap(find.text('Edit'));
    await tester.pumpAndSettle();
    expect(sent, 0);
    await tester.tap(find.byKey(const Key('u09_review_draft')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Send to Assistant'));
    await tester.pumpAndSettle();
    expect(sent, 1);
    expect(submissions.single.characterSessionId, 'session-a');
    expect(submissions.single.text, 'Explain data plans');
    expect(voice.review(), isNull);
    await tester.pumpWidget(const SizedBox());
    voice.dispose();
  });

  testWidgets('switching accounts invalidates the prior private draft',
      (tester) async {
    final voice = PrivateVoiceOperator(
      shell: _Shell(),
      focus: PrivateVoiceFocus(),
    );
    Widget panel(String account) => MaterialApp(
      home: Scaffold(
        body: PrivateVoiceAssistantPanel(
          operator: voice,
          accountId: account,
          characterId: 'gwani',
          characterSessionId: 'session-$account',
          characterName: 'Gwani',
          admissionId: 'approved',
          onSubmitReviewed: (_) async {
            fail('a stale reviewed draft must never send');
          },
        ),
      ),
    );
    await tester.pumpWidget(panel('a'));
    await tester.pump();
    await tester.enterText(find.byKey(const Key('u09_draft')), 'Private A');
    await tester.pump();
    expect(voice.review()?.text, 'Private A');
    await tester.pumpWidget(panel('b'));
    await tester.pump();
    expect(voice.review(), isNull);
    expect(find.text('Private A'), findsNothing);
    await tester.pumpWidget(const SizedBox());
    voice.dispose();
  });
}

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/rooms/study_center/study_center_models.dart';
import 'package:masanawa/src/rooms/study_center/study_center_screen.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

void main() {
  StudyCenterProjection singleSelectView() => const StudyCenterProjection(
        title: 'Study Center',
        subtitle: 'Continue where you stopped.',
        topic: 'Basic Economics',
        language: 'English',
        capabilities: StudyPresentationCapabilities(
          textEnabled: true,
          voiceEnabled: true,
        ),
        progress: StudyProgressProjection(
          completedSteps: 2,
          totalSteps: 5,
          continuation: StudyContinuation.continueLesson,
          canResume: true,
        ),
        card: StudyCardProjection(
          kind: StudyCardKind.singleSelect,
          title: 'Quick check',
          body: 'Choose one answer.',
          actionToken: 'opaque-action',
          revision: 4,
          options: [
            StudyOptionProjection(
              selectionId: 'sel-a',
              label: 'Answer A',
              selected: false,
            ),
            StudyOptionProjection(
              selectionId: 'sel-b',
              label: 'Answer B',
              selected: false,
            ),
          ],
          artifacts: [],
        ),
      );

  testWidgets('renders Study Center and emits opaque selection intent', (tester) async {
    StudyCenterActionIntent? emitted;
    await tester.pumpWidget(
      MaterialApp(
        theme: buildMasanawaTheme(brightness: Brightness.light),
        home: StudyCenterScreen(
          projection: singleSelectView(),
          loading: false,
          onAction: (value) => emitted = value,
        ),
      ),
    );

    expect(find.text('Basic Economics'), findsOneWidget);
    expect(find.text('Answer A'), findsOneWidget);
    expect(find.text('Listen'), findsOneWidget);

    await tester.tap(find.text('Answer A'));
    await tester.pump();

    expect(emitted?.kind, StudyCenterActionKind.select);
    expect(emitted?.actionToken, 'opaque-action');
    expect(emitted?.selectionId, 'sel-a');
    expect(emitted?.revision, 4);
  });

  testWidgets('free response emits bounded typed action', (tester) async {
    StudyCenterActionIntent? emitted;
    final view = StudyCenterProjection(
      title: 'Study Center',
      subtitle: 'Practice',
      topic: 'History',
      language: 'Hausa',
      capabilities: const StudyPresentationCapabilities(
        textEnabled: true,
        voiceEnabled: false,
      ),
      progress: const StudyProgressProjection(
        completedSteps: 1,
        totalSteps: 2,
        continuation: StudyContinuation.reteach,
        canResume: true,
      ),
      card: const StudyCardProjection(
        kind: StudyCardKind.freeResponse,
        title: 'Explain',
        body: 'Explain in your own words.',
        actionToken: 'free-action',
        revision: 1,
        options: [],
        artifacts: [],
      ),
    );

    await tester.pumpWidget(
      MaterialApp(
        theme: buildMasanawaTheme(brightness: Brightness.light),
        home: StudyCenterScreen(
          projection: view,
          loading: false,
          onAction: (value) => emitted = value,
        ),
      ),
    );

    await tester.enterText(find.byType(TextField), 'My explanation');
    await tester.tap(find.text('Send answer'));
    await tester.pump();

    expect(emitted?.kind, StudyCenterActionKind.freeResponse);
    expect(emitted?.responseText, 'My explanation');
    expect(emitted?.actionToken, 'free-action');
  });

  testWidgets('renders retryable isolated error state', (tester) async {
    var retries = 0;
    await tester.pumpWidget(
      MaterialApp(
        theme: buildMasanawaTheme(brightness: Brightness.light),
        home: StudyCenterScreen(
          projection: null,
          loading: false,
          errorMessage: 'Study progress is unavailable.',
          onRetry: () => retries++,
        ),
      ),
    );

    expect(find.text('Study progress is unavailable.'), findsOneWidget);
    await tester.tap(find.text('Try again'));
    expect(retries, 1);
  });
}

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/agents/clone_onboarding.dart';
import 'package:masanawa/src/agents/creator_clone.dart';
import 'package:masanawa/src/agents/twin_profile.dart';
import 'package:masanawa/src/state/clone_onboarding_controller.dart';
import 'package:masanawa/src/twin_training/twin_training_flow.dart';
import 'package:masanawa/src/twin_training/twin_training_screen.dart';

class _ReadyTransport implements CloneOnboardingTransport {
  @override
  Future<CloneOnboardingView> read() async => const CloneOnboardingView(
    revision: 5,
    state: 'ready',
    profile: CloneSetupProfile(
      displayName: 'Twin Owner',
      biography: 'Explains Hausa poetry',
      languages: ['Hausa'],
      personality: ['Calm'],
      expertise: ['Poetry'],
    ),
    confirmationRequestId: 'request_019a1b2c-1234-7abc-8abc-0123456789ab',
    confirmationPreviewRevision: 3,
    result: CreatorCloneResult(
      created: true,
      characterId: 'character_019a1b2c-1234-7abc-8abc-0123456789ab',
      characterVersionId: 'character-version_019a1b2c-1234-7abc-8abc-0123456789ab',
      relationshipId: 'relationship_019a1b2c-1234-7abc-8abc-0123456789ab',
      displayName: 'Twin Owner',
    ),
    prompt: 'Open clone',
  );

  @override
  Future<CloneOnboardingView> save({required int? expectedRevision, required Map<String, dynamic> profile}) =>
      throw StateError('not an editable setup');
  @override
  Future<CloneOnboardingView> preview(int expectedRevision) =>
      throw StateError('not an editable setup');
  @override
  Future<CloneOnboardingView> confirm({required int expectedPreviewRevision, required String requestId}) =>
      throw StateError('not an editable setup');
  @override
  Future<CloneOnboardingView> cancel(int expectedRevision) =>
      throw StateError('not an editable setup');
}

void main() {
  testWidgets('private preview unavailable means no fake publish on narrow handset', (tester) async {
    tester.view.physicalSize = const Size(320, 690);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final flow = TwinTrainingFlow(
      onboarding: CloneOnboardingController(transport: _ReadyTransport()),
      profileTransport: const UnavailableTwinProfileTransport(),
    );
    addTearDown(flow.dispose);
    await tester.pumpWidget(MaterialApp(home: TwinTrainingScreen(flow: flow)));
    await tester.pumpAndSettle();

    expect(find.text('Train my AI Twin'), findsOneWidget);
    expect(find.text('Test private Twin conversation'), findsOneWidget);
    expect(find.textContaining('publishing is disabled'), findsOneWidget);
    final testButton = tester.widget<FilledButton>(
      find.widgetWithText(FilledButton, 'Test private Twin conversation'),
    );
    expect(testButton.onPressed, isNull);
    await tester.scrollUntilVisible(find.text('Publish Twin'), 150,
      scrollable: find.byType(Scrollable).first,
    );
    final publishButton = tester.widget<FilledButton>(
      find.widgetWithText(FilledButton, 'Publish Twin'),
    );
    expect(publishButton.onPressed, isNull);
    expect(tester.takeException(), isNull);
  });
}

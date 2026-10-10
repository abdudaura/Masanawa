import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/learning/learning_progress.dart';
import 'package:masanawa/src/learning/learning_progress_card.dart';

final saved = LearningReadback.fromJson({
  'state': 'available',
  'progress': {
    'topic': 'Fractions',
    'goal': 'Understand halves',
    'level': 'beginner',
    'checkpoint': 'Recognized 1/2',
    'nextStep': 'Add halves',
    'masteryNotes': ['Recognizes 1/2'],
    'updatedAt': '2026-10-09T00:00:00.000Z',
  },
});

class RecordingLearningTransport implements LearningTransport {
  RecordingLearningTransport({this.result});
  LearningReadback? result;
  Future<LearningReadback> Function()? overrideRead;
  Future<LearningActionOutcome> Function(LearningCommand)? overrideAction;
  final List<LearningCommand> actions = [];

  @override
  Future<LearningReadback> read({
    required String characterId,
    required String relationshipId,
  }) async {
    if (overrideRead != null) return overrideRead!();
    return result ?? const LearningReadback(checkpoint: null);
  }

  @override
  Future<LearningActionOutcome> perform({
    required String characterId,
    required String relationshipId,
    required LearningCommand command,
  }) async {
    actions.add(command);
    if (overrideAction != null) return overrideAction!(command);
    return LearningActionOutcome(
      state: 'accepted',
      latest: result ?? const LearningReadback(checkpoint: null),
    );
  }
}

LearningProgressController controller(RecordingLearningTransport transport) =>
    LearningProgressController(
      transport: transport,
      issueRequestId: () => 'durable-request-0001',
      accountKey: 'session-A',
      characterId: 'character-A',
      relationshipId: 'relationship-A',
    );

void main() {
  test('parses only actual bounded saved checkpoints and honest outcomes', () {
    expect(saved.checkpoint!.topic, 'Fractions');
    expect(saved.checkpoint!.updatedAt.isUtc, isTrue);
    expect(
      () => LearningReadback.fromJson({
        'state': 'available',
        'progress': {
          'topic': 'Fake lesson',
          'updatedAt': 'invalid-date',
          'masteryNotes': [],
        },
      }),
      throwsFormatException,
    );
    expect(
      () => LearningActionOutcome.fromJson({
        'state': 'finished', // unsupported claims cannot imply success
        'latest': {'state': 'empty', 'progress': null},
      }),
      throwsFormatException,
    );
  });

  test('readback drives progress and accepted action is not saved completion', () async {
    final transport = RecordingLearningTransport(result: saved);
    final state = controller(transport);
    await state.refresh();
    expect(state.checkpoint!.nextStep, 'Add halves');
    await state.act(LearningAction.practice);
    expect(transport.actions.single.toJson(), {
      'action': 'practice',
      'requestId': 'durable-request-0001',
      'expectedUpdatedAt': '2026-10-09T00:00:00.000Z',
    });
    expect(state.lastActionState, 'accepted');
    expect(state.checkpoint!.checkpoint, 'Recognized 1/2');
    state.dispose();
  });

  test('unknown operation never auto-retries and blocks second write', () async {
    final transport = RecordingLearningTransport(result: saved);
    transport.overrideAction = (_) async => throw StateError('timeout after send');
    final state = controller(transport);
    await state.refresh();
    await state.act(LearningAction.continueLesson);
    expect(state.needsReconciliation, isTrue);
    await state.refresh();
    await state.act(LearningAction.practice);
    expect(transport.actions.length, 1);
    state.acknowledgeReconciledTask(); // Only after external verified task readback
    expect(state.needsReconciliation, isFalse);
    state.dispose();
  });

  test('account switch discards stale in-flight private checkpoint', () async {
    final completer = Completer<LearningReadback>();
    final transport = RecordingLearningTransport(result: saved);
    transport.overrideRead = () => completer.future;
    final state = controller(transport);
    final waiting = state.refresh();
    state.changeSession(
      accountKey: 'session-B',
      characterId: 'character-B',
      relationshipId: 'relationship-B',
    );
    completer.complete(saved);
    await waiting;
    expect(state.checkpoint, isNull);
    expect(state.busy, isFalse);
    state.dispose();
  });

  test('requires nonempty learner answer before server dispatch', () async {
    final transport = RecordingLearningTransport(result: saved);
    final state = controller(transport);
    await state.act(LearningAction.answer, answer: '  ');
    expect(transport.actions, isEmpty);
    expect(state.error, contains('Enter an answer'));
    state.dispose();
  });

  testWidgets('renders real saved learning and provides bounded Study actions',
      (tester) async {
    final transport = RecordingLearningTransport(result: saved);
    final state = controller(transport);
    await state.refresh();
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: SingleChildScrollView(child: LearningProgressCard(controller: state)),
      ),
    ));
    expect(find.text('Fractions'), findsOneWidget);
    expect(find.text('Next: Add halves'), findsOneWidget);
    await tester.tap(find.text('Practice'));
    await tester.pump();
    expect(transport.actions.single.action, LearningAction.practice);
    expect(find.textContaining('Request accepted'), findsOneWidget);
    await tester.enterText(find.byType(TextField), 'A private answer');
    state.changeSession(
      accountKey: 'session-B',
      characterId: 'character-B',
      relationshipId: 'relationship-B',
    );
    await tester.pump();
    expect(find.text('A private answer'), findsNothing);
    expect(state.checkpoint, isNull);
    await tester.pumpWidget(const SizedBox.shrink());
    state.dispose();
  });
}

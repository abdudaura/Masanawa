import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/rooms/study_center/study_center_models.dart';

void main() {
  test('parses resumable voice/text Study projection', () {
    final view = StudyCenterProjection.fromJson({
      'title': 'Study Center',
      'subtitle': 'Continue where you stopped.',
      'topic': 'Basic Economics',
      'language': 'English',
      'capabilities': {
        'textEnabled': true,
        'voiceEnabled': true,
      },
      'progress': {
        'completedSteps': 2,
        'totalSteps': 5,
        'continuation': 'continue',
        'canResume': true,
      },
      'card': {
        'kind': 'single-select',
        'title': 'Quick check',
        'body': 'Which answer is correct?',
        'actionToken': 'opaque-action-1',
        'revision': 3,
        'options': [
          {'selectionId': 'sel-a', 'label': 'A', 'selected': false},
          {'selectionId': 'sel-b', 'label': 'B', 'selected': false},
        ],
        'artifacts': [],
      },
    });

    expect(view.capabilities.voiceEnabled, isTrue);
    expect(view.progress.fraction, .4);
    expect(view.card?.kind, StudyCardKind.singleSelect);
    expect(view.card?.actionToken, 'opaque-action-1');
  });

  test('rejects interactive card without server action token', () {
    expect(
      () => StudyCardProjection.fromJson({
        'kind': 'free-response',
        'title': 'Explain',
        'body': 'Explain the idea.',
        'actionToken': null,
        'revision': 0,
        'options': [],
        'artifacts': [],
      }),
      throwsFormatException,
    );
  });

  test('rejects impossible progress and no presentation modes', () {
    expect(
      () => StudyProgressProjection.fromJson({
        'completedSteps': 4,
        'totalSteps': 3,
        'continuation': 'continue',
        'canResume': true,
      }),
      throwsFormatException,
    );
    expect(
      () => StudyPresentationCapabilities.fromJson({
        'textEnabled': false,
        'voiceEnabled': false,
      }),
      throwsFormatException,
    );
  });

  test('creates typed intents without learner-scope authority', () {
    final action = StudyCenterActionIntent.select(
      actionToken: 'opaque',
      selectionId: 'selection',
      revision: 2,
    );
    expect(action.kind, StudyCenterActionKind.select);
    expect(action.actionToken, 'opaque');
    expect(action.selectionId, 'selection');
    expect(action.revision, 2);
  });
}

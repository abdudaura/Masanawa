import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/state/ai_chat_state.dart';

void main() {
  test('Twin interview facts survive ChatThread serialization', () {
    final thread = ChatThread(
      characterId: 'character_gwani',
      twinInterviewFacts: {
        'personality': ['patient', 'direct'],
        'helpStyle': 'practical',
        'humor': true,
      },
    );

    final restored = ChatThread.fromJson(thread.toJson());

    expect(restored.twinInterviewFacts, {
      'personality': ['patient', 'direct'],
      'helpStyle': 'practical',
      'humor': true,
    });
  });

  test('completed Twin setup can clear persisted interview facts', () {
    final thread = ChatThread(
      characterId: 'character_gwani',
      twinInterviewFacts: const {'helpStyle': 'practical'},
    );

    final cleared = thread.copyWith(
      twinInterviewFacts: const <String, dynamic>{},
    );

    expect(cleared.twinInterviewFacts, isEmpty);
    expect(cleared.toJson().containsKey('twinInterviewFacts'), isFalse);
  });
}

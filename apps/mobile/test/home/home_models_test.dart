import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/home/home_models.dart';

void main() {
  test('Home snapshot resolves assistant slots without relying on list order', () {
    const gwani = HomeAssistantCardModel(
      role: HomeAssistantRole.gwani,
      characterId: 'server-character-42',
      displayName: 'Gwani',
      description: 'General assistant',
    );
    const gwana = HomeAssistantCardModel(
      role: HomeAssistantRole.gwana,
      characterId: 'server-character-17',
      displayName: 'Gwana',
      description: 'General assistant',
    );

    const snapshot = HomeSnapshot(
      assistants: [gwani, gwana],
      rooms: [],
    );

    expect(
      snapshot.assistantFor(HomeAssistantRole.gwana)?.characterId,
      'server-character-17',
    );
    expect(
      snapshot.assistantFor(HomeAssistantRole.gwani)?.characterId,
      'server-character-42',
    );
  });

  test('Assistant initials are presentation-only and safe for empty names', () {
    const named = HomeAssistantCardModel(
      role: HomeAssistantRole.gwana,
      characterId: 'id-1',
      displayName: 'Amina Bello',
      description: 'Assistant',
    );
    const empty = HomeAssistantCardModel(
      role: HomeAssistantRole.gwani,
      characterId: 'id-2',
      displayName: '   ',
      description: 'Assistant',
    );

    expect(named.initials, 'AB');
    expect(empty.initials, '?');
  });

  test('Home ready state can represent a genuinely empty server projection', () {
    const state = HomeViewState.ready(
      HomeSnapshot(assistants: [], rooms: []),
    );

    expect(state.status, HomeLoadStatus.ready);
    expect(state.snapshot?.hasMeaningfulContent, isFalse);
  });
}

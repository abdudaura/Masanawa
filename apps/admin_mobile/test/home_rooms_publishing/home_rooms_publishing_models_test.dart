import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa_admin/src/home_rooms_publishing/home_rooms_publishing_models.dart';

void main() {
  test('parses publishing projection', () {
    final projection = HomeRoomsPublishingProjection.fromJson({
      'revision': 3,
      'storySeries': [
        {'seriesId': 'series-1', 'title': 'Northern Tales', 'published': true, 'sortOrder': 1}
      ],
      'newsCategories': [
        {'categoryId': 'world', 'label': 'World', 'visible': true, 'sortOrder': 1, 'pinnedItemId': 'news-1'}
      ],
      'homeRooms': [
        {'roomKey': 'study-center', 'label': 'Study Center', 'visible': true, 'sortOrder': 2}
      ],
      'assistants': [
        {'characterId': 'character-1', 'displayName': 'Gwana', 'position': 'left', 'visible': true}
      ],
    });

    expect(projection.revision, 3);
    expect(projection.storySeries.single.published, isTrue);
    expect(projection.newsCategories.single.pinnedItemId, 'news-1');
    expect(projection.assistants.single.position, 'left');
  });

  test('mutation carries optimistic revision', () {
    final intent = PublishingMutationIntent.setVisibility(
      kind: PublishingMutationKind.setHomeRoomVisibility,
      targetId: 'study-center',
      visible: false,
      expectedRevision: 7,
    );
    expect(intent.expectedRevision, 7);
    expect(intent.visible, isFalse);
  });

  test('rejects invalid assistant position', () {
    expect(
      () => PublishingMutationIntent.updateAssistant(
        characterId: 'character-1',
        displayName: 'Gwana',
        position: 'center',
        visible: true,
        expectedRevision: 1,
      ),
      throwsArgumentError,
    );
  });

  test('rejects invalid mutation identity and revisions', () {
    expect(
      () => PublishingMutationIntent.setVisibility(
        kind: PublishingMutationKind.setHomeRoomVisibility,
        targetId: '   ',
        visible: true,
        expectedRevision: 1,
      ),
      throwsArgumentError,
    );
    expect(
      () => PublishingMutationIntent.reorderRoom(
        roomKey: 'study-center',
        sortOrder: 1,
        expectedRevision: 0,
      ),
      throwsArgumentError,
    );
    expect(
      () => PublishingMutationIntent.pinNews(
        categoryId: 'world',
        itemId: '   ',
        expectedRevision: 2,
      ),
      throwsArgumentError,
    );
    expect(
      () => PublishingMutationIntent.updateAssistant(
        characterId: 'character-1',
        displayName: '   ',
        position: 'left',
        visible: true,
        expectedRevision: 2,
      ),
      throwsArgumentError,
    );
  });
}

import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa_admin/src/home_rooms_publishing/home_rooms_publishing_models.dart';

void main() {
  test('parses target-specific publishing revisions', () {
    final projection = HomeRoomsPublishingProjection.fromJson({
      'storySeries': [
        {
          'seriesId': 'series-1',
          'title': 'Northern Tales',
          'published': true,
          'sortOrder': 1,
        }
      ],
      'newsCategories': [
        {
          'categoryId': 'world',
          'label': 'World',
          'visible': true,
          'sortOrder': 1,
          'pinnedItemId': 'news-1',
          'revision': 4,
        }
      ],
      'homeRooms': [
        {
          'roomKey': 'study-center',
          'label': 'Study Center',
          'visible': true,
          'sortOrder': 2,
          'revision': 7,
        }
      ],
      'assistants': [
        {
          'characterId': 'character-1',
          'displayName': 'Gwana',
          'position': 'left',
          'visible': true,
          'revision': 11,
        }
      ],
    });

    expect(projection.storySeries.single.published, isTrue);
    expect(projection.newsCategories.single.revision, 4);
    expect(projection.homeRooms.single.revision, 7);
    expect(projection.assistants.single.revision, 11);
  });

  test('rejects missing target revisions', () {
    expect(
      () => NewsCategoryAdminItem.fromJson({
        'categoryId': 'world',
        'label': 'World',
        'visible': true,
        'sortOrder': 1,
        'pinnedItemId': null,
      }),
      throwsFormatException,
    );
  });

  test('mutation carries exact target revision', () {
    final intent = PublishingMutationIntent.setVisibility(
      kind: PublishingMutationKind.setHomeRoomVisibility,
      targetId: 'study-center',
      visible: false,
      expectedRevision: 7,
    );
    expect(intent.expectedRevision, 7);
    expect(intent.visible, isFalse);
  });

  test('generic publishing no longer accepts Story visibility mutation', () {
    expect(
      () => PublishingMutationIntent.setVisibility(
        kind: PublishingMutationKind.pinNewsItem,
        targetId: 'series-1',
        visible: true,
        expectedRevision: 1,
      ),
      throwsArgumentError,
    );
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
  });
}

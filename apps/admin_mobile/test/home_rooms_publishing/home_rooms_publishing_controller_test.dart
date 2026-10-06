import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa_admin/src/home_rooms_publishing/home_rooms_publishing_controller.dart';
import 'package:masanawa_admin/src/home_rooms_publishing/home_rooms_publishing_models.dart';

void main() {
  HomeRoomsPublishingProjection projection({
    int newsRevision = 4,
    int roomRevision = 7,
    int assistantRevision = 11,
  }) =>
      HomeRoomsPublishingProjection(
        storySeries: const [],
        newsCategories: [
          NewsCategoryAdminItem(
            categoryId: 'world',
            label: 'World',
            visible: true,
            sortOrder: 1,
            pinnedItemId: null,
            revision: newsRevision,
          ),
        ],
        homeRooms: [
          HomeRoomAdminItem(
            roomKey: 'study-center',
            label: 'Study Center',
            visible: true,
            sortOrder: 2,
            revision: roomRevision,
          ),
        ],
        assistants: [
          AssistantHomePresentation(
            characterId: 'character-1',
            displayName: 'Gwana',
            position: 'left',
            visible: true,
            revision: assistantRevision,
          ),
        ],
      );

  test('loads target-specific revisions', () async {
    final transport = _FakeTransport(
      projection(),
      projection(newsRevision: 5),
    );
    final controller = HomeRoomsPublishingController(transport);

    final state = await controller.load();

    expect(state.projection?.newsCategories.single.revision, 4);
    expect(state.projection?.homeRooms.single.revision, 7);
    expect(state.errorMessage, isNull);
  });

  test('News mutation validates and advances only News revision', () async {
    final transport = _FakeTransport(
      projection(),
      projection(newsRevision: 5),
    );
    final controller = HomeRoomsPublishingController(transport);
    await controller.load();

    final state = await controller.apply(
      PublishingMutationIntent.setVisibility(
        kind: PublishingMutationKind.setNewsCategoryVisibility,
        targetId: 'world',
        visible: false,
        expectedRevision: 4,
      ),
    );

    expect(state.projection?.newsCategories.single.revision, 5);
    expect(state.projection?.homeRooms.single.revision, 7);
    expect(transport.mutations, 1);
  });

  test('stale target revision fails before transport', () async {
    final transport = _FakeTransport(
      projection(),
      projection(roomRevision: 8),
    );
    final controller = HomeRoomsPublishingController(transport);
    await controller.load();

    expect(
      () => controller.apply(
        PublishingMutationIntent.setVisibility(
          kind: PublishingMutationKind.setHomeRoomVisibility,
          targetId: 'study-center',
          visible: false,
          expectedRevision: 6,
        ),
      ),
      throwsStateError,
    );
    expect(transport.mutations, 0);
  });

  test('mutation rejects response that does not advance target revision', () async {
    final transport = _FakeTransport(
      projection(),
      projection(newsRevision: 4, roomRevision: 8),
    );
    final controller = HomeRoomsPublishingController(transport);
    await controller.load();

    final state = await controller.apply(
      PublishingMutationIntent.pinNews(
        categoryId: 'world',
        itemId: 'news-1',
        expectedRevision: 4,
      ),
    );

    expect(state.errorMessage, contains('target revision did not advance'));
  });

  test('mutation rejects unavailable target before transport', () async {
    final transport = _FakeTransport(projection(), projection());
    final controller = HomeRoomsPublishingController(transport);
    await controller.load();

    expect(
      () => controller.apply(
        PublishingMutationIntent.pinNews(
          categoryId: 'missing',
          itemId: 'news-1',
          expectedRevision: 1,
        ),
      ),
      throwsStateError,
    );
    expect(transport.mutations, 0);
  });
}

class _FakeTransport implements HomeRoomsPublishingTransport {
  _FakeTransport(this.loaded, this.mutated);

  final HomeRoomsPublishingProjection loaded;
  final HomeRoomsPublishingProjection mutated;
  int mutations = 0;

  @override
  Future<HomeRoomsPublishingProjection> load() async => loaded;

  @override
  Future<HomeRoomsPublishingProjection> mutate(
    PublishingMutationIntent intent,
  ) async {
    mutations++;
    return mutated;
  }
}

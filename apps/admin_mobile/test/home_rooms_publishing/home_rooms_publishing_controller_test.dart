import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa_admin/src/home_rooms_publishing/home_rooms_publishing_controller.dart';
import 'package:masanawa_admin/src/home_rooms_publishing/home_rooms_publishing_models.dart';

void main() {
  HomeRoomsPublishingProjection projection(int revision) =>
      HomeRoomsPublishingProjection(
        storySeries: const [],
        newsCategories: const [],
        homeRooms: const [],
        assistants: const [],
        revision: revision,
      );

  test('loads canonical projection', () async {
    final transport = _FakeTransport(projection(2), projection(3));
    final controller = HomeRoomsPublishingController(transport);

    final state = await controller.load();

    expect(state.projection?.revision, 2);
    expect(state.errorMessage, isNull);
  });

  test('mutation must use current revision and advance it', () async {
    final transport = _FakeTransport(projection(4), projection(5));
    final controller = HomeRoomsPublishingController(transport);
    await controller.load();

    final state = await controller.apply(
      PublishingMutationIntent.setVisibility(
        kind: PublishingMutationKind.setHomeRoomVisibility,
        targetId: 'study-center',
        visible: false,
        expectedRevision: 4,
      ),
    );

    expect(state.projection?.revision, 5);
    expect(transport.mutations, 1);
  });

  test('stale local mutation fails before transport', () async {
    final transport = _FakeTransport(projection(7), projection(8));
    final controller = HomeRoomsPublishingController(transport);
    await controller.load();

    expect(
      () => controller.apply(
        PublishingMutationIntent.setVisibility(
          kind: PublishingMutationKind.setStoryVisibility,
          targetId: 'series-1',
          visible: false,
          expectedRevision: 6,
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

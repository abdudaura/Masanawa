import 'home_rooms_publishing_models.dart';

abstract class HomeRoomsPublishingTransport {
  Future<HomeRoomsPublishingProjection> load();

  Future<HomeRoomsPublishingProjection> mutate(
    PublishingMutationIntent intent,
  );
}

class HomeRoomsPublishingState {
  const HomeRoomsPublishingState({
    required this.loading,
    required this.saving,
    required this.projection,
    required this.errorMessage,
  });

  final bool loading;
  final bool saving;
  final HomeRoomsPublishingProjection? projection;
  final String? errorMessage;

  factory HomeRoomsPublishingState.initial() => const HomeRoomsPublishingState(
        loading: false,
        saving: false,
        projection: null,
        errorMessage: null,
      );

  HomeRoomsPublishingState copyWith({
    bool? loading,
    bool? saving,
    HomeRoomsPublishingProjection? projection,
    bool clearProjection = false,
    String? errorMessage,
    bool clearError = false,
  }) =>
      HomeRoomsPublishingState(
        loading: loading ?? this.loading,
        saving: saving ?? this.saving,
        projection: clearProjection ? null : (projection ?? this.projection),
        errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      );
}

class HomeRoomsPublishingController {
  HomeRoomsPublishingController(this.transport)
      : state = HomeRoomsPublishingState.initial();

  final HomeRoomsPublishingTransport transport;
  HomeRoomsPublishingState state;

  Future<HomeRoomsPublishingState> load() async {
    state = state.copyWith(loading: true, clearError: true);
    try {
      final projection = await transport.load();
      state = state.copyWith(
        loading: false,
        projection: projection,
        clearError: true,
      );
    } catch (error) {
      state = state.copyWith(
        loading: false,
        errorMessage: error.toString(),
      );
    }
    return state;
  }

  int _targetRevision(
    HomeRoomsPublishingProjection projection,
    PublishingMutationIntent intent,
  ) {
    switch (intent.kind) {
      case PublishingMutationKind.setNewsCategoryVisibility:
      case PublishingMutationKind.pinNewsItem:
        final item = projection.newsCategories
            .where((entry) => entry.categoryId == intent.targetId)
            .firstOrNull;
        if (item == null) {
          throw StateError('News publishing target is unavailable');
        }
        return item.revision;

      case PublishingMutationKind.setHomeRoomVisibility:
      case PublishingMutationKind.reorderHomeRoom:
        final item = projection.homeRooms
            .where((entry) => entry.roomKey == intent.targetId)
            .firstOrNull;
        if (item == null) {
          throw StateError('Home Room publishing target is unavailable');
        }
        return item.revision;

      case PublishingMutationKind.updateAssistantPresentation:
        final item = projection.assistants
            .where((entry) => entry.characterId == intent.targetId)
            .firstOrNull;
        if (item == null) {
          throw StateError('Assistant publishing target is unavailable');
        }
        return item.revision;
    }
  }

  Future<HomeRoomsPublishingState> apply(
    PublishingMutationIntent intent,
  ) async {
    if (state.saving) return state;
    final current = state.projection;
    if (current == null) {
      throw StateError('Publishing projection is not loaded');
    }

    final currentRevision = _targetRevision(current, intent);
    if (intent.expectedRevision != currentRevision) {
      throw StateError('Publishing target revision is stale');
    }

    state = state.copyWith(saving: true, clearError: true);
    try {
      final next = await transport.mutate(intent);
      final nextRevision = _targetRevision(next, intent);
      if (nextRevision <= currentRevision) {
        throw StateError('Publishing target revision did not advance');
      }
      state = state.copyWith(
        saving: false,
        projection: next,
        clearError: true,
      );
    } catch (error) {
      state = state.copyWith(
        saving: false,
        errorMessage: error.toString(),
      );
    }
    return state;
  }
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull {
    final iterator = this.iterator;
    return iterator.moveNext() ? iterator.current : null;
  }
}

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

  Future<HomeRoomsPublishingState> apply(
    PublishingMutationIntent intent,
  ) async {
    if (state.saving) return state;
    final current = state.projection;
    if (current == null) {
      throw StateError('Publishing projection is not loaded');
    }
    if (intent.expectedRevision != current.revision) {
      throw StateError('Publishing projection revision is stale');
    }

    state = state.copyWith(saving: true, clearError: true);
    try {
      final next = await transport.mutate(intent);
      if (next.revision <= current.revision) {
        throw StateError('Publishing mutation did not advance revision');
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

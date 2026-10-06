import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'internet_cafe_models.dart';

abstract class InternetCafeTransport {
  Future<InternetCafeRoomProjection> loadRoom();

  Future<InternetCafeRoomProjection> runQuickStart(
    InternetCafeQuickStart quickStart,
  );

  Future<InternetCafeRoomProjection> selectService(
    InternetCafeServiceOption service,
  );

  Future<InternetCafeRoomProjection> chooseSelectionOption({
    required InternetCafeSelectionProjection selection,
    required InternetCafeChoice option,
  });

  Future<InternetCafeRoomProjection> submitIntake(
    InternetCafeIntakeSubmission submission,
  );

  Future<InternetCafeRoomProjection> continueLastTask();
}

class UnavailableInternetCafeTransport implements InternetCafeTransport {
  const UnavailableInternetCafeTransport();

  Never _unavailable() {
    throw StateError('Internet Cafe is not connected to production transport yet');
  }

  @override
  Future<InternetCafeRoomProjection> loadRoom() async => _unavailable();

  @override
  Future<InternetCafeRoomProjection> runQuickStart(
    InternetCafeQuickStart quickStart,
  ) async =>
      _unavailable();

  @override
  Future<InternetCafeRoomProjection> selectService(
    InternetCafeServiceOption service,
  ) async =>
      _unavailable();

  @override
  Future<InternetCafeRoomProjection> chooseSelectionOption({
    required InternetCafeSelectionProjection selection,
    required InternetCafeChoice option,
  }) async =>
      _unavailable();

  @override
  Future<InternetCafeRoomProjection> submitIntake(
    InternetCafeIntakeSubmission submission,
  ) async =>
      _unavailable();

  @override
  Future<InternetCafeRoomProjection> continueLastTask() async => _unavailable();
}

class InternetCafeState {
  const InternetCafeState({
    this.projection,
    this.loading = false,
    this.submitting = false,
    this.errorMessage,
  });

  final InternetCafeRoomProjection? projection;
  final bool loading;
  final bool submitting;
  final String? errorMessage;

  InternetCafeState copyWith({
    InternetCafeRoomProjection? projection,
    bool? loading,
    bool? submitting,
    String? errorMessage,
    bool clearError = false,
  }) {
    return InternetCafeState(
      projection: projection ?? this.projection,
      loading: loading ?? this.loading,
      submitting: submitting ?? this.submitting,
      errorMessage:
          clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

class InternetCafeController extends StateNotifier<InternetCafeState> {
  InternetCafeController(this._transport) : super(const InternetCafeState());

  final InternetCafeTransport _transport;

  Future<void> load() async {
    state = state.copyWith(loading: true, clearError: true);
    try {
      final projection = await _transport.loadRoom();
      state = state.copyWith(
        projection: projection,
        loading: false,
        clearError: true,
      );
    } catch (_) {
      state = state.copyWith(
        loading: false,
        errorMessage: 'Internet Cafe is not available right now.',
      );
    }
  }

  Future<bool> runQuickStart(InternetCafeQuickStart quickStart) {
    final current = state.projection;
    final valid = current != null &&
        current.quickStarts.any(
          (candidate) =>
              candidate.intentId == quickStart.intentId &&
              candidate.serviceId == quickStart.serviceId,
        );
    if (!valid) {
      state = state.copyWith(
        errorMessage: 'This service changed. Refresh and try again.',
      );
      return Future.value(false);
    }

    return _runMutation(
      () => _transport.runQuickStart(quickStart),
      failureMessage: 'Could not start this service.',
    );
  }

  Future<bool> selectService(InternetCafeServiceOption service) {
    final current = state.projection?.serviceById(service.serviceId);
    if (current == null || current.intentId != service.intentId) {
      state = state.copyWith(
        errorMessage: 'This service changed. Refresh and try again.',
      );
      return Future.value(false);
    }

    return _runMutation(
      () => _transport.selectService(service),
      failureMessage: 'Could not open this service.',
    );
  }

  Future<bool> chooseSelectionOption({
    required InternetCafeSelectionProjection selection,
    required InternetCafeChoice option,
  }) {
    final current = state.projection?.activeSelection;
    if (current == null ||
        current.selectionId != selection.selectionId ||
        current.serviceId != selection.serviceId) {
      state = state.copyWith(
        errorMessage: 'This selection changed. Refresh and try again.',
      );
      return Future.value(false);
    }

    if (!current.options.any((candidate) => candidate.value == option.value)) {
      state = state.copyWith(errorMessage: 'That option is no longer available.');
      return Future.value(false);
    }

    return _runMutation(
      () => _transport.chooseSelectionOption(
        selection: current,
        option: option,
      ),
      failureMessage: 'Could not save that selection.',
    );
  }

  Future<bool> submitIntake(InternetCafeIntakeSubmission submission) {
    final service = state.projection?.serviceById(submission.serviceId);
    if (service == null || service.intentId != submission.intentId) {
      state = state.copyWith(
        errorMessage: 'This service changed. Refresh and try again.',
      );
      return Future.value(false);
    }

    try {
      InternetCafeIntakeSubmission.validated(
        service: service,
        values: submission.values,
      );
    } on FormatException {
      state = state.copyWith(
        errorMessage: 'Please review the information for this service.',
      );
      return Future.value(false);
    }

    return _runMutation(
      () => _transport.submitIntake(submission),
      failureMessage: 'Could not submit this task.',
    );
  }

  Future<bool> continueLastTask() {
    return _runMutation(
      _transport.continueLastTask,
      failureMessage: 'Could not continue your last task.',
    );
  }

  Future<bool> _runMutation(
    Future<InternetCafeRoomProjection> Function() action, {
    required String failureMessage,
  }) async {
    if (state.submitting) return false;

    state = state.copyWith(submitting: true, clearError: true);
    try {
      final projection = await action();
      state = state.copyWith(
        projection: projection,
        submitting: false,
        clearError: true,
      );
      return true;
    } catch (_) {
      state = state.copyWith(
        submitting: false,
        errorMessage: failureMessage,
      );
      return false;
    }
  }
}

final internetCafeTransportProvider = Provider<InternetCafeTransport>(
  (ref) => const UnavailableInternetCafeTransport(),
);

final internetCafeProvider =
    StateNotifierProvider<InternetCafeController, InternetCafeState>(
  (ref) => InternetCafeController(ref.watch(internetCafeTransportProvider)),
);

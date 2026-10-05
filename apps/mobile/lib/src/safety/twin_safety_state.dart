import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'twin_safety.dart';

final twinSafetyTransportProvider = Provider<TwinSafetyTransport>(
  (ref) => const UnavailableTwinSafetyTransport(),
);

class TwinSafetyController extends StateNotifier<AsyncValue<void>> {
  TwinSafetyController(this._transport)
      : super(const AsyncValue.data(null));

  final TwinSafetyTransport _transport;

  Future<bool> block(String characterId) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(
      () => _transport.block(characterId: characterId),
    );
    return !state.hasError;
  }

  Future<bool> unblock(String characterId) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(
      () => _transport.unblock(characterId: characterId),
    );
    return !state.hasError;
  }

  Future<bool> report({
    required String characterId,
    required TwinReportReason reason,
    String? detail,
  }) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(
      () => _transport.report(
        characterId: characterId,
        reason: reason,
        detail: detail,
      ),
    );
    return !state.hasError;
  }
}

final twinSafetyControllerProvider =
    StateNotifierProvider<TwinSafetyController, AsyncValue<void>>(
  (ref) => TwinSafetyController(ref.watch(twinSafetyTransportProvider)),
);

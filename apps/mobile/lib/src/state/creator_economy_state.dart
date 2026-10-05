import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../agents/creator_economy.dart';
import '../core/providers.dart';
import 'session_state.dart';

class CreatorEconomyController
    extends AsyncNotifier<CreatorEconomySnapshot?> {
  @override
  Future<CreatorEconomySnapshot?> build() async {
    final signedIn = ref.watch(isSignedInProvider);
    ref.watch(creatorEconomyTransportProvider);
    if (!signedIn) return null;
    return ref.read(creatorEconomyTransportProvider).load();
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(creatorEconomyTransportProvider).load(),
    );
  }

  Future<void> allocateFloat(int amountCredits) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref
          .read(creatorEconomyTransportProvider)
          .allocateFloat(amountCredits),
    );
  }
}

final creatorEconomyProvider = AsyncNotifierProvider<
    CreatorEconomyController, CreatorEconomySnapshot?>(
  CreatorEconomyController.new,
);

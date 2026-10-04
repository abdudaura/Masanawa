import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../agents/creator_economy.dart';
import '../core/providers.dart';
import 'agent_connection_state.dart';

class CreatorEconomyController
    extends AsyncNotifier<CreatorEconomySnapshot?> {
  @override
  Future<CreatorEconomySnapshot?> build() async {
    final connection = ref.watch(agentConnectionProvider);
    ref.watch(creatorEconomyTransportProvider);
    if (!connection.configured) return null;
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

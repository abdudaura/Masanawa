import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../agents/creator_skills.dart';
import '../core/providers.dart';
import 'session_state.dart';
import 'creator_economy_state.dart';

class CreatorSkillsController
    extends AsyncNotifier<List<CreatorSkillEntry>> {
  @override
  Future<List<CreatorSkillEntry>> build() async {
    final signedIn = ref.watch(isSignedInProvider);
    ref.watch(creatorSkillTransportProvider);
    final economy = ref.watch(creatorEconomyProvider).asData?.value;
    if (!signedIn || economy?.hasClone != true) {
      return const [];
    }
    return ref.read(creatorSkillTransportProvider).load();
  }

  Future<void> refresh() async {
    final economy = ref.read(creatorEconomyProvider).asData?.value;
    if (economy?.hasClone != true) {
      state = const AsyncData([]);
      return;
    }
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(creatorSkillTransportProvider).load(),
    );
  }

  Future<void> setEnabled(
    CreatorSkillEntry skill,
    bool enabled,
  ) async {
    final previous = state;
    state = const AsyncLoading();
    final result = await AsyncValue.guard(
      () => ref
          .read(creatorSkillTransportProvider)
          .setEnabled(skill.skillVersionId, enabled),
    );
    if (result.hasError) {
      state = previous;
      throw result.error!;
    }
    state = result;
  }
}

final creatorSkillsProvider = AsyncNotifierProvider<
    CreatorSkillsController, List<CreatorSkillEntry>>(
  CreatorSkillsController.new,
);

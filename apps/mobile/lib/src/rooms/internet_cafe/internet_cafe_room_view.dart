import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'internet_cafe_room_screen.dart';
import 'internet_cafe_state.dart';

class InternetCafeRoomView extends ConsumerStatefulWidget {
  const InternetCafeRoomView({super.key});

  @override
  ConsumerState<InternetCafeRoomView> createState() => _InternetCafeRoomViewState();
}

class _InternetCafeRoomViewState extends ConsumerState<InternetCafeRoomView> {
  @override
  void initState() {
    super.initState();
    Future<void>.microtask(
      () => ref.read(internetCafeProvider.notifier).load(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(internetCafeProvider);
    final controller = ref.read(internetCafeProvider.notifier);

    return InternetCafeRoomScreen(
      projection: state.projection,
      loading: state.loading || state.submitting,
      errorMessage: state.errorMessage,
      onRetry: controller.load,
      onQuickStart: controller.runQuickStart,
      onServiceSelected: controller.selectService,
      onSelectionOptionSelected: (selection, option) {
        controller.chooseSelectionOption(
          selection: selection,
          option: option,
        );
      },
      onSubmitIntake: controller.submitIntake,
      onContinue: controller.continueLastTask,
    );
  }
}

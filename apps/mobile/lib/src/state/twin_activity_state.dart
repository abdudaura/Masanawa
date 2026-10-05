import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../agents/twin_activity.dart';
import 'session_state.dart';

/// Feature-local provider. The shared integration lane replaces this with the
/// authenticated Gateway transport without forcing Activity to own shared files.
final twinActivityTransportProvider = Provider<TwinActivityTransport>(
  (ref) => const UnavailableTwinActivityTransport(),
);

class TwinActivityController extends AsyncNotifier<TwinActivityView?> {
  @override
  Future<TwinActivityView?> build() async {
    final signedIn = ref.watch(isSignedInProvider);
    final transport = ref.watch(twinActivityTransportProvider);
    if (!signedIn) return null;
    return transport.load();
  }

  Future<void> refresh() async {
    if (!ref.read(isSignedInProvider)) return;
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(twinActivityTransportProvider).load(),
    );
  }
}

final twinActivityProvider =
    AsyncNotifierProvider<TwinActivityController, TwinActivityView?>(
  TwinActivityController.new,
);

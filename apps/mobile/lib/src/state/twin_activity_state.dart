import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../agents/twin_activity.dart';
import '../agents/twin_activity_http_transport.dart';
import '../core/providers.dart';
import 'session_state.dart';

final twinActivityTransportProvider = Provider<TwinActivityTransport>(
  (ref) => GatewayTwinActivityTransport(api: ref.watch(apiClientProvider)),
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

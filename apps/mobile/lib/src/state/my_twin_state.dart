import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../agents/twin_profile.dart';
import '../agents/twin_profile_http_transport.dart';
import '../core/providers.dart';
import 'session_state.dart';

final twinProfileTransportProvider = Provider<TwinProfileTransport>(
  (ref) => GatewayTwinProfileTransport(api: ref.watch(apiClientProvider)),
);

class MyTwinController extends AsyncNotifier<TwinProfile?> {
  @override
  Future<TwinProfile?> build() async {
    final signedIn = ref.watch(isSignedInProvider);
    final transport = ref.watch(twinProfileTransportProvider);
    if (!signedIn) return null;
    return transport.load();
  }

  Future<void> refresh() async {
    if (!ref.read(isSignedInProvider)) return;
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(twinProfileTransportProvider).load(),
    );
  }

  Future<void> setDiscoverable(bool value) async {
    final previous = state.valueOrNull;
    if (previous == null || !previous.hasTwin) return;
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(twinProfileTransportProvider).setDiscoverable(value),
    );
  }
}

final myTwinProvider =
    AsyncNotifierProvider<MyTwinController, TwinProfile?>(
  MyTwinController.new,
);

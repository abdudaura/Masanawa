import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../commerce/wallet_models.dart';
import 'session_state.dart';

final walletTransportProvider = Provider<WalletTransport>(
  (ref) => const UnavailableWalletTransport(),
);

class WalletController extends AsyncNotifier<WalletView?> {
  @override
  Future<WalletView?> build() async {
    final signedIn = ref.watch(isSignedInProvider);
    final transport = ref.watch(walletTransportProvider);
    if (!signedIn) return null;
    return transport.load();
  }

  Future<void> refresh() async {
    if (!ref.read(isSignedInProvider)) return;
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(walletTransportProvider).load(),
    );
  }
}

final walletProvider =
    AsyncNotifierProvider<WalletController, WalletView?>(
  WalletController.new,
);

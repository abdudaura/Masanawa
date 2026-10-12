import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../commerce/wallet_http_transport.dart';
import '../commerce/wallet_models.dart';
import '../core/providers.dart';
import 'session_state.dart';

final walletTransportProvider = Provider<WalletTransport>(
  (ref) => GatewayWalletTransport(api: ref.watch(apiClientProvider)),
);

class WalletController extends AsyncNotifier<WalletView?> {
  String? _accountId(SessionState session) =>
      session is SessionSignedIn ? session.user.id : null;

  @override
  Future<WalletView?> build() async {
    final accountId = ref.watch(sessionProvider.select(_accountId));
    final transport = ref.watch(walletTransportProvider);
    if (accountId == null) return null;
    return transport.load();
  }

  Future<void> refresh() async {
    final accountId = _accountId(ref.read(sessionProvider));
    if (accountId == null) return;
    // Keep every read under Riverpod's Future lifecycle. Manual state writes
    // after await bypass its stale-result fencing, including the initial load
    // completing after a refresh or a response arriving after account changes.
    ref.invalidateSelf();
    try {
      await future;
    } catch (_) {
      // build publishes AsyncError for the mounted retry UI. RefreshIndicator
      // and existing background callers do not need an unhandled rejection.
    }
  }

  Future<CreditTransferReceipt?> sendCredits({
    required String recipient,
    required int amountCredits,
  }) async {
    try {
      final receipt = await ref
          .read(walletTransportProvider)
          .sendCredits(recipient: recipient, amountCredits: amountCredits);
      await refresh();
      return receipt;
    } catch (_) {
      return null;
    }
  }

  Future<GiftReceipt?> sendGift({
    required String recipientCharacterId,
    required int amountCredits,
  }) async {
    try {
      final receipt = await ref
          .read(walletTransportProvider)
          .sendGift(
            recipientCharacterId: recipientCharacterId,
            amountCredits: amountCredits,
          );
      await refresh();
      return receipt;
    } catch (_) {
      return null;
    }
  }
}

final walletProvider = AsyncNotifierProvider<WalletController, WalletView?>(
  WalletController.new,
);

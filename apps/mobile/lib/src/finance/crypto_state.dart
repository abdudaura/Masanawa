import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../agents/masanawa_transport.dart';
import '../core/providers.dart';
import 'crypto_models.dart';
import 'crypto_transport.dart';

class CryptoWalletSnapshot {
  const CryptoWalletSnapshot({
    required this.capabilities,
    required this.depositRoutes,
    required this.conversionRoutes,
    required this.history,
    required this.balances,
    required this.selectedProviderCode,
  });

  final CryptoCapabilities capabilities;
  final List<CryptoRoute> depositRoutes;
  final List<CryptoRoute> conversionRoutes;
  final List<CryptoIntent> history;
  final Map<String, String> balances;
  final String? selectedProviderCode;

  CryptoRoute? get selectedRoute {
    final code = selectedProviderCode;
    if (code == null) return null;
    for (final route in depositRoutes) {
      if (route.providerCode == code) return route;
    }
    return null;
  }

  String? get selectedBalance {
    final code = selectedProviderCode;
    return code == null ? null : balances[code];
  }

  CryptoWalletSnapshot copyWith({
    CryptoCapabilities? capabilities,
    List<CryptoRoute>? depositRoutes,
    List<CryptoRoute>? conversionRoutes,
    List<CryptoIntent>? history,
    Map<String, String>? balances,
    String? selectedProviderCode,
    bool clearSelectedProviderCode = false,
  }) {
    return CryptoWalletSnapshot(
      capabilities: capabilities ?? this.capabilities,
      depositRoutes: depositRoutes ?? this.depositRoutes,
      conversionRoutes: conversionRoutes ?? this.conversionRoutes,
      history: history ?? this.history,
      balances: balances ?? this.balances,
      selectedProviderCode: clearSelectedProviderCode
          ? null
          : selectedProviderCode ?? this.selectedProviderCode,
    );
  }
}

final cryptoWalletTransportProvider = Provider<CryptoWalletTransport>((ref) {
  final api = ref.watch(apiClientProvider);
  return MasanawaCryptoWalletTransport(
    dio: api.dio,
    baseUrl: kAgentBaseUrl,
  );
});

class CryptoWalletController extends AsyncNotifier<CryptoWalletSnapshot> {
  CryptoWalletTransport get _transport => ref.read(cryptoWalletTransportProvider);

  @override
  Future<CryptoWalletSnapshot> build() async {
    ref.watch(cryptoWalletTransportProvider);
    return _load();
  }

  Future<CryptoWalletSnapshot> _load() async {
    final capabilities = await _transport.capabilities();
    final depositRoutes = capabilities.deposits
        ? await _transport.depositRoutes()
        : const <CryptoRoute>[];
    final conversionRoutes = capabilities.conversions
        ? await _transport.conversionRoutes()
        : const <CryptoRoute>[];
    final history = await _transport.history(limit: 50);

    final selected = _initialSelectedCode(depositRoutes, history);
    final balances = <String, String>{};
    if (selected != null) {
      final result = await _transport.balance(selected);
      balances[result.providerCode] = result.amount;
    }

    return CryptoWalletSnapshot(
      capabilities: capabilities,
      depositRoutes: List.unmodifiable(depositRoutes),
      conversionRoutes: List.unmodifiable(conversionRoutes),
      history: List.unmodifiable(history),
      balances: Map.unmodifiable(balances),
      selectedProviderCode: selected,
    );
  }

  String? _initialSelectedCode(
    List<CryptoRoute> routes,
    List<CryptoIntent> history,
  ) {
    final available = {for (final route in routes) route.providerCode};
    for (final intent in history) {
      if (available.contains(intent.asset)) return intent.asset;
      final target = intent.targetAsset;
      if (target != null && available.contains(target)) return target;
    }
    return routes.isEmpty ? null : routes.first.providerCode;
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(_load);
  }

  Future<void> selectAsset(String providerCode) async {
    final current = state.valueOrNull;
    if (current == null) return;
    final code = providerCode.trim();
    if (!current.depositRoutes.any((route) => route.providerCode == code)) {
      return;
    }
    state = AsyncData(current.copyWith(selectedProviderCode: code));
    if (!current.balances.containsKey(code)) {
      await refreshBalance(code);
    }
  }

  Future<void> refreshBalance([String? providerCode]) async {
    final current = state.valueOrNull;
    if (current == null) return;
    final code = (providerCode ?? current.selectedProviderCode)?.trim();
    if (code == null || code.isEmpty) return;
    final balance = await _transport.balance(code);
    final balances = Map<String, String>.from(current.balances)
      ..[balance.providerCode] = balance.amount;
    state = AsyncData(current.copyWith(balances: Map.unmodifiable(balances)));
  }

  Future<CryptoIntent> createDeposit({
    required String requestId,
    required String providerCode,
    required String amount,
  }) async {
    final result = await _transport.createDeposit(
      requestId: requestId,
      providerCode: providerCode,
      amount: amount,
    );
    await _mergeOperation(result, refreshBalance: false);
    return result;
  }

  Future<CryptoFiatPurchase> createFiatPurchase({
    required String requestId,
    required String fiatAmount,
    required String fiatCurrency,
  }) async {
    final result = await _transport.createFiatPurchase(
      requestId: requestId,
      fiatAmount: fiatAmount,
      fiatCurrency: fiatCurrency,
    );
    final intent = await _transport.intent(requestId);
    if (intent != null) {
      await _mergeOperation(intent, refreshBalance: false);
    }
    return result;
  }

  Future<CryptoFiatPurchase> refreshFiatPurchase(String requestId) async {
    final purchase = await _transport.refreshFiatPurchase(requestId);
    final refreshed = await _transport.intent(requestId);
    if (refreshed != null) {
      await _mergeOperation(
        refreshed,
        refreshBalance:
            purchase.terminal &&
            (purchase.status == 'succeeded' || purchase.status == 'refunded'),
      );
    }
    return purchase;
  }

  Future<CryptoWithdrawalQuote> quoteWithdrawal({
    required String providerCode,
    required String amount,
    required String destinationAddress,
  }) {
    return _transport.quoteWithdrawal(
      providerCode: providerCode,
      amount: amount,
      destinationAddress: destinationAddress,
    );
  }

  Future<CryptoIntent> createWithdrawal({
    required String requestId,
    required String providerCode,
    required String amount,
    required String destinationAddress,
  }) async {
    final result = await _transport.createWithdrawal(
      requestId: requestId,
      providerCode: providerCode,
      amount: amount,
      destinationAddress: destinationAddress,
    );
    await _mergeOperation(result, refreshBalance: true);
    return result;
  }

  Future<CryptoConversionQuote> quoteConversion({
    required String providerCode,
    required String targetProviderCode,
    required String amount,
  }) {
    return _transport.quoteConversion(
      providerCode: providerCode,
      targetProviderCode: targetProviderCode,
      amount: amount,
    );
  }

  Future<CryptoIntent> createConversion({
    required String requestId,
    required String providerCode,
    required String targetProviderCode,
    required String amount,
  }) async {
    final result = await _transport.createConversion(
      requestId: requestId,
      providerCode: providerCode,
      targetProviderCode: targetProviderCode,
      amount: amount,
    );
    await _mergeOperation(result, refreshBalance: true);
    return result;
  }

  Future<CryptoIntent> refreshOperation(CryptoIntent intent) async {
    if (intent.operation == 'buy') {
      final purchase = await _transport.refreshFiatPurchase(intent.requestId);
      final refreshed = await _transport.intent(intent.requestId) ?? intent;
      await _mergeOperation(
        refreshed,
        refreshBalance:
            purchase.terminal &&
            (purchase.status == 'succeeded' || purchase.status == 'refunded'),
      );
      return refreshed;
    }

    final refreshed = switch (intent.operation) {
      'withdraw' => await _transport.refreshWithdrawal(intent.requestId),
      'convert' => await _transport.refreshConversion(intent.requestId),
      _ => await _transport.intent(intent.requestId) ?? intent,
    };
    await _mergeOperation(refreshed, refreshBalance: refreshed.terminal);
    return refreshed;
  }

  Future<void> _mergeOperation(
    CryptoIntent intent, {
    required bool refreshBalance,
  }) async {
    final current = state.valueOrNull;
    if (current == null) return;

    final history = <CryptoIntent>[
      intent,
      for (final item in current.history)
        if (item.requestId != intent.requestId) item,
    ];

    var next = current.copyWith(history: List.unmodifiable(history));
    state = AsyncData(next);

    if (refreshBalance) {
      final codes = <String>{
        intent.asset,
        if (intent.targetAsset != null) intent.targetAsset!,
      };
      final balances = Map<String, String>.from(next.balances);
      for (final code in codes) {
        try {
          final balance = await _transport.balance(code);
          balances[balance.providerCode] = balance.amount;
        } catch (_) {
          // The transaction result remains useful even if a balance refresh
          // races provider reconciliation or a route becomes temporarily unavailable.
        }
      }
      next = next.copyWith(balances: Map.unmodifiable(balances));
      state = AsyncData(next);
    }
  }
}

final cryptoWalletProvider = AsyncNotifierProvider<
    CryptoWalletController, CryptoWalletSnapshot>(
  CryptoWalletController.new,
);

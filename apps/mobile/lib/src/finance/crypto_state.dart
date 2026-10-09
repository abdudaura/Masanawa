import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../agents/masanawa_transport.dart';
import '../core/providers.dart';
import '../state/session_state.dart';
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
    readAccessToken: () => ref.read(apiClientProvider).accessToken,
  );
});

class CryptoWalletController extends AsyncNotifier<CryptoWalletSnapshot> {
  String? _currentOwner;
  CryptoWalletTransport get _transport => ref.read(cryptoWalletTransportProvider);

  String _ownerId() {
    final current = ref.read(sessionProvider);
    if (current is! SessionSignedIn) {
      throw StateError('Sign in to access your crypto wallet.');
    }
    return current.user.id;
  }

  bool _sameOwner(String expected) {
    return _currentOwner == expected;
  }

  void _ensureOwner(String expected) {
    if (!_sameOwner(expected)) {
      throw StateError('Your account changed. Refresh the wallet before continuing.');
    }
  }

  @override
  Future<CryptoWalletSnapshot> build() async {
    ref.watch(cryptoWalletTransportProvider);
    // The complete session invalidates private balances even on A -> B
    // switches where the signed-in boolean would remain true.
    ref.listen<SessionState>(sessionProvider, (_, next) {
      _currentOwner = next is SessionSignedIn ? next.user.id : null;
    });
    final session = ref.watch(sessionProvider);
    _currentOwner = session is SessionSignedIn ? session.user.id : null;
    if (session is! SessionSignedIn) {
      throw StateError('Sign in to access your crypto wallet.');
    }
    return _load();
  }

  Future<CryptoWalletSnapshot> _load() async {
    final owner = _ownerId();
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

    _ensureOwner(owner);
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
    final owner = _ownerId();
    state = const AsyncLoading();
    final refreshed = await AsyncValue.guard(_load);
    // Avoid publishing an older user's success or error after a direct
    // account switch while an explicit refresh was still in flight.
    if (_sameOwner(owner)) state = refreshed;
  }

  Future<void> selectAsset(String providerCode) async {
    _ownerId();
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
    final owner = _ownerId();
    final initial = state.valueOrNull;
    if (initial == null) return;
    final code = (providerCode ?? initial.selectedProviderCode)?.trim();
    if (code == null || code.isEmpty) return;
    final balance = await _transport.balance(code);
    _ensureOwner(owner);
    // Re-read after IO to avoid overwriting more recent history/selection.
    final current = state.valueOrNull;
    if (current == null || !current.depositRoutes.any((route) => route.providerCode == code)) return;
    final balances = Map<String, String>.from(current.balances)
      ..[balance.providerCode] = balance.amount;
    state = AsyncData(current.copyWith(balances: Map.unmodifiable(balances)));
  }

  Future<CryptoIntent> createDeposit({
    required String requestId,
    required String providerCode,
    required String amount,
  }) async {
    final owner = _ownerId();
    final result = await _transport.createDeposit(
      requestId: requestId,
      providerCode: providerCode,
      amount: amount,
    );
    _ensureOwner(owner);
    await _mergeOperation(result, refreshBalance: false, owner: owner);
    return result;
  }

  Future<CryptoFiatPurchase> createFiatPurchase({
    required String requestId,
    required String fiatAmount,
    required String fiatCurrency,
  }) async {
    final owner = _ownerId();
    final result = await _transport.createFiatPurchase(
      requestId: requestId,
      fiatAmount: fiatAmount,
      fiatCurrency: fiatCurrency,
    );
    _ensureOwner(owner);
    final intent = await _transport.intent(requestId);
    _ensureOwner(owner);
    if (intent != null) {
      await _mergeOperation(intent, refreshBalance: false, owner: owner);
    }
    return result;
  }

  Future<CryptoFiatPurchase> refreshFiatPurchase(String requestId) async {
    final owner = _ownerId();
    final purchase = await _transport.refreshFiatPurchase(requestId);
    _ensureOwner(owner);
    final refreshed = await _transport.intent(requestId);
    _ensureOwner(owner);
    if (refreshed != null) {
      await _mergeOperation(
        refreshed,
        refreshBalance:
            purchase.terminal &&
            (purchase.status == 'succeeded' || purchase.status == 'refunded'),
        owner: owner,
      );
    }
    return purchase;
  }

  Future<CryptoWithdrawalQuote> quoteWithdrawal({
    required String providerCode,
    required String amount,
    required String destinationAddress,
  }) async {
    final owner = _ownerId();
    final result = await _transport.quoteWithdrawal(
      providerCode: providerCode,
      amount: amount,
      destinationAddress: destinationAddress,
    );
    _ensureOwner(owner);
    return result;
  }

  Future<CryptoIntent> createWithdrawal({
    required String requestId,
    required String providerCode,
    required String amount,
    required String destinationAddress,
  }) async {
    final owner = _ownerId();
    final result = await _transport.createWithdrawal(
      requestId: requestId,
      providerCode: providerCode,
      amount: amount,
      destinationAddress: destinationAddress,
    );
    _ensureOwner(owner);
    await _mergeOperation(result, refreshBalance: true, owner: owner);
    return result;
  }

  Future<CryptoConversionQuote> quoteConversion({
    required String providerCode,
    required String targetProviderCode,
    required String amount,
  }) async {
    final owner = _ownerId();
    final result = await _transport.quoteConversion(
      providerCode: providerCode,
      targetProviderCode: targetProviderCode,
      amount: amount,
    );
    _ensureOwner(owner);
    return result;
  }

  Future<CryptoIntent> createConversion({
    required String requestId,
    required String providerCode,
    required String targetProviderCode,
    required String amount,
  }) async {
    final owner = _ownerId();
    final result = await _transport.createConversion(
      requestId: requestId,
      providerCode: providerCode,
      targetProviderCode: targetProviderCode,
      amount: amount,
    );
    _ensureOwner(owner);
    await _mergeOperation(result, refreshBalance: true, owner: owner);
    return result;
  }

  Future<CryptoIntent> refreshOperation(CryptoIntent intent) async {
    final owner = _ownerId();
    if (intent.operation == 'buy') {
      final purchase = await _transport.refreshFiatPurchase(intent.requestId);
      _ensureOwner(owner);
      final refreshed = await _transport.intent(intent.requestId) ?? intent;
      _ensureOwner(owner);
      await _mergeOperation(
        refreshed,
        refreshBalance:
            purchase.terminal &&
            (purchase.status == 'succeeded' || purchase.status == 'refunded'),
        owner: owner,
      );
      return refreshed;
    }

    final refreshed = switch (intent.operation) {
      'withdraw' => await _transport.refreshWithdrawal(intent.requestId),
      'convert' => await _transport.refreshConversion(intent.requestId),
      _ => await _transport.intent(intent.requestId) ?? intent,
    };
    _ensureOwner(owner);
    await _mergeOperation(refreshed, refreshBalance: refreshed.terminal, owner: owner);
    return refreshed;
  }

  Future<void> _mergeOperation(
    CryptoIntent intent, {
    required bool refreshBalance,
    required String owner,
  }) async {
    _ensureOwner(owner);
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
          _ensureOwner(owner);
          balances[balance.providerCode] = balance.amount;
        } catch (error) {
          _ensureOwner(owner);
          // The transaction result remains useful even if a balance refresh
          // races provider reconciliation or a route becomes temporarily unavailable.
        }
      }
      _ensureOwner(owner);
      final latest = state.valueOrNull;
      if (latest == null) return;
      final merged = Map<String, String>.from(latest.balances)..addAll(balances);
      state = AsyncData(latest.copyWith(balances: Map.unmodifiable(merged)));
    }
  }
}

final cryptoWalletProvider = AsyncNotifierProvider<
    CryptoWalletController, CryptoWalletSnapshot>(
  CryptoWalletController.new,
);


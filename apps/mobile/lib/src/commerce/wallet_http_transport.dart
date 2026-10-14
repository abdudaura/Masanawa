import 'package:dio/dio.dart';
import '../core/network/api_client.dart';
import 'wallet_models.dart';

class GatewayWalletTransport implements WalletTransport {
  GatewayWalletTransport({
    required this.api,
    DateTime Function()? now,
  }) : _now = now ?? DateTime.now;

  final ApiClient api;
  final DateTime Function() _now;
  int _sequence = 0;
  final Map<String, String> _pendingRequestIds = {};

  String _requestId(String kind) {
    _sequence += 1;
    return 'wallet-$kind-${_now().microsecondsSinceEpoch}-$_sequence';
  }

  Map<String, dynamic> _map(dynamic value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) return value.cast<String, dynamic>();
    throw const FormatException('Invalid Wallet response');
  }

  @override
  Future<WalletView> load() async {
    // NGN and Credits have different Gateway capabilities. A missing NGN
    // endpoint must not wipe the entire usable Credits wallet, and a missing
    // balance must NEVER be represented to the customer as ₦0.00.
    final base = _map((await api.dio.get<dynamic>('/v1/wallet')).data);
    Map<String, dynamic>? ngn;
    try {
      ngn = _map((await api.dio.get<dynamic>('/v1/wallet/ngn')).data);
    } on DioException catch (error) {
      // Auth failures must still invalidate the session normally.
      if (error.response?.statusCode == 401 ||
          error.response?.statusCode == 403) rethrow;
      ngn = null;
    }
    return WalletView.fromJson({
      ...base,
      'ngnBalanceKobo': ngn?['balanceKobo'],
      'ngnBalance': ngn?['balance'],
    });
  }

  @override
  Future<CreditTransferReceipt> sendCredits({
    required String recipient,
    required int amountCredits,
  }) async {
    final fingerprint = 'transfer:${recipient.trim()}:$amountCredits';
    final requestId =
        _pendingRequestIds.putIfAbsent(fingerprint, () => _requestId('transfer'));
    try {
      final response = await api.dio.post<dynamic>(
        '/v1/wallet/transfers',
        data: {
          'requestId': requestId,
          'recipient': recipient,
          'amountCredits': amountCredits,
        },
      );
      final receipt = CreditTransferReceipt.fromJson(_map(response.data));
      _pendingRequestIds.remove(fingerprint);
      return receipt;
    } catch (_) {
      // Keep the same request id for an ambiguous retry. The server owns
      // idempotent replay truth, so a lost response cannot create two transfers.
      rethrow;
    }
  }

  @override
  Future<GiftReceipt> sendGift({
    required String recipientCharacterId,
    required int amountCredits,
  }) async {
    final fingerprint = 'gift:${recipientCharacterId.trim()}:$amountCredits';
    final requestId =
        _pendingRequestIds.putIfAbsent(fingerprint, () => _requestId('gift'));
    try {
      final response = await api.dio.post<dynamic>(
        '/v1/twins/$recipientCharacterId/gifts',
        data: {
          'requestId': requestId,
          'amountCredits': amountCredits,
        },
      );
      final receipt = GiftReceipt.fromJson(_map(response.data));
      _pendingRequestIds.remove(fingerprint);
      return receipt;
    } catch (_) {
      // Preserve request id across ambiguous retries.
      rethrow;
    }
  }
}

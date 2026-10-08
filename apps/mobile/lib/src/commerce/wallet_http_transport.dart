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

  /// Only an authenticated, exact integer response from the native NGN
  /// ledger is a valid balance. Temporary unavailability must not invent ₦0.
  /// Authentication failures remain fatal to the whole wallet session.
  Future<int?> _readNativeNgn() async {
    try {
      final response = await api.dio.get<dynamic>('/v1/wallet/ngn');
      final raw = _map(response.data)['balanceKobo'];
      if (raw is! int || raw < 0 || raw > 9007199254740991) {
        return null;
      }
      return raw;
    } on DioException catch (error) {
      if (error.response?.statusCode == 401 ||
          error.response?.statusCode == 403) {
        rethrow;
      }
      // A 404/5xx or interrupted native-rail request does not revoke the
      // independent Credits/earnings projection. The UI shows unavailable.
      return null;
    } on FormatException {
      return null;
    }
  }

  @override
  Future<WalletView> load() async {
    // Both authenticated projections fetch concurrently, but a native
    // provider outage must not hide already-authorized Credits/earnings.
    final results = await Future.wait<dynamic>([
      api.dio.get<dynamic>('/v1/wallet'),
      _readNativeNgn(),
    ]);
    final base = _map((results[0] as Response<dynamic>).data);
    final ngnAmount = results[1] as int?;
    return WalletView.fromJson({
      ...base,
      if (ngnAmount != null) 'ngnBalanceKobo': ngnAmount,
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


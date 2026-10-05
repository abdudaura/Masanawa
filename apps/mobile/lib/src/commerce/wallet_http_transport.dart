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
    final response = await api.dio.get<dynamic>('/v1/wallet');
    return WalletView.fromJson(_map(response.data));
  }

  @override
  Future<CreditTransferReceipt> sendCredits({
    required String recipient,
    required int amountCredits,
  }) async {
    final requestId = _requestId('transfer');
    final response = await api.dio.post<dynamic>(
      '/v1/wallet/transfers',
      data: {
        'requestId': requestId,
        'recipient': recipient,
        'amountCredits': amountCredits,
      },
    );
    return CreditTransferReceipt.fromJson(_map(response.data));
  }

  @override
  Future<GiftReceipt> sendGift({
    required String recipientCharacterId,
    required int amountCredits,
  }) async {
    final requestId = _requestId('gift');
    final response = await api.dio.post<dynamic>(
      '/v1/twins/$recipientCharacterId/gifts',
      data: {
        'requestId': requestId,
        'amountCredits': amountCredits,
      },
    );
    return GiftReceipt.fromJson(_map(response.data));
  }
}

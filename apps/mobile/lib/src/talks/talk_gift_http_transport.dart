import '../core/network/api_client.dart';
import 'talk_gift.dart';

class GatewayTalkGiftTransport implements TalkGiftTransport {
  GatewayTalkGiftTransport({
    required this.api,
    DateTime Function()? now,
  }) : _now = now ?? DateTime.now;

  final ApiClient api;
  final DateTime Function() _now;
  int _sequence = 0;
  final Map<String, String> _pendingRequestIds = {};

  String _requestId() {
    _sequence += 1;
    return 'talk-gift-' +
        _now().microsecondsSinceEpoch.toString() +
        '-' +
        _sequence.toString();
  }

  Map<String, dynamic> _map(dynamic value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) return value.cast<String, dynamic>();
    throw const FormatException('Invalid Talk gift response');
  }

  @override
  Future<TalkGiftReceipt> sendGift({
    required String talkId,
    required int amountCredits,
  }) async {
    final normalizedTalkId = talkId.trim();
    if (normalizedTalkId.isEmpty) {
      throw const FormatException('Talk id is required');
    }
    if (amountCredits < 1) {
      throw const FormatException('Gift amount is invalid');
    }

    final fingerprint =
        normalizedTalkId + ':' + amountCredits.toString();
    final requestId =
        _pendingRequestIds.putIfAbsent(fingerprint, _requestId);

    try {
      final response = await api.dio.post<dynamic>(
        '/talks/' + Uri.encodeComponent(normalizedTalkId) + '/gifts',
        data: {
          'requestId': requestId,
          'amountCredits': amountCredits,
        },
      );
      final receipt = TalkGiftReceipt.fromJson(_map(response.data));
      _pendingRequestIds.remove(fingerprint);
      return receipt;
    } catch (_) {
      // Keep the same request id after an ambiguous failure. The server owns
      // canonical idempotency, so a retry cannot debit twice.
      rethrow;
    }
  }
}

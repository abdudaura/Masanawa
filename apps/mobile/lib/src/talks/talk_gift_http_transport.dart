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
  Future<TalkGiftCatalog> loadCatalog({required String talkId}) async {
    final id = talkId.trim();
    if (id.isEmpty) throw const FormatException('Talk id is required');
    final response = await api.dio.get<dynamic>(
      '/talks/${Uri.encodeComponent(id)}/gifts/catalog',
    );
    final catalog = TalkGiftCatalog.fromJson(_map(response.data));
    if (catalog.talkId != id) {
      throw const FormatException('Mismatched gift catalog Talk');
    }
    return catalog;
  }

  @override
  Future<TalkGiftReceipt> sendGift({
    required String talkId,
    required int amountCredits,
    String? catalogItemId,
  }) async {
    final normalizedTalkId = talkId.trim();
    if (normalizedTalkId.isEmpty) {
      throw const FormatException('Talk id is required');
    }
    if (amountCredits < 1) {
      throw const FormatException('Gift amount is invalid');
    }

    final normalizedItemId = catalogItemId?.trim();
    if (catalogItemId != null &&
        (normalizedItemId == null ||
            !RegExp(r'^[a-z][a-z0-9_-]{0,47}$').hasMatch(normalizedItemId))) {
      throw const FormatException('Gift option is invalid');
    }
    final fingerprint = [
      normalizedTalkId,
      normalizedItemId ?? 'legacy',
      amountCredits.toString(),
    ].join(':');
    final requestId = _pendingRequestIds.putIfAbsent(fingerprint, _requestId);

    try {
      final response = await api.dio.post<dynamic>(
        '/talks/' + Uri.encodeComponent(normalizedTalkId) + '/gifts',
        data: {
          'requestId': requestId,
          'amountCredits': amountCredits,
          if (normalizedItemId != null) 'catalogItemId': normalizedItemId,
        },
      );
      final receipt = TalkGiftReceipt.fromJson(_map(response.data));
      if (receipt.talkId != normalizedTalkId ||
          receipt.amountCredits != amountCredits ||
          (normalizedItemId != null &&
              receipt.catalogItemId != normalizedItemId)) {
        throw const FormatException('Gift receipt does not match confirmed terms');
      }
      _pendingRequestIds.remove(fingerprint);
      return receipt;
    } catch (_) {
      // Keep the same request ID after an uncertain response; never create
      // another charge just because the receipt was lost in transit.
      rethrow;
    }
  }
}

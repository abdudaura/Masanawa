import '../core/network/api_client.dart';
import 'selected_message_assist.dart';

/// Authenticated existing Gateway Dio instance; no new bearer/token storage.
class GatewayHumanAiAssistTransport implements HumanAiAssistTransport {
  const GatewayHumanAiAssistTransport(this.api);
  final ApiClient api;
  Map<String, dynamic> _object(dynamic raw) {
    if (raw is Map<String, dynamic>) return raw;
    if (raw is Map) return raw.cast<String, dynamic>();
    throw const FormatException('Malformed Assistant response');
  }

  @override
  Future<HumanAiPreview> prepare({
    required String conversationId, required List<String> messageIds,
    required HumanAiAssistPurpose purpose, required String language,
    required bool maskPrivateNumbers,
  }) async {
    final response = await api.dio.post<dynamic>('/messages/ai/prepare', data: {
      'conversationId':conversationId,
      'messageIds':messageIds,
      'purpose':purpose.wire,
      'language':language,
      'redact':maskPrivateNumbers ? 'mask' : 'original',
      'disclosureConfirmed':true,
    });
    final obj = _object(response.data);
    if (obj['purpose'] != purpose.wire || obj['conversationId'] != conversationId) {
      throw const FormatException('Assistant selection context mismatch');
    }
    final peer = obj['peerUserId'];
    final text = obj['preview'];
    final expires = obj['expiresAt'];
    if (peer is! String || peer.isEmpty || text is! String || text.isEmpty ||
        expires is! String) {
      throw const FormatException('Assistant preview missing');
    }
    final token = obj['reviewToken'];
    if (purpose == HumanAiAssistPurpose.reply && (token is! String || token.isEmpty)) {
      throw const FormatException('Missing reviewed-send permission');
    }
    return HumanAiPreview(
      text:text, purpose:purpose, peerUserId:peer,
      expiresAt:DateTime.parse(expires), reviewToken: token is String ? token : null,
    );
  }

  @override
  Future<String> sendReviewed({
    required String reviewToken, required String recipientUserId,
    required String reviewedBody,
  }) async {
    final response = await api.dio.post<dynamic>('/messages/ai/send-reviewed',data:{
      'reviewToken':reviewToken, 'recipientUserId':recipientUserId,
      'reviewedBody':reviewedBody, 'confirmed':true,
    });
    final id = _object(response.data)['messageId'];
    if (id is! String || id.isEmpty) {
      throw const FormatException('Send acknowledgement unavailable');
    }
    return id;
  }
}

import 'package:dio/dio.dart';

import '../core/network/api_client.dart';
import 'invite_share.dart';

class InviteShareHttpException implements Exception {
  const InviteShareHttpException(this.code);
  final String code;

  @override
  String toString() => code;
}

/** Uses ApiClient's existing authenticated bearer/session transport. */
class GatewayInviteLinkTransport implements InviteLinkTransport {
  const GatewayInviteLinkTransport(this.api);

  final ApiClient api;

  @override
  Future<InviteShareLink> createPersonalLink() async {
    try {
      final response = await api.dio.post<dynamic>('/invites', data: <String, dynamic>{});
      final data = response.data;
      if (data is! Map || data['url'] is! String || data['expiresAt'] is! String) {
        throw const InviteShareHttpException('INVALID_RESPONSE');
      }
      final expiry = DateTime.tryParse(data['expiresAt'] as String);
      if (expiry == null || !expiry.isAfter(DateTime.now().toUtc())) {
        throw const InviteShareHttpException('INVITE_EXPIRED');
      }
      try {
        return InviteShareLink.fromServer(data['url'] as String);
      } on FormatException {
        throw const InviteShareHttpException('INVALID_RESPONSE');
      }
    } on DioException catch (error) {
      switch (error.response?.statusCode) {
        case 401:
        case 403:
          throw const InviteShareHttpException('NOT_AUTHORIZED');
        case 429:
          throw const InviteShareHttpException('RATE_LIMITED');
        case 400:
          throw const InviteShareHttpException('INVALID_REQUEST');
        default:
          // No fallback to fabricated "signed" URL after a network error.
          throw const InviteShareHttpException('SERVICE_UNAVAILABLE');
      }
    }
  }
}

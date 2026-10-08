
import 'dart:math';

import 'package:dio/dio.dart';
import '../core/network/api_client.dart';
import 'models.dart';

abstract interface class CustomerSupportTransport {
  Future<SupportOperationStatus> operationStatus(
      SupportOperationKind kind, String reference);
  Future<List<CustomerSupportTicket>> tickets();
  Future<CustomerSupportTicket> submit({
    required String requestKey,
    required String kind,
    String? reference,
    required String summary,
    required bool shareWithSupport,
  });
}

/// Uses the same Dio and 401-refresh chain as platform auth.
/// No direct API key, provider secret, payment mutation or fake local ticket.
class GatewayCustomerSupportTransport implements CustomerSupportTransport {
  GatewayCustomerSupportTransport(this.api);
  final ApiClient api;

  void _requireSession() {
    if (api.accessToken == null || api.accessToken!.isEmpty) {
      throw const ApiException('Sign in to contact support', statusCode: 401);
    }
  }

  Map<String, dynamic> _map(Object? value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) return value.cast<String, dynamic>();
    throw const FormatException('Invalid support response');
  }

  Future<Map<String, dynamic>> _get(String path) async {
    _requireSession();
    try {
      final response = await api.dio.get<dynamic>(path);
      return _map(response.data);
    } on DioException catch (error) {
      throw mapDioError(error);
    }
  }

  Future<Map<String, dynamic>> _post(
      String path, Map<String, dynamic> body) async {
    _requireSession();
    try {
      final response = await api.dio.post<dynamic>(path, data: body);
      return _map(response.data);
    } on DioException catch (error) {
      throw mapDioError(error);
    }
  }

  @override
  Future<SupportOperationStatus> operationStatus(
      SupportOperationKind kind, String reference) async {
    if (!RegExp(r'^[A-Za-z0-9_.-]{1,128}$').hasMatch(reference)) {
      throw const FormatException('Invalid operation reference');
    }
    // Read-only POST avoids exposing financial references in URL/access logs.
    return SupportOperationStatus.fromJson(
      await _post('/v1/support/operations/status', {
        'kind': kind.code, 'reference': reference,
      }),
    );
  }

  @override
  Future<List<CustomerSupportTicket>> tickets() async {
    final json = await _get('/v1/support/tickets?limit=30');
    final items = json['tickets'];
    if (items is! List) throw const FormatException('Invalid support tickets');
    return List.unmodifiable(items.map((item) =>
      CustomerSupportTicket.fromJson(_map(item))));
  }

  @override
  Future<CustomerSupportTicket> submit({
    required String requestKey,
    required String kind,
    String? reference,
    required String summary,
    required bool shareWithSupport,
  }) async {
    if (!const ['general', 'billing_quote', 'crypto_intent'].contains(kind)) {
      throw const FormatException('Invalid support request type');
    }
    return CustomerSupportTicket.fromJson(await _post('/v1/support/tickets', {
      'requestKey': requestKey,
      'kind': kind,
      if (reference != null && reference.isNotEmpty) 'reference': reference,
      'summary': summary,
      'shareWithSupport': shareWithSupport,
    }));
  }
}

/// Unpredictable v4 UUID; a failed network submission retries the SAME key.
String newSupportRequestKey() {
  final values = List<int>.generate(16, (_) => 0);
  final random = Random.secure();
  for (var i = 0; i < values.length; i++) {
    values[i] = random.nextInt(256);
  }
  values[6] = (values[6] & 0x0f) | 0x40;
  values[8] = (values[8] & 0x3f) | 0x80;
  final hex = values.map((v) => v.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}

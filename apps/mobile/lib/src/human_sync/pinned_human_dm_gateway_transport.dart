import 'dart:io';

import 'package:dio/dio.dart';

import 'dm_sync_coordinator.dart';

/// Live C02 Gateway contract. A newly constructed, isolated HTTP client holds
/// ONE session's bearer token; it never borrows the app-wide mutable 401 replay
/// interceptor. On token rotation/re-login, close and rebuild this adapter.
/// No simulated contacts, messages, socket events or fake success paths.
class PinnedHumanDmGatewayTransport implements DmSyncTransport {
  PinnedHumanDmGatewayTransport({
    required String gatewayBaseUrl,
    required String accessToken,
    Duration connectTimeout = const Duration(seconds: 12),
  }) : _dio = Dio(BaseOptions(
        baseUrl: gatewayBaseUrl,
        headers: <String, String>{
          HttpHeaders.authorizationHeader: 'Bearer ' + accessToken,
        },
        connectTimeout: connectTimeout,
        receiveTimeout: const Duration(seconds: 20),
        sendTimeout: const Duration(seconds: 20),
        responseType: ResponseType.json,
      )) {
    if (!gatewayBaseUrl.startsWith('https://') ||
        accessToken.trim().isEmpty ||
        Uri.tryParse(gatewayBaseUrl)?.host.isEmpty != false) {
      _dio.close(force: true);
      throw ArgumentError('Verified HTTPS Gateway and access token required');
    }
  }
  final Dio _dio;
  bool _closed = false;
  void _requireOpen() {
    if (_closed) throw StateError('Authenticated DM HTTP session closed');
  }
  Map<String, dynamic> _record(Object? raw) {
    if (raw is Map<String, dynamic>) return raw;
    if (raw is Map) return Map<String, dynamic>.from(raw);
    throw const FormatException('Malformed Gateway human DM response');
  }
  List<Map<String, dynamic>> _list(Object? raw) {
    if (raw is! List) throw const FormatException('Malformed Gateway human DM list');
    return raw.map((record) => _record(record)).toList(growable: false);
  }

  @override
  Future<List<Map<String, dynamic>>> inbox() async {
    _requireOpen();
    final response = await _dio.get<Object?>('/messages',
        queryParameters: {'limit': 40});
    return _list(_record(response.data)['conversations']);
  }

  @override
  Future<List<Map<String, dynamic>>> history(String conversationId,
      {String? before}) async {
    _requireOpen();
    final response = await _dio.get<Object?>(
      '/messages/' + Uri.encodeComponent(conversationId),
      queryParameters: {'limit': 40, if (before != null) 'before': before},
    );
    return _list(_record(response.data)['messages']);
  }

  @override
  Future<Map<String, dynamic>> send(
      String conversationId, String requestId, String body) async {
    _requireOpen();
    final response = await _dio.post<Object?>(
      '/messages/' + Uri.encodeComponent(conversationId),
      data: {'clientRequestId': requestId, 'body': body},
    );
    return _record(response.data);
  }

  @override
  void cancelPendingRequests() {
    _closed = true;
    _dio.close(force: true);
  }
}

import 'dart:math';

import 'package:dio/dio.dart';

import 'admin_api.dart';
import 'admin_auth_api.dart';

class AdminAgentTurn {
  const AdminAgentTurn({
    required this.reply,
    required this.agentRunId,
    required this.parts,
  });

  final String reply;
  final String agentRunId;
  final List<dynamic> parts;

  factory AdminAgentTurn.fromJson(Map<String, dynamic> json) => AdminAgentTurn(
        reply: json['reply'] as String? ?? '',
        agentRunId: json['agentRunId'] as String? ?? '',
        parts: List<dynamic>.from(json['parts'] as List<dynamic>? ?? const []),
      );
}

class AdminAgentConversationApi {
  AdminAgentConversationApi({
    required this.adminApi,
    Dio? dio,
  }) : _dio = dio ??
            Dio(
              BaseOptions(
                baseUrl: adminAuthBaseUrl.trim(),
                connectTimeout: const Duration(seconds: 10),
                receiveTimeout: const Duration(seconds: 90),
                headers: {'Accept': 'application/json'},
              ),
            );

  final AdminApi adminApi;
  final Dio _dio;
  final Random _random = Random.secure();

  String _uuidV4() {
    final bytes = List<int>.generate(16, (_) => _random.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    final hex = bytes.map((value) => value.toRadixString(16).padLeft(2, '0')).join();
    return '${hex.substring(0, 8)}-'
        '${hex.substring(8, 12)}-'
        '${hex.substring(12, 16)}-'
        '${hex.substring(16, 20)}-'
        '${hex.substring(20)}';
  }

  Options _auth() => Options(
        headers: {'Authorization': 'Bearer ${adminApi.currentAccessToken}'},
      );

  Future<Response<dynamic>> _request(
    Future<Response<dynamic>> Function() call,
  ) async {
    requireAdminAuthBaseUrl();
    try {
      return await call();
    } on DioException catch (error) {
      if (error.response?.statusCode == 401) {
        final refreshed = await adminApi.refreshForExternalClient();
        if (refreshed != null) {
          try {
            return await call();
          } on DioException catch (retry) {
            throw _error(retry);
          }
        }
      }
      throw _error(error);
    }
  }

  AdminApiException _error(DioException error) {
    final status = error.response?.statusCode;
    return AdminApiException(
      switch (status) {
        401 => 'Your Masanawa session expired. Sign in again.',
        403 => 'This Character is not available to this operator session.',
        404 => 'The Agent conversation runtime is unavailable.',
        _ => error.message ?? 'Admin Agent conversation failed.',
      },
      status,
    );
  }

  Future<String> open(String characterId) async {
    final response = await _request(
      () => _dio.post<dynamic>(
        '/agent/sessions/open',
        options: _auth(),
        data: {'characterId': characterId},
      ),
    );
    final data = Map<String, dynamic>.from(response.data as Map);
    return data['characterSessionId'] as String;
  }

  Future<AdminAgentTurn> send({
    required String characterId,
    required String characterSessionId,
    required String text,
  }) async {
    final requestId = 'request_${_uuidV4()}';
    final correlationId = 'correlation_${_uuidV4()}';
    final response = await _request(
      () => _dio.post<dynamic>(
        '/agent/sessions/${Uri.encodeComponent(characterSessionId)}/turn',
        options: Options(
          headers: {
            'Authorization': 'Bearer ${adminApi.currentAccessToken}',
            'x-request-id': requestId,
            'x-correlation-id': correlationId,
          },
        ),
        data: {
          'characterId': characterId,
          'text': text.trim(),
        },
      ),
    );
    return AdminAgentTurn.fromJson(
      Map<String, dynamic>.from(response.data as Map),
    );
  }

  Future<void> close({
    required String characterId,
    required String characterSessionId,
  }) async {
    await _request(
      () => _dio.post<dynamic>(
        '/agent/sessions/${Uri.encodeComponent(characterSessionId)}/close',
        options: _auth(),
        data: {'characterId': characterId},
      ),
    );
  }
}

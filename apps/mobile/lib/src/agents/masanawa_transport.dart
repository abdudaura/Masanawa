import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

import '../chat/message_parts.dart';
import '../core/network/api_client.dart';
import 'agent_directory.dart';
import 'agent_session.dart';

const String kAgentBaseUrl = String.fromEnvironment(
  'AGENT_BASE_URL',
  defaultValue: '',
);

const bool kAgentRuntimeEnabled = bool.fromEnvironment(
  'AGENT_RUNTIME_ENABLED',
  defaultValue: false,
);

bool get isAgentRuntimeConfigured =>
    kAgentRuntimeEnabled && kAgentBaseUrl.isNotEmpty;

class _GatewayClient {
  _GatewayClient({
    required Dio dio,
    required this.baseUrl,
    this.readAccessToken,
  }) : dio = Dio(dio.options.copyWith(baseUrl: baseUrl)) {
    // Keep injected adapters available for tests; never copy legacy interceptors.
    this.dio.httpClientAdapter = dio.httpClientAdapter;
  }

  final Dio dio;
  final String baseUrl;
  final String? Function()? readAccessToken;

  Options options({bool turn = false}) {
    final token = readAccessToken?.call();
    return Options(
      followRedirects: false,
      receiveTimeout: turn
          ? const Duration(seconds: 75)
          : const Duration(seconds: 15),
      headers: {
        if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
      },
    );
  }

  Future<Map<String, dynamic>> post(
    String path,
    Map<String, dynamic> body,
  ) async {
    try {
      final res = await dio.post<Map<String, dynamic>>(
        '$baseUrl$path',
        data: body,
        options: options(
          turn: path.endsWith('/turn') || path.endsWith('/media-turn'),
        ),
      );
      final data = res.data;
      if (data == null) throw const ApiException('Empty response from server');
      return data;
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<Map<String, dynamic>> get(String path) async {
    try {
      final res = await dio.get<Map<String, dynamic>>(
        '$baseUrl$path',
        options: options(),
      );
      final data = res.data;
      if (data == null) throw const ApiException('Empty response from server');
      return data;
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }
}

/// Reads the admin-configured roster. The payload is a projection only:
/// identity remains in Identity and Skill assignment remains server-side.
class MasanawaAgentDirectoryTransport implements AgentDirectoryTransport {
  MasanawaAgentDirectoryTransport({
    required Dio dio,
    required String baseUrl,
    String? Function()? readAccessToken,
  }) : _client = _GatewayClient(
         dio: dio,
         baseUrl: baseUrl,
         readAccessToken: readAccessToken,
       );

  final _GatewayClient _client;

  @override
  Future<List<AgentDirectoryEntry>> loadDirectory() async {
    final data = await _client.get('/v1/agent/directory');
    final raw = data['agents'];
    if (raw is! List) throw const ApiException('Invalid agent directory');
    return [
      for (final item in raw)
        if (item is Map)
          AgentDirectoryEntry.fromJson(item.cast<String, dynamic>()),
    ];
  }
}

class MasanawaAgentTransport implements AgentTransport {
  MasanawaAgentTransport({
    required Dio dio,
    required String baseUrl,
    String? Function()? readAccessToken,
  }) : _client = _GatewayClient(
         dio: dio,
         baseUrl: baseUrl,
         readAccessToken: readAccessToken,
       );

  final _GatewayClient _client;

  @override
  Future<AgentSessionBinding> openSession(String characterId) async {
    final data = await _client.post('/v1/agent/sessions/open', {
      'characterId': characterId,
    });
    final id = data['characterSessionId'];
    if (id is! String || id.isEmpty) {
      throw const ApiException('Agent service unavailable');
    }
    final runId = data['agentRunId'];
    return AgentSessionBinding(
      characterId: characterId,
      characterSessionId: id,
      agentRunId: runId is String && runId.isNotEmpty ? runId : null,
    );
  }

  @override
  Future<AgentTurnResult> sendTurn({
    required AgentSessionBinding binding,
    required String text,
  }) async {
    final data = await _client.post(
      '/v1/agent/sessions/${binding.characterSessionId}/turn',
      {'characterId': binding.characterId, 'text': text},
    );
    final reply = data['reply'];
    if (reply is! String) {
      throw const ApiException('Agent service unavailable');
    }
    final rawParts = data['parts'];
    final parts = <AgentMessagePart>[];
    if (rawParts is List) {
      for (final raw in rawParts) {
        if (raw is Map) {
          try {
            parts.add(AgentMessagePart.fromJson(raw.cast<String, dynamic>()));
          } catch (_) {
            // Unknown future part types must not break the conversation.
          }
        }
      }
    }
    final runId = data['agentRunId'];
    if (reply.isEmpty && parts.isEmpty) {
      throw const ApiException('Agent service returned no result');
    }
    final audioBase64 = data['audioBase64'];
    final audioMimeType = data['audioMimeType'];
    final audioDurationMs = data['audioDurationMs'];
    return AgentTurnResult(
      text: reply,
      parts: List.unmodifiable(parts),
      agentRunId: runId is String && runId.isNotEmpty ? runId : null,
      audioBytes: audioBase64 is String && audioBase64.isNotEmpty
          ? base64Decode(audioBase64)
          : null,
      audioMimeType: audioMimeType is String ? audioMimeType : null,
      audioDurationMs: audioDurationMs is num ? audioDurationMs.round() : null,
    );
  }

  @override
  Future<AgentTurnResult> sendMediaTurn({
    required AgentSessionBinding binding,
    required Uint8List bytes,
    required String mimeType,
    required String caption,
  }) async {
    final data = await _client.post(
      '/v1/agent/sessions/${binding.characterSessionId}/media-turn',
      {
        'characterId': binding.characterId,
        'caption': caption,
        'mimeType': mimeType,
        'dataBase64': base64Encode(bytes),
      },
    );
    final reply = data['reply'];
    if (reply is! String || reply.isEmpty) {
      throw const ApiException('Agent media service unavailable');
    }
    final rawParts = data['parts'];
    final parts = <AgentMessagePart>[];
    if (rawParts is List) {
      for (final raw in rawParts) {
        if (raw is Map) {
          try {
            parts.add(AgentMessagePart.fromJson(raw.cast<String, dynamic>()));
          } catch (_) {}
        }
      }
    }
    final runId = data['agentRunId'];
    final audioBase64 = data['audioBase64'];
    final audioMimeType = data['audioMimeType'];
    final audioDurationMs = data['audioDurationMs'];
    return AgentTurnResult(
      text: reply,
      parts: List.unmodifiable(parts),
      agentRunId: runId is String && runId.isNotEmpty ? runId : null,
      audioBytes: audioBase64 is String && audioBase64.isNotEmpty
          ? base64Decode(audioBase64)
          : null,
      audioMimeType: audioMimeType is String ? audioMimeType : null,
      audioDurationMs: audioDurationMs is num ? audioDurationMs.round() : null,
    );
  }

  @override
  Future<void> closeSession(AgentSessionBinding binding) async {
    try {
      await _client.post(
        '/v1/agent/sessions/${binding.characterSessionId}/close',
        {'characterId': binding.characterId},
      );
    } catch (_) {
      // Advisory only. Canonical continuity remains server-owned.
    }
  }
}

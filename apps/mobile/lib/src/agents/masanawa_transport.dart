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
    Map<String, dynamic> body, {
    CancelToken? cancelToken,
    void Function(int sent, int total)? onSendProgress,
  }) async {
    try {
      final res = await dio.post<Map<String, dynamic>>(
        '$baseUrl$path',
        data: body,
        options: options(
          turn: path.endsWith('/turn') || path.endsWith('/media-turn'),
        ),
        cancelToken: cancelToken,
        onSendProgress: onSendProgress,
      );
      final data = res.data;
      if (data == null) throw const ApiException('Empty response from server');
      return data;
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Stream<Map<String, dynamic>> postStream(
    String path,
    Map<String, dynamic> body, {
    CancelToken? cancelToken,
  }) async* {
    try {
      final res = await dio.post<ResponseBody>(
        '$baseUrl$path',
        data: body,
        options: options(turn: true).copyWith(
          responseType: ResponseType.stream,
        ),
        cancelToken: cancelToken,
      );
      final bodyStream = res.data?.stream;
      if (bodyStream == null) {
        throw const ApiException('Empty response from server');
      }
      await for (final line in bodyStream
          .transform(utf8.decoder)
          .transform(const LineSplitter())) {
        final trimmed = line.trim();
        if (trimmed.isEmpty) continue;
        final decoded = jsonDecode(trimmed);
        if (decoded is Map) {
          yield decoded.cast<String, dynamic>();
        }
      }
    } on DioException catch (e) {
      throw mapDioError(e);
    } on FormatException {
      throw const ApiException('Invalid streaming response from server');
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
  final Map<String, CancelToken> _turnTokens = {};

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
    void Function(String delta)? onTextDelta,
  }) async {
    final token = CancelToken();
    _turnTokens[binding.characterId]?.cancel('Superseded by a new turn');
    _turnTokens[binding.characterId] = token;

    try {
      if (onTextDelta != null) {
        var streamedText = '';
        Map<String, dynamic>? done;
        await for (final event in _client.postStream(
          '/v1/agent/sessions/${binding.characterSessionId}/turn-stream',
          {'characterId': binding.characterId, 'text': text},
          cancelToken: token,
        )) {
          final type = event['type'];
          if (type == 'delta') {
            final delta = event['text'];
            if (delta is String && delta.isNotEmpty) {
              streamedText += delta;
              onTextDelta(delta);
            }
            continue;
          }
          if (type == 'error') {
            throw const ApiException('Agent streaming turn failed');
          }
          if (type == 'done') done = event;
        }
        final data = done;
        if (data == null) {
          throw const ApiException('Agent stream ended unexpectedly');
        }
        final finalReply = data['reply'];
        final reply = finalReply is String && finalReply.isNotEmpty
            ? finalReply
            : streamedText;
        if (reply.isEmpty) {
          throw const ApiException('Agent service returned no result');
        }
        return _turnResultFromData(data, reply: reply);
      }

      final data = await _client.post(
        '/v1/agent/sessions/${binding.characterSessionId}/turn',
        {'characterId': binding.characterId, 'text': text},
        cancelToken: token,
        onSendProgress: onUploadProgress,
      );
      final reply = data['reply'];
      if (reply is! String || reply.isEmpty) {
        throw const ApiException('Agent service unavailable');
      }
      return _turnResultFromData(data, reply: reply);
    } finally {
      if (identical(_turnTokens[binding.characterId], token)) {
        _turnTokens.remove(binding.characterId);
      }
    }
  }

  AgentTurnResult _turnResultFromData(
    Map<String, dynamic> data, {
    required String reply,
  }) {
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
  Future<AgentTurnResult> sendMediaTurn({
    required AgentSessionBinding binding,
    required Uint8List bytes,
    required String mimeType,
    required String caption,
    void Function(int sent, int total)? onUploadProgress,
  }) async {
    final token = CancelToken();
    _turnTokens[binding.characterId]?.cancel('Superseded by a new turn');
    _turnTokens[binding.characterId] = token;
    late final Map<String, dynamic> data;
    try {
      data = await _client.post(
        '/v1/agent/sessions/${binding.characterSessionId}/media-turn',
        {
          'characterId': binding.characterId,
          'caption': caption,
          'mimeType': mimeType,
          'dataBase64': base64Encode(bytes),
        },
        cancelToken: token,
      );
    } finally {
      if (identical(_turnTokens[binding.characterId], token)) {
        _turnTokens.remove(binding.characterId);
      }
    }
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
  Future<AgentTurnResult> sendMediaSetTurn({
    required AgentSessionBinding binding,
    required List<AgentMediaInput> media,
    required String caption,
    void Function(int sent, int total)? onUploadProgress,
  }) async {
    if (media.isEmpty || media.length > 8) {
      throw const ApiException('Invalid attachment set');
    }
    final token = CancelToken();
    _turnTokens[binding.characterId]?.cancel('Superseded by a new turn');
    _turnTokens[binding.characterId] = token;
    try {
      final data = await _client.post(
        '/v1/agent/sessions/${binding.characterSessionId}/media-set-turn',
        {
          'characterId': binding.characterId,
          'caption': caption,
          'media': [
            for (final item in media)
              {
                'mimeType': item.mimeType,
                'dataBase64': base64Encode(item.bytes),
                if (item.name != null) 'name': item.name,
              },
          ],
        },
        cancelToken: token,
        onSendProgress: onUploadProgress,
      );
      final reply = data['reply'];
      if (reply is! String || reply.isEmpty) {
        throw const ApiException('Agent media service unavailable');
      }
      return _turnResultFromData(data, reply: reply);
    } finally {
      if (identical(_turnTokens[binding.characterId], token)) {
        _turnTokens.remove(binding.characterId);
      }
    }
  }

  @override
  void cancelTurn(String characterId) {
    _turnTokens.remove(characterId)?.cancel('Stopped by user');
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

import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

import '../chat/message_parts.dart';
import '../core/network/api_client.dart';
import 'agent_directory.dart';
import 'creator_skills.dart';
import 'creator_economy.dart';
import 'creator_clone.dart';
import 'agent_session.dart';
import 'agent_shell.dart';
import '../chat/shell_document.dart';

const String kAgentBaseUrl = String.fromEnvironment(
  'AGENT_BASE_URL',
  defaultValue: 'https://masanawa-gateway-production.up.railway.app',
);

class _GatewayClient {
  _GatewayClient({
    required Dio dio,
    required this.baseUrl,
    this.readAccessToken,
    this.refreshAccessToken,
  }) : dio = Dio(dio.options.copyWith(baseUrl: baseUrl)) {
    // Keep injected adapters available for tests; never copy unrelated
    // interceptors from the civic client.
    this.dio.httpClientAdapter = dio.httpClientAdapter;
    this.dio.interceptors.add(
      QueuedInterceptorsWrapper(
        onError: (error, handler) async {
          if (error.response?.statusCode == 401 &&
              refreshAccessToken != null &&
              error.requestOptions.extra['masanawaAuthRetried'] != true) {
            try {
              final token = await refreshAccessToken!();
              if (token != null && token.isNotEmpty) {
                final options = error.requestOptions;
                options.headers['Authorization'] = 'Bearer $token';
                options.extra['masanawaAuthRetried'] = true;
                final response = await this.dio.fetch(options);
                handler.resolve(response);
                return;
              }
            } catch (_) {
              // The normal 401 path below signs the user out only when session
              // rotation genuinely failed.
            }
          }
          handler.next(error);
        },
      ),
    );
  }

  final Dio dio;
  final String baseUrl;
  final String? Function()? readAccessToken;
  final Future<String?> Function()? refreshAccessToken;

  Options options({bool turn = false, String? requestId}) {
    final token = readAccessToken?.call();
    return Options(
      followRedirects: false,
      receiveTimeout: turn
          ? const Duration(seconds: 75)
          : const Duration(seconds: 15),
      headers: {
        if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
        if (requestId != null && requestId.isNotEmpty) 'x-request-id': requestId,
      },
    );
  }

  Future<Map<String, dynamic>> post(
    String path,
    Map<String, dynamic> body, {
    CancelToken? cancelToken,
    void Function(int sent, int total)? onSendProgress,
    String? requestId,
  }) async {
    try {
      final res = await dio.post<Map<String, dynamic>>(
        '$baseUrl$path',
        data: body,
        options: options(
          turn: path.endsWith('/turn') ||
              path.endsWith('/media-turn') ||
              path.endsWith('/media-set-turn'),
          requestId: requestId,
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

  // Token grants must never retry with a credential from a different session.
  Future<Map<String, dynamic>> postPinned(
    String path,
    Map<String, dynamic> body, {String? accessToken}
  ) async {
    final token = accessToken ?? readAccessToken?.call();
    final pinned = Dio(dio.options.copyWith(baseUrl: baseUrl));
    pinned.httpClientAdapter = dio.httpClientAdapter;
    try {
      final response = await pinned.post<Map<String, dynamic>>(
        '$baseUrl$path',
        data: body,
        options: Options(
          followRedirects: false,
          headers: {'Authorization': token == null ? '' : 'Bearer $token'},
          sendTimeout: const Duration(seconds: 10),
          // Provider minting has a 20-second deadline, followed by durable
          // admission/history storage. Keep a bounded margin without reminting.
          receiveTimeout: const Duration(seconds: 30),
        ),
      );
      if (response.data == null) {
        throw const ApiException('Empty response from server');
      }
      return response.data!;
    } on DioException catch (error) {
      throw mapDioError(error);
    }
  }

  Future<Map<String, dynamic>> put(
    String path,
    Map<String, dynamic> body,
  ) async {
    try {
      final res = await dio.put<Map<String, dynamic>>(
        '$baseUrl$path',
        data: body,
        options: options(),
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
    String? requestId,
  }) async* {
    try {
      final res = await dio.post<ResponseBody>(
        '$baseUrl$path',
        data: body,
        options: options(turn: true, requestId: requestId).copyWith(
          responseType: ResponseType.stream,
        ),
        cancelToken: cancelToken,
      );
      final bodyStream = res.data?.stream;
      if (bodyStream == null) {
        throw const ApiException('Empty response from server');
      }
      await for (final line in bodyStream
          .cast<List<int>>()
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

  Stream<Map<String, dynamic>> getStream(String path) async* {
    try {
      final res = await dio.get<ResponseBody>(
        '$baseUrl$path',
        options: options(turn: true).copyWith(responseType: ResponseType.stream),
      );
      final bodyStream = res.data?.stream;
      if (bodyStream == null) throw const ApiException('Empty response from server');
      await for (final line in bodyStream
          .cast<List<int>>()
          .transform(utf8.decoder)
          .transform(const LineSplitter())) {
        final value = line.trim();
        if (value.isEmpty) continue;
        final decoded = jsonDecode(value);
        if (decoded is Map) yield decoded.cast<String, dynamic>();
      }
    } on DioException catch (e) {
      throw mapDioError(e);
    } on FormatException {
      throw const ApiException('Invalid event stream');
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
    Future<String?> Function()? refreshAccessToken,
  }) : _client = _GatewayClient(
         dio: dio,
         baseUrl: baseUrl,
         readAccessToken: readAccessToken,
         refreshAccessToken: refreshAccessToken,
       );

  final _GatewayClient _client;

  @override
  Future<List<AgentDirectoryEntry>> loadDirectory() async {
    final data = await _client.get('/agent/directory');
    final raw = data['agents'];
    if (raw is! List) throw const ApiException('Invalid agent directory');
    return [
      for (final item in raw)
        if (item is Map)
          AgentDirectoryEntry.fromJson(item.cast<String, dynamic>()),
    ];
  }
  @override
  Future<void> setDefaultPlatformAgent(String characterId) async {
    await _client.put('/agent/preferences/default', {
      'characterId': characterId,
    });
  }
}

class MasanawaCreatorSkillTransport implements CreatorSkillTransport {
  MasanawaCreatorSkillTransport({
    required Dio dio,
    required String baseUrl,
    String? Function()? readAccessToken,
    Future<String?> Function()? refreshAccessToken,
  }) : _client = _GatewayClient(
         dio: dio,
         baseUrl: baseUrl,
         readAccessToken: readAccessToken,
         refreshAccessToken: refreshAccessToken,
       );

  final _GatewayClient _client;

  List<CreatorSkillEntry> _parse(Map<String, dynamic> data) {
    final raw = data['skills'];
    if (raw is! List) throw const ApiException('Invalid creator Skill catalog');
    return [
      for (final item in raw)
        if (item is Map)
          CreatorSkillEntry.fromJson(item.cast<String, dynamic>()),
    ];
  }

  @override
  Future<List<CreatorSkillEntry>> load() async {
    return _parse(await _client.get('/creator/skills'));
  }

  @override
  Future<List<CreatorSkillEntry>> setEnabled(
    String skillVersionId,
    bool enabled,
  ) async {
    return _parse(await _client.put('/creator/skills', {
      'skillVersionId': skillVersionId,
      'enabled': enabled,
    }));
  }
}

class MasanawaCreatorEconomyTransport implements CreatorEconomyTransport {
  MasanawaCreatorEconomyTransport({
    required Dio dio,
    required String baseUrl,
    String? Function()? readAccessToken,
    Future<String?> Function()? refreshAccessToken,
  }) : _client = _GatewayClient(
         dio: dio,
         baseUrl: baseUrl,
         readAccessToken: readAccessToken,
         refreshAccessToken: refreshAccessToken,
       );

  final _GatewayClient _client;

  @override
  Future<CreatorEconomySnapshot> load() async {
    final data = await _client.get('/creator/economy');
    return CreatorEconomySnapshot.fromJson(data);
  }

  @override
  Future<CreatorEconomySnapshot> allocateFloat(int amountCredits) async {
    final data = await _client.post('/creator/float', {
      'amountCredits': amountCredits,
    });
    return CreatorEconomySnapshot.fromJson(data);
  }
}

class MasanawaCreatorCloneTransport implements CreatorCloneTransport {
  MasanawaCreatorCloneTransport({
    required Dio dio,
    required String baseUrl,
    String? Function()? readAccessToken,
    Future<String?> Function()? refreshAccessToken,
  }) : _client = _GatewayClient(
         dio: dio,
         baseUrl: baseUrl,
         readAccessToken: readAccessToken,
         refreshAccessToken: refreshAccessToken,
       );

  final _GatewayClient _client;

  @override
  Future<CreatorCloneResult> create({
    required String displayName,
    required String biography,
    required String gender,
    required int age,
    required String avatarBase64,
    required String avatarMimeType,
    required List<String> personality,
    required List<String> expertise,
  }) async {
    final data = await _client.post('/creator/clone', {
      'displayName': displayName,
      'biography': biography,
      'gender': gender,
      'age': age,
      'avatarBase64': avatarBase64,
      'avatarMimeType': avatarMimeType,
      'personality': personality,
      'expertise': expertise,
    });
    final created = CreatorCloneResult.fromJson(data);
    try {
      final profile = await _client.get('/agent/twin/profile');
      final publicId = profile['publicId'];
      if (publicId is String && publicId.trim().isNotEmpty) {
        return CreatorCloneResult(
          created: created.created,
          characterId: created.characterId,
          characterVersionId: created.characterVersionId,
          relationshipId: created.relationshipId,
          displayName: created.displayName,
          publicUrl: 'https://masanawa.com/${publicId.trim()}',
        );
      }
    } catch (_) {
      // Creation is canonical even if the public profile projection is still catching up.
    }
    return created;
  }
}

class MasanawaAgentTransport implements AgentTransport, AgentShellTransport {
  MasanawaAgentTransport({
    required Dio dio,
    required String baseUrl,
    String? Function()? readAccessToken,
    Future<String?> Function()? refreshAccessToken,
  }) : _client = _GatewayClient(
         dio: dio,
         baseUrl: baseUrl,
         readAccessToken: readAccessToken,
         refreshAccessToken: refreshAccessToken,
       );

  final _GatewayClient _client;
  final Map<String, CancelToken> _turnTokens = {};

  @override
  Future<AgentSessionBinding> openSession(String characterId) async {
    final data = await _client.post('/agent/sessions/open', {
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
    Future<void> Function(Uint8List pcmChunk)? onAudioPcmChunk,
    String? requestId,
  }) async {
    final token = CancelToken();
    _turnTokens[binding.characterId]?.cancel('Superseded by a new turn');
    _turnTokens[binding.characterId] = token;

    try {
      if (onTextDelta != null) {
        var streamedText = '';
        Map<String, dynamic>? done;
        await for (final event in _client.postStream(
          '/agent/sessions/${binding.characterSessionId}/turn-stream',
          {'characterId': binding.characterId, 'text': text},
          cancelToken: token,
          requestId: requestId,
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
          if (type == 'audio') {
            final data = event['dataBase64'];
            if (data is String && data.isNotEmpty && onAudioPcmChunk != null) {
              await onAudioPcmChunk(base64Decode(data));
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
        '/agent/sessions/${binding.characterSessionId}/turn',
        {'characterId': binding.characterId, 'text': text},
        cancelToken: token,
        requestId: requestId,
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
    String? requestId,
  }) async {
    final token = CancelToken();
    _turnTokens[binding.characterId]?.cancel('Superseded by a new turn');
    _turnTokens[binding.characterId] = token;
    late final Map<String, dynamic> data;
    try {
      data = await _client.post(
        '/agent/sessions/${binding.characterSessionId}/media-turn',
        {
          'characterId': binding.characterId,
          'caption': caption,
          'mimeType': mimeType,
          'dataBase64': base64Encode(bytes),
        },
        cancelToken: token,
        onSendProgress: onUploadProgress,
        requestId: requestId,
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
    String? requestId,
  }) async {
    if (media.isEmpty || media.length > 8) {
      throw const ApiException('Invalid attachment set');
    }
    final token = CancelToken();
    _turnTokens[binding.characterId]?.cancel('Superseded by a new turn');
    _turnTokens[binding.characterId] = token;
    try {
      final data = await _client.post(
        '/agent/sessions/${binding.characterSessionId}/media-set-turn',
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
        requestId: requestId,
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
  Future<AgentShellConfig> loadShellConfig(String characterId) async {
    final query = <String, String>{
      'characterId': characterId,
      'clientVersion': kMasanawaShellVersion,
      'capabilities': jsonEncode(ShellDocument.capabilities),
    };
    final path = '/agent/shell/config?${Uri(queryParameters: query).query}';
    return AgentShellConfig.fromJson(await _client.get(path));
  }

  @override
  Future<List<AgentHistoryMessage>> loadHistory(
    String characterId, {
    int limit = 100,
    String? before,
  }) async {
    final query = <String, String>{
      'characterId': characterId,
      'limit': '$limit',
      if (before != null && before.isNotEmpty) 'before': before,
    };
    final path = '/agent/history?${Uri(queryParameters: query).query}';
    final data = await _client.get(path);
    final raw = data['messages'];
    if (raw is! List) throw const ApiException('Invalid conversation history');
    return [
      for (final item in raw)
        if (item is Map)
          AgentHistoryMessage.fromJson(item.cast<String, dynamic>()),
    ];
  }

  @override
  Future<AgentTurnStatus> turnStatus(
    String characterId,
    String requestId,
  ) async {
    final path =
        '/agent/turns/${Uri.encodeComponent(requestId)}/status'
        '?characterId=${Uri.encodeQueryComponent(characterId)}';
    final data = await _client.get(path);
    return AgentTurnStatus(
      state: data['state'] as String? ?? 'missing',
      reply: data['reply'] as String?,
      parts: [
        for (final raw in (data['parts'] as List? ?? const []))
          if (raw is Map) raw.cast<String, dynamic>(),
      ],
      agentRunId: data['agentRunId'] as String?,
      failureCode: data['failureCode'] as String?,
    );
  }

  @override
  Stream<AgentShellEvent> events(
    String characterId, {
    String? after,
  }) async* {
    var cursor = after;
    while (true) {
      final query = <String, String>{
        'characterId': characterId,
        if (cursor != null && cursor.isNotEmpty) 'after': cursor,
        'limit': '100',
      };
      final path = '/agent/events/stream?${Uri(queryParameters: query).query}';
      await for (final raw in _client.getStream(path)) {
        final parsed = AgentShellEvent.fromJson(raw);
        if (parsed.cursor.isNotEmpty) cursor = parsed.cursor;
        yield parsed;
      }
      await Future<void>.delayed(const Duration(milliseconds: 250));
    }
  }

  @override
  Future<void> dispatchAction({
    required String characterId,
    required String characterSessionId,
    required ShellAction action,
  }) async {
    await _client.post(
      '/agent/sessions/${Uri.encodeComponent(characterSessionId)}/actions',
      {
        'characterId': characterId,
        'documentId': action.documentId,
        'revision': action.revision,
        'nodeId': action.nodeId,
        'actionId': action.actionId,
        'token': action.token,
        'values': action.values,
      },
    );
  }

  @override
  Future<bool> actionAccepted({
    required String characterId,
    required ShellAction action,
  }) async {
    final query = <String, String>{
      'characterId': characterId,
      'documentId': action.documentId,
      'revision': '${action.revision}',
    };
    final data = await _client.get(
      '/agent/actions/status?${Uri(queryParameters: query).query}',
    );
    final record = data['record'];
    return record is Map && record['state'] == 'accepted';
  }

  @override
  Future<AgentLiveVoiceGrant> mintLiveVoiceGrant(
    String characterId, {
    String? admissionId,
    String purpose = 'conversation',
  }) async {
    return mintLiveVoiceGrantPinned(characterId,
        admissionId: admissionId, purpose: purpose);
  }

  Future<AgentLiveVoiceGrant> mintLiveVoiceGrantPinned(
    String characterId, {
    String? accessToken,
    String? admissionId,
    String purpose = 'conversation',
  }) async {
    final data = await _client.postPinned(
      '/agent/live/token',
      {
        'characterId': characterId,
        'purpose': purpose,
        if (admissionId != null && admissionId.isNotEmpty)
          'admissionId': admissionId,
      },
      accessToken: accessToken,
    );
    final expiresAt = DateTime.tryParse(data['expiresAt'] as String? ?? '');
    final token = data['token'];
    final websocketUrl = data['websocketUrl'];
    final model = data['model'];
    final voiceName = data['voiceName'];
    if (token is! String ||
        websocketUrl is! String ||
        model is! String ||
        voiceName is! String ||
        expiresAt == null) {
      throw const ApiException('Invalid live voice grant');
    }
    return AgentLiveVoiceGrant(
      token: token,
      websocketUrl: websocketUrl,
      model: model,
      voiceName: voiceName,
      expiresAt: expiresAt,
      callId: data['callId'] is String ? data['callId'] as String : null,
    );
  }

  @override
  Future<void> setPresence({
    required String characterId,
    required String state,
    int durationMs = 60000,
  }) async {
    await _client.post('/agent/presence', {
      'characterId': characterId,
      'state': state,
      'durationMs': durationMs,
    });
  }

  @override
  Future<void> registerPush({
    required String characterId,
    required String installationId,
    required String platform,
    required String token,
  }) async {
    await _client.post('/agent/push/register', {
      'characterId': characterId,
      'installationId': installationId,
      'platform': platform,
      'token': token,
    });
  }

  @override
  Future<void> unregisterPush({
    required String characterId,
    required String installationId,
  }) async {
    await _client.post('/agent/push/unregister', {
      'characterId': characterId,
      'installationId': installationId,
    });
  }

  @override
  Future<void> closeSession(AgentSessionBinding binding) async {
    try {
      await _client.post(
        '/agent/sessions/${binding.characterSessionId}/close',
        {'characterId': binding.characterId},
      );
    } catch (_) {
      // Advisory only. Canonical continuity remains server-owned.
    }
  }
}

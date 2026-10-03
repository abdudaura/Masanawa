import 'package:dio/dio.dart';

import '../core/network/api_client.dart';
import 'agent_session.dart';

/// Build-time flags for the Masanawa agent runtime (Task 099 gateway).
///
/// The gateway does not expose these endpoints yet, so the flags default to
/// the preview path. When the runtime ships, build with:
///   --dart-define=AGENT_RUNTIME_ENABLED=true
///   --dart-define=AGENT_BASE_URL=https://gateway.example.com
const String kAgentBaseUrl = String.fromEnvironment(
  'AGENT_BASE_URL',
  defaultValue: '',
);

const bool kAgentRuntimeEnabled = bool.fromEnvironment(
  'AGENT_RUNTIME_ENABLED',
  defaultValue: false,
);

/// True only when the builder explicitly pointed the shell at a runtime.
/// Otherwise every conversation stays on the preview transport.
bool get isAgentRuntimeConfigured =>
    kAgentRuntimeEnabled && kAgentBaseUrl.isNotEmpty;

/// Live transport against the Masanawa agent gateway (draft v0 contract in
/// `docs/AGENT-GATEWAY-CONTRACT.md`). Auth reuses the shell session token.
/// Every failure surfaces as [ApiException] so the caller falls back
/// honestly instead of faking a reply.
class MasanawaAgentTransport implements AgentTransport {
  MasanawaAgentTransport({
    required Dio dio,
    required this.baseUrl,
    this.readAccessToken,
  }) : _dio = Dio(dio.options);

  final String baseUrl;

  /// Returns the current shell access token, or null when signed out.
  final String? Function()? readAccessToken;

  /// Private Dio with the shared timeouts but no interceptors: requests use
  /// absolute gateway URLs and carry the token explicitly.
  final Dio _dio;

  Future<Map<String, dynamic>> _post(
    String path,
    Map<String, dynamic> body,
  ) async {
    final token = readAccessToken?.call();
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '$baseUrl$path',
        data: body,
        options: Options(
          headers: {
            if (token != null && token.isNotEmpty)
              'Authorization': 'Bearer $token',
          },
        ),
      );
      final data = res.data;
      if (data == null) {
        throw const ApiException('Empty response from server');
      }
      return data;
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  @override
  Future<AgentSessionBinding> openSession(String masanaId) async {
    final data = await _post('/agent/sessions/open', {
      'masanaId': masanaId,
    });
    final id = data['characterSessionId'];
    if (id is! String || id.isEmpty) {
      throw const ApiException('Agent service unavailable');
    }
    final runId = data['agentRunId'];
    return AgentSessionBinding(
      masanaId: masanaId,
      characterSessionId: id,
      agentRunId: runId is String && runId.isNotEmpty ? runId : null,
    );
  }

  @override
  Future<AgentTurnResult> sendTurn({
    required AgentSessionBinding binding,
    required String text,
  }) async {
    final data = await _post(
      '/agent/sessions/${binding.characterSessionId}/turn',
      {'text': text},
    );
    final reply = data['reply'];
    if (reply is! String || reply.isEmpty) {
      throw const ApiException('Agent service unavailable');
    }
    final runId = data['agentRunId'];
    return AgentTurnResult(
      text: reply,
      agentRunId: runId is String && runId.isNotEmpty ? runId : null,
    );
  }

  @override
  Future<void> closeSession(AgentSessionBinding binding) async {
    // Best effort — server sessions are durable; a lost close never strands
    // the Character (phone ≠ brain).
    try {
      await _post(
        '/agent/sessions/${binding.characterSessionId}/close',
        const {},
      );
    } catch (_) {
      // Ignore: closing is advisory.
    }
  }
}

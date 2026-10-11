import 'package:dio/dio.dart';

/// Uses the injected signed-in client; no developer token or parallel auth.
class MasanaChatApi {
  const MasanaChatApi(this.dio);
  final Dio dio;
  String _base(String id) =>
      '/v1/masana/' + Uri.encodeComponent(id) + '/chat/sessions';

  Future<String> open(String characterId) async {
    final result = await dio.post<Map<String, dynamic>>(_base(characterId));
    final id = result.data?['characterSessionId'];
    if (id is! String || !id.startsWith('character-session_')) {
      throw const FormatException('Invalid conversation session');
    }
    return id;
  }
  Future<String> turn({
    required String characterId, required String sessionId,
    required String text, required String requestId,
  }) async {
    final path = _base(characterId) + '/' +
        Uri.encodeComponent(sessionId) + '/turns';
    final result = await dio.post<Map<String, dynamic>>(path,
      data: {'text': text, 'requestId': requestId});
    final reply = result.data?['reply'];
    if (reply is! String) throw const FormatException('Invalid reply');
    return reply;
  }
  Future<void> close(String characterId, String sessionId) async {
    await dio.post<void>(_base(characterId) + '/' +
        Uri.encodeComponent(sessionId) + '/close');
  }
}

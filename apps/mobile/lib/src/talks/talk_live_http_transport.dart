import '../core/network/api_client.dart';
import 'talk_live.dart';

class GatewayTalkLiveTransport implements TalkLiveTransport {
  GatewayTalkLiveTransport({required this.api});

  final ApiClient api;

  @override
  Future<TalkLiveSessionView> connect(String talkId) async {
    final response = await api.dio.post<dynamic>(
      '/talks/' + Uri.encodeComponent(talkId) + '/live/connect',
    );
    return _session(response.data);
  }

  @override
  Future<TalkLiveSessionView> heartbeat({
    required String talkId,
    required String sessionId,
  }) async {
    final response = await api.dio.post<dynamic>(
      '/talks/' + Uri.encodeComponent(talkId) + '/live/heartbeat',
      data: {'sessionId': sessionId},
    );
    return _session(response.data);
  }

  @override
  Future<TalkLiveStateView> disconnect({
    required String talkId,
    required String sessionId,
  }) async {
    final response = await api.dio.post<dynamic>(
      '/talks/' + Uri.encodeComponent(talkId) + '/live/disconnect',
      data: {'sessionId': sessionId},
    );
    return _state(response.data);
  }

  @override
  Future<TalkLiveMediaCredentials> mediaToken({
    required String talkId,
    required String sessionId,
  }) async {
    final response = await api.dio.post<dynamic>(
      '/talks/' + Uri.encodeComponent(talkId) + '/live/media-token',
      data: {'sessionId': sessionId},
    );
    final data = response.data;
    if (data is Map<String, dynamic>) {
      return TalkLiveMediaCredentials.fromJson(data);
    }
    if (data is Map) {
      return TalkLiveMediaCredentials.fromJson(data.cast<String, dynamic>());
    }
    throw const FormatException('Invalid Talk media credentials');
  }

  @override
  Future<TalkLiveStateView> state(String talkId) async {
    final response = await api.dio.get<dynamic>(
      '/talks/' + Uri.encodeComponent(talkId) + '/live/state',
    );
    return _state(response.data);
  }

  TalkLiveSessionView _session(dynamic data) {
    if (data is Map<String, dynamic>) return TalkLiveSessionView.fromJson(data);
    if (data is Map) {
      return TalkLiveSessionView.fromJson(data.cast<String, dynamic>());
    }
    throw const FormatException('Invalid Talk live session response');
  }

  TalkLiveStateView _state(dynamic data) {
    if (data is Map<String, dynamic>) return TalkLiveStateView.fromJson(data);
    if (data is Map) return TalkLiveStateView.fromJson(data.cast<String, dynamic>());
    throw const FormatException('Invalid Talk live state response');
  }
}

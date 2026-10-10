import 'package:dio/dio.dart';
import '../core/network/api_client.dart';
import 'talk_post_session.dart';

class GatewayTalkInsightTransport implements TalkInsightTransport {
  GatewayTalkInsightTransport({required this.api});
  final ApiClient api;
  String _path(String talkId) => '/talks/${Uri.encodeComponent(talkId)}/post-session/insights';

  Map<String, dynamic> _map(dynamic data) {
    if (data is Map<String, dynamic>) return data;
    if (data is Map) return data.cast<String, dynamic>();
    throw const FormatException('Invalid Talk insights response');
  }

  @override
  Future<TalkInsightDraft?> read(String talkId) async {
    try {
      final result = await api.dio.get<dynamic>(_path(talkId));
      if (result.data == null) return null;
      return TalkInsightDraft.fromJson(_map(result.data));
    } on DioException catch (error) {
      if (error.response?.statusCode == 404) return null;
      rethrow; // no retry across 401/sign-out without active session
    }
  }

  @override
  Future<TalkInsightDraft> generate(String talkId) async {
    final result = await api.dio.post<dynamic>(
      _path(talkId),
      data: {'processingConsent': true},
    );
    return TalkInsightDraft.fromJson(_map(result.data));
  }
}

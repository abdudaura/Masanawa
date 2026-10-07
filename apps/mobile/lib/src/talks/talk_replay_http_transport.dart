import 'package:dio/dio.dart';

import '../core/network/api_client.dart';
import 'talk_replay.dart';

class GatewayTalkReplayTransport implements TalkReplayTransport {
  GatewayTalkReplayTransport({required this.api});

  final ApiClient api;

  @override
  Future<TalkReplayView> load(String talkId) async {
    try {
      final response = await api.dio.get<dynamic>(
        '/talks/' + Uri.encodeComponent(talkId) + '/replay',
      );
      final data = response.data;
      if (data is Map<String, dynamic>) return TalkReplayView.fromJson(data);
      if (data is Map) {
        return TalkReplayView.fromJson(data.cast<String, dynamic>());
      }
      throw const FormatException('Invalid Talk replay response');
    } on DioException catch (error) {
      if (error.response?.statusCode == 404) {
        return TalkReplayView(
          talkId: talkId,
          status: TalkReplayStatus.unavailable,
          published: false,
        );
      }
      rethrow;
    }
  }

  @override
  Future<TalkReplayView> setPublished({
    required String talkId,
    required bool published,
  }) async {
    final response = await api.dio.post<dynamic>(
      '/talks/' + Uri.encodeComponent(talkId) + '/replay/publication',
      data: {'published': published},
    );
    final data = response.data;
    if (data is Map<String, dynamic>) return TalkReplayView.fromJson(data);
    if (data is Map) {
      return TalkReplayView.fromJson(data.cast<String, dynamic>());
    }
    throw const FormatException('Invalid Talk replay response');
  }
}

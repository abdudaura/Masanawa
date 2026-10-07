import '../core/network/api_client.dart';
import 'talk_replay_playback.dart';

class GatewayTalkReplayPlaybackTransport
    implements TalkReplayPlaybackTransport {
  GatewayTalkReplayPlaybackTransport({required this.api});

  final ApiClient api;

  @override
  Future<TalkReplayPlaybackCredentials> load(String talkId) async {
    final response = await api.dio.get<dynamic>(
      '/talks/' + Uri.encodeComponent(talkId) + '/replay/playback',
    );
    final data = response.data;
    if (data is Map<String, dynamic>) {
      return TalkReplayPlaybackCredentials.fromJson(data);
    }
    if (data is Map) {
      return TalkReplayPlaybackCredentials.fromJson(
        data.cast<String, dynamic>(),
      );
    }
    throw const FormatException('Invalid replay playback response');
  }
}

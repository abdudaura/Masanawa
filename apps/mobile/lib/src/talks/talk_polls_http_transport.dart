import '../core/network/api_client.dart';
import 'talk_polls.dart';

class GatewayTalkPollTransport implements TalkPollTransport {
  GatewayTalkPollTransport({required this.api});

  final ApiClient api;

  String _base(String talkId) => '/talks/' + Uri.encodeComponent(talkId);

  @override
  Future<TalkPoll?> load(String talkId) async {
    final response = await api.dio.get<dynamic>(_base(talkId) + '/poll');
    if (response.data == null) return null;
    return _poll(response.data);
  }

  @override
  Future<TalkPoll> create({
    required String talkId,
    required String question,
    required List<String> options,
  }) async {
    final response = await api.dio.post<dynamic>(
      _base(talkId) + '/polls',
      data: {'question': question, 'options': options},
    );
    return _poll(response.data);
  }

  @override
  Future<TalkPoll> vote({
    required String talkId,
    required String pollId,
    required String optionId,
  }) async {
    final response = await api.dio.post<dynamic>(
      _base(talkId) +
          '/polls/' +
          Uri.encodeComponent(pollId) +
          '/vote',
      data: {'optionId': optionId},
    );
    return _poll(response.data);
  }

  @override
  Future<TalkPoll> close({
    required String talkId,
    required String pollId,
  }) async {
    final response = await api.dio.post<dynamic>(
      _base(talkId) +
          '/polls/' +
          Uri.encodeComponent(pollId) +
          '/close',
    );
    return _poll(response.data);
  }

  TalkPoll _poll(dynamic data) {
    if (data is Map<String, dynamic>) return TalkPoll.fromJson(data);
    if (data is Map) return TalkPoll.fromJson(data.cast<String, dynamic>());
    throw const FormatException('Invalid Talk poll response');
  }
}

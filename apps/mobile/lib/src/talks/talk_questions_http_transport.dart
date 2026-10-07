import '../core/network/api_client.dart';
import 'talk_questions.dart';

class GatewayTalkQuestionTransport implements TalkQuestionTransport {
  GatewayTalkQuestionTransport({required this.api});

  final ApiClient api;

  String _base(String talkId) =>
      '/talks/' + Uri.encodeComponent(talkId);

  @override
  Future<TalkQuestion> submit({
    required String talkId,
    required String body,
  }) async {
    final response = await api.dio.post<dynamic>(
      _base(talkId) + '/questions',
      data: {'body': body},
    );
    return _question(response.data);
  }

  @override
  Future<List<TalkQuestion>> loadHostQueue(String talkId) async {
    final response =
        await api.dio.get<dynamic>(_base(talkId) + '/host-questions');
    return _questions(response.data);
  }

  @override
  Future<List<TalkQuestion>> resolve({
    required String talkId,
    required String questionId,
    required TalkQuestionStatus status,
  }) async {
    final action = status == TalkQuestionStatus.answered
        ? 'answered'
        : 'dismissed';
    final response = await api.dio.post<dynamic>(
      _base(talkId) +
          '/host-questions/' +
          Uri.encodeComponent(questionId),
      data: {'action': action},
    );
    return _questions(response.data);
  }

  TalkQuestion _question(dynamic data) {
    if (data is Map<String, dynamic>) return TalkQuestion.fromJson(data);
    if (data is Map) {
      return TalkQuestion.fromJson(data.cast<String, dynamic>());
    }
    throw const FormatException('Invalid Talk question response');
  }

  List<TalkQuestion> _questions(dynamic data) {
    if (data is! List) {
      throw const FormatException('Invalid Talk question queue response');
    }
    return data.map((item) {
      if (item is Map<String, dynamic>) return TalkQuestion.fromJson(item);
      if (item is Map) {
        return TalkQuestion.fromJson(item.cast<String, dynamic>());
      }
      throw const FormatException('Invalid Talk question item');
    }).toList(growable: false);
  }
}

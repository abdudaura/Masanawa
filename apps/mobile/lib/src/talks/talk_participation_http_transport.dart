import 'package:dio/dio.dart';

import '../core/network/api_client.dart';
import 'talk_participation.dart';

class GatewayTalkParticipationTransport implements TalkParticipationTransport {
  GatewayTalkParticipationTransport({required this.api});

  final ApiClient api;

  @override
  Future<TalkParticipationState> load(String talkId) async {
    try {
      final response = await api.dio.get<dynamic>(
        '/talks/' + Uri.encodeComponent(talkId) + '/participation',
      );
      final data = response.data;
      if (data is Map<String, dynamic>) {
        return TalkParticipationState.fromJson(data);
      }
      if (data is Map) {
        return TalkParticipationState.fromJson(data.cast<String, dynamic>());
      }
      throw const FormatException('Invalid Talk participation response');
    } on DioException catch (error) {
      if (error.response?.statusCode == 404) {
        return const TalkParticipationState();
      }
      rethrow;
    }
  }

  @override
  Future<TalkParticipationState> react({
    required String talkId,
    required String reaction,
  }) async {
    final response = await api.dio.post<dynamic>(
      '/talks/' + Uri.encodeComponent(talkId) + '/reactions',
      data: {'reaction': reaction},
    );
    return _state(response.data);
  }

  @override
  Future<TalkParticipationState> leaveSeat(String talkId) async {
    final response = await api.dio.post<dynamic>(
      '/talks/' + Uri.encodeComponent(talkId) + '/leave-seat',
    );
    return _state(response.data);
  }

  @override
  Future<TalkParticipationState> setHandRaised({
    required String talkId,
    required bool raised,
  }) async {
    final response = await api.dio.post<dynamic>(
      '/talks/' + Uri.encodeComponent(talkId) + '/raise-hand',
      data: {'raised': raised},
    );
    return _state(response.data);
  }

  TalkParticipationState _state(dynamic data) {
    if (data is Map<String, dynamic>) {
      return TalkParticipationState.fromJson(data);
    }
    if (data is Map) {
      return TalkParticipationState.fromJson(data.cast<String, dynamic>());
    }
    throw const FormatException('Invalid Talk participation response');
  }
}

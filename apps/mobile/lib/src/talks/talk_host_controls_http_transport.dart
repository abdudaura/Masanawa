import 'package:dio/dio.dart';

import '../core/network/api_client.dart';
import 'talk_host_controls.dart';

class GatewayTalkHostControlsTransport implements TalkHostControlsTransport {
  GatewayTalkHostControlsTransport({required this.api});

  final ApiClient api;

  @override
  Future<TalkHostControlsView> load(String talkId) async {
    try {
      final response = await api.dio.get<dynamic>(
        '/talks/' + Uri.encodeComponent(talkId) + '/host-controls',
      );
      return _view(response.data);
    } on DioException catch (error) {
      if (error.response?.statusCode == 404) {
        return const TalkHostControlsView();
      }
      rethrow;
    }
  }

  @override
  Future<void> inviteHuman({
    required String talkId,
    required String handle,
  }) async {
    await api.dio.post<dynamic>(
      '/talks/' + Uri.encodeComponent(talkId) + '/invitations',
      data: {'handle': handle},
    );
  }

  @override
  Future<TalkHostControlsView> actOnRequest({
    required String talkId,
    required String requestId,
    required TalkHostRequestAction action,
  }) async {
    final response = await api.dio.post<dynamic>(
      '/talks/' +
          Uri.encodeComponent(talkId) +
          '/host-requests/' +
          Uri.encodeComponent(requestId),
      data: {'action': action.name},
    );
    return _view(response.data);
  }

  @override
  Future<TalkHostControlsView> actOnParticipant({
    required String talkId,
    required String participantId,
    required TalkHostParticipantAction action,
  }) async {
    final response = await api.dio.post<dynamic>(
      '/talks/' +
          Uri.encodeComponent(talkId) +
          '/host-participants/' +
          Uri.encodeComponent(participantId),
      data: {'action': action.name},
    );
    return _view(response.data);
  }

  @override
  Future<void> endTalk(String talkId) async {
    await api.dio.post<dynamic>(
      '/talks/' + Uri.encodeComponent(talkId) + '/end',
    );
  }

  TalkHostControlsView _view(dynamic data) {
    if (data is Map<String, dynamic>) {
      return TalkHostControlsView.fromJson(data);
    }
    if (data is Map) {
      return TalkHostControlsView.fromJson(data.cast<String, dynamic>());
    }
    throw const FormatException('Invalid Host controls response');
  }
}

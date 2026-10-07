import 'package:dio/dio.dart';

import '../core/network/api_client.dart';
import '../talks/talk_models.dart';
import 'talk_library.dart';

class GatewayTalkLibraryTransport implements TalkLibraryTransport {
  GatewayTalkLibraryTransport({required this.api});

  final ApiClient api;

  @override
  Future<MyTalksView> loadMyTalks() async {
    try {
      final response = await api.dio.get<dynamic>('/me/talks');
      final data = response.data;
      if (data is Map<String, dynamic>) return MyTalksView.fromJson(data);
      if (data is Map) {
        return MyTalksView.fromJson(data.cast<String, dynamic>());
      }
      throw const FormatException('Invalid My Talks response');
    } on DioException catch (error) {
      if (error.response?.statusCode == 404) return const MyTalksView();
      rethrow;
    }
  }

  @override
  Future<List<TalkDiscoveryItem>> loadSavedTalks() async {
    try {
      final response = await api.dio.get<dynamic>('/me/saved-talks');
      final data = response.data;
      if (data is! List) {
        throw const FormatException('Invalid Saved Talks response');
      }
      return [
        for (final item in data)
          if (item is Map)
            TalkDiscoveryItem.fromJson(item.cast<String, dynamic>()),
      ];
    } on DioException catch (error) {
      if (error.response?.statusCode == 404) return const [];
      rethrow;
    }
  }

  @override
  Future<TalkSavedState> loadSavedState(String talkId) async {
    final response = await api.dio.get<dynamic>(
      '/me/saved-talks/' + Uri.encodeComponent(talkId),
    );
    final data = response.data;
    if (data is Map<String, dynamic>) return TalkSavedState.fromJson(data);
    if (data is Map) {
      return TalkSavedState.fromJson(data.cast<String, dynamic>());
    }
    throw const FormatException('Invalid Saved Talk state response');
  }

  @override
  Future<TalkSavedState> setSaved({
    required String talkId,
    required bool saved,
  }) async {
    final path = '/me/saved-talks/' + Uri.encodeComponent(talkId);
    final response = saved
        ? await api.dio.put<dynamic>(path)
        : await api.dio.delete<dynamic>(path);
    final data = response.data;
    if (data is Map<String, dynamic>) return TalkSavedState.fromJson(data);
    if (data is Map) {
      return TalkSavedState.fromJson(data.cast<String, dynamic>());
    }
    throw const FormatException('Invalid Saved Talk mutation response');
  }
}

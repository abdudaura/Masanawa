import 'package:dio/dio.dart';

import '../core/network/api_client.dart';
import 'talk_social_profiles.dart';

class GatewayTalkSocialProfileTransport implements TalkSocialProfileTransport {
  GatewayTalkSocialProfileTransport({required this.api});

  final ApiClient api;

  @override
  Future<HumanProfile?> loadHuman(String handle) async {
    try {
      final response = await api.dio.get<dynamic>(
        '/profiles/' + Uri.encodeComponent(handle),
      );
      final data = response.data;
      if (data is Map<String, dynamic>) return HumanProfile.fromJson(data);
      if (data is Map) return HumanProfile.fromJson(data.cast<String, dynamic>());
      throw const FormatException('Invalid human profile response');
    } on DioException catch (error) {
      if (error.response?.statusCode == 404) return null;
      rethrow;
    }
  }

  @override
  Future<HumanProfile> setFollowing({
    required String handle,
    required bool following,
  }) async {
    final response = await api.dio.post<dynamic>(
      '/profiles/' + Uri.encodeComponent(handle) + '/follow',
      data: {'following': following},
    );
    final data = response.data;
    if (data is Map<String, dynamic>) return HumanProfile.fromJson(data);
    if (data is Map) return HumanProfile.fromJson(data.cast<String, dynamic>());
    throw const FormatException('Invalid follow response');
  }

  @override
  Future<PersonaProfile?> loadPersona(String publicId) async {
    try {
      final response = await api.dio.get<dynamic>(
        '/personas/' + Uri.encodeComponent(publicId),
      );
      final data = response.data;
      if (data is Map<String, dynamic>) return PersonaProfile.fromJson(data);
      if (data is Map) return PersonaProfile.fromJson(data.cast<String, dynamic>());
      throw const FormatException('Invalid persona profile response');
    } on DioException catch (error) {
      if (error.response?.statusCode == 404) return null;
      rethrow;
    }
  }
}

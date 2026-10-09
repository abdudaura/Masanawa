import 'package:dio/dio.dart';

import '../core/network/api_client.dart';
import 'learning_progress.dart';

/// Real Gateway transport; reuses the app's authenticated ApiClient (including
/// OTP/refresh handling). Never accepts a user-configured bearer/developer key.
class GatewayLearningTransport implements LearningTransport {
  const GatewayLearningTransport({
    required this.api,
    required this.characterSessionId,
    required this.authorizedRelationshipId,
  });

  final ApiClient api;
  final String characterSessionId;
  final String authorizedRelationshipId;

  void _relationship(String relation) {
    if (relation != authorizedRelationshipId ||
        relation.trim().isEmpty ||
        characterSessionId.trim().isEmpty) {
      throw const ApiException('This learning session is no longer available.',
          code: 'LEARNING_SESSION_STALE');
    }
  }

  Map<String, dynamic> _data(dynamic raw) {
    if (raw is Map<String, dynamic>) return raw;
    if (raw is Map) return raw.cast<String, dynamic>();
    throw const FormatException('learning.invalid_response');
  }

  @override
  Future<LearningReadback> read({
    required String characterId,
    required String relationshipId,
  }) async {
    _relationship(relationshipId);
    final response = await api.dio.get<dynamic>(
      '/agent/learning/progress',
      queryParameters: {'characterId': characterId},
      options: Options(
        followRedirects: false,
        receiveTimeout: const Duration(seconds: 15),
      ),
    );
    return LearningReadback.fromJson(_data(response.data));
  }

  @override
  Future<LearningActionOutcome> perform({
    required String characterId,
    required String relationshipId,
    required LearningCommand command,
  }) async {
    _relationship(relationshipId);
    final response = await api.dio.post<dynamic>(
      '/agent/learning/actions',
      data: {
        'characterId': characterId,
        'characterSessionId': characterSessionId,
        ...command.toJson(),
      },
      options: Options(
        followRedirects: false,
        receiveTimeout: const Duration(seconds: 75),
        headers: {'x-request-id': command.requestId},
      ),
    );
    return LearningActionOutcome.fromJson(_data(response.data));
  }
}

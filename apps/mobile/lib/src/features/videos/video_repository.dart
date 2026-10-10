import 'package:dio/dio.dart';
import 'video_models.dart';

/// Uses the parent app's configured HTTPS Dio with real session/tenant binding.
class VideoRepository {
  VideoRepository(this.dio);
  final Dio dio;
  Future<List<ExternalVideo>> list({String? provider}) async {
    final response = await dio.get<Map<String, dynamic>>('/v1/videos',
      queryParameters: {'provider': ?provider});
    final items = response.data?['items'];
    if (items is! List) throw const FormatException('Invalid video catalog');
    return items.map((e) => ExternalVideo.fromJson(Map<String, dynamic>.from(e as Map))).toList(growable: false);
  }
}

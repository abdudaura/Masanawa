import 'package:dio/dio.dart';
import 'video_models.dart';

/// Uses the parent app's configured HTTPS Dio with real session/tenant binding.
/// No second authentication store or endpoint is introduced.
class VideoRepository {
  VideoRepository(this.dio);
  final Dio dio;

  /// The backend cursor points to the final approved item of the preceding page.
  Future<VideoCatalogPage> page({String? provider, String? before}) async {
    final response = await dio.get<Map<String, dynamic>>('/v1/videos',
      queryParameters: {'provider': ?provider, 'before': ?before});
    final body = response.data;
    if (body == null) throw const FormatException('Invalid video catalog');
    return VideoCatalogPage.fromJson(body);
  }

  /// Kept for existing J15 callers that only need a first page.
  Future<List<ExternalVideo>> list({String? provider}) async =>
      (await page(provider: provider)).items;
}

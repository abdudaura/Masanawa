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

  /// C29: revalidate a catalog item before starting an official player.
  /// Only a trusted server tenant/session determines availability; never
  /// derive a positive status from a cached video or an HTTP failure.
  Future<bool> isApproved(String id) async {
    if (!RegExp(r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}
  Future<List<ExternalVideo>> list({String? provider}) async =>
      (await page(provider: provider)).items;
}
).hasMatch(id)) {
      throw const FormatException('Invalid video ID');
    }
    final response = await dio.get<Map<String, dynamic>>('/v1/videos/$id/availability');
    final data = response.data;
    if (data == null || data.length != 1 || data['available'] is! bool) {
      throw const FormatException('Unverified video availability');
    }
    return data['available'] as bool;
  }

  /// Kept for existing J15 callers that only need a first page.
  Future<List<ExternalVideo>> list({String? provider}) async =>
      (await page(provider: provider)).items;
}

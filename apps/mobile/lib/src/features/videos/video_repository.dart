import 'package:dio/dio.dart';
import 'video_models.dart';

/// C27–C29 use the host application's authenticated, account-scoped Dio.
/// Never cache positive approval or invent provider URLs.
class VideoRepository {
  VideoRepository(this.dio);
  final Dio dio;

  static final RegExp _videoId = RegExp(
    r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
  );

  /// Server-derived approved catalog, including its opaque next cursor.
  Future<VideoCatalogPage> page({String? provider, String? before}) async {
    if (provider != null &&
        !const {'youtube', 'tiktok', 'facebook'}.contains(provider)) {
      throw const FormatException('Unsupported video provider');
    }
    if (before != null && !_videoId.hasMatch(before)) {
      throw const FormatException('Invalid video cursor');
    }
    final response = await dio.get<Map<String, dynamic>>(
      '/v1/videos',
      queryParameters: {
        if (provider != null) 'provider': provider,
        if (before != null) 'before': before,
      },
    );
    final data = response.data;
    if (data == null) throw const FormatException('Invalid video catalog');
    return VideoCatalogPage.fromJson(data);
  }

  /// Recheck at every play attempt. A denied, offline or malformed response
  /// is never interpreted as successful admission.
  Future<bool> isApproved(String id) async {
    if (!_videoId.hasMatch(id)) {
      throw const FormatException('Invalid video ID');
    }
    final response = await dio.get<Map<String, dynamic>>(
      '/v1/videos/$id/availability',
    );
    final data = response.data;
    if (data == null || data.length != 1 || data['available'] is! bool) {
      throw const FormatException('Unverified video availability');
    }
    return data['available'] as bool;
  }

  /// Compatibility for existing first-page C27 consumers.
  Future<List<ExternalVideo>> list({String? provider}) async =>
      (await page(provider: provider)).items;
}

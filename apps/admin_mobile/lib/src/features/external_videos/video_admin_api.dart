import 'package:dio/dio.dart';

class CuratedVideo {
  const CuratedVideo({required this.id, required this.title, required this.channelName, required this.provider, required this.state});
  final String id, title, channelName, provider, state;
  factory CuratedVideo.fromJson(Map<String, dynamic> j) => CuratedVideo(id:j['id'] as String,
    title:j['title'] as String, channelName:j['channelName'] as String,
    provider:j['provider'] as String, state:j['reviewState'] as String);
}

class CuratedVideoPage {
  const CuratedVideoPage({required this.items, required this.nextCursor});
  final List<CuratedVideo> items;
  final String? nextCursor;
}

/// Parent Admin shell injects an authenticated Dio; no role fields originate here.
class VideoAdminApi {
  VideoAdminApi(this.dio);
  final Dio dio;

  Future<CuratedVideoPage> page({String? before}) async {
    final response = await dio.get<Map<String, dynamic>>('/v1/admin/video-items',
      queryParameters: {if (before != null) 'before': before});
    final items = response.data?['items'];
    if (items is! List) throw const FormatException('Invalid video reviews');
    final cursor = response.data?['nextCursor'];
    if (cursor != null && (cursor is! String ||
        !RegExp(r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$').hasMatch(cursor))) {
      throw const FormatException('Invalid review cursor');
    }
    return CuratedVideoPage(
      items: items.map((v) => CuratedVideo.fromJson(Map<String, dynamic>.from(v as Map))).toList(growable: false),
      nextCursor: cursor as String?,
    );
  }

  /// Backwards-compatible first page, for callers without pagination.
  Future<List<CuratedVideo>> list() async => (await page()).items;

  Future<void> submit(String url,String title,String channelName) async {
    await dio.post<void>('/v1/admin/video-items',
      data:{'url':url.trim(),'title':title.trim(),'channelName':channelName.trim()});
  }
  Future<void> review(String id,String state,String? evidence,{String? expectedState}) async {
    if (state == 'pending' && expectedState != 'hidden' && expectedState != 'unavailable') {
      throw ArgumentError('Re-review must match a hidden or unavailable item');
    }
    await dio.patch<void>('/v1/admin/video-items/$id/review',
      data:{'state':state,'verificationReference':evidence,
        if (state == 'pending') 'expectedState':expectedState});
  }
}

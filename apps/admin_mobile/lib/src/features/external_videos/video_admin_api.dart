import 'package:dio/dio.dart';

class CuratedVideo {
  const CuratedVideo({required this.id, required this.title, required this.channelName, required this.provider, required this.state});
  final String id, title, channelName, provider, state;
  factory CuratedVideo.fromJson(Map<String, dynamic> j) => CuratedVideo(id:j['id'] as String,
    title:j['title'] as String, channelName:j['channelName'] as String,
    provider:j['provider'] as String, state:j['reviewState'] as String);
}
/// Parent Admin shell injects an authenticated Dio; no role fields originate here.
class VideoAdminApi {
  VideoAdminApi(this.dio);
  final Dio dio;
  Future<List<CuratedVideo>> list() async {
    final response = await dio.get<Map<String, dynamic>>('/v1/admin/video-items');
    final items = response.data?['items'];
    if (items is! List) throw const FormatException('Invalid video reviews');
    return items.map((v) => CuratedVideo.fromJson(Map<String, dynamic>.from(v as Map))).toList(growable: false);
  }
  Future<void> submit(String url,String title,String channelName) async {
    await dio.post<void>('/v1/admin/video-items', data:{'url':url.trim(),'title':title.trim(),'channelName':channelName.trim()});
  }
  Future<void> review(String id,String state,String? evidence) async {
    await dio.patch<void>('/v1/admin/video-items/$id/review',
      data:{'state':state,'verificationReference':evidence});
  }
}

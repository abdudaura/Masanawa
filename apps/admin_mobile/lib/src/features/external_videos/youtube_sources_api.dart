import 'package:dio/dio.dart';

class YouTubeSourceRecord {
  const YouTubeSourceRecord({required this.id,required this.channelId,
    required this.channelName,required this.targetRegion,
    required this.enabled,required this.syncMode});
  final String id,channelId,channelName,targetRegion,syncMode;
  final bool enabled;
  factory YouTubeSourceRecord.fromJson(Map<String,dynamic> x) =>
    YouTubeSourceRecord(
      id:x['id'] as String,channelId:x['channelId'] as String,
      channelName:x['channelName'] as String,targetRegion:x['targetRegion'] as String,
      enabled:x['enabled'] as bool,syncMode:x['syncMode'] as String);
}
/// Authenticated Dio is injected by the existing Android Admin shell.
class YouTubeSourcesApi {
  YouTubeSourcesApi(this.dio);
  final Dio dio;
  Future<List<YouTubeSourceRecord>> list() async {
    final response=await dio.get<Map<String,dynamic>>('/v1/admin/video-sources');
    final raw=response.data?['items'];
    if(raw is! List) throw const FormatException('Invalid source list');
    return raw.map((v)=>YouTubeSourceRecord.fromJson(Map<String,dynamic>.from(v as Map)))
      .toList(growable:false);
  }
  Future<void> create(String channelId,String channelName,String region) async {
    await dio.post<void>('/v1/admin/video-sources',data:{
      'channelId':channelId.trim(),'channelName':channelName.trim(),
      'targetRegion':region.trim().toUpperCase(),
    });
  }
  Future<void> pause(String id) async {
    await dio.patch<void>('/v1/admin/video-sources/${Uri.encodeComponent(id)}/pause');
  }
}
